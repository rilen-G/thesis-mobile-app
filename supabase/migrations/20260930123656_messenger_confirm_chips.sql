-- Confirmation chips and short typed replies: yes confirms, unclear re-asks, and neither invalidates the pending summary.
create or replace function private.messenger_service(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 op text:=payload->>'op'; conn public.messenger_connections; c public.messenger_conversations;
 m public.messenger_messages; s public.messenger_summaries; a public.messenger_attempts;
 biz public.businesses; p public.products; item jsonb; source jsonb; result jsonb;
 mid uuid; token uuid; customer uuid; oid uuid; body text; code text; stamp timestamptz;
 total bigint:=0; amount integer; available integer; valid boolean:=true; probe boolean; tl boolean;
begin
 select * into strict conn from public.messenger_connections where id=(payload->>'connection_id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(conn.business_id::text,2));
 select * into strict conn from public.messenger_connections where id=conn.id for update;
 if op='ingest' then
  if payload->>'page_id' is distinct from conn.page_id then raise exception 'wrong_page'; end if;
  if payload->>'sender_id'=conn.page_id or coalesce((payload->>'is_echo')::boolean,false) then return '{"ignored":true}'::jsonb; end if;
  if coalesce(payload->>'sender_id','') !~ '^[0-9]{1,100}$' or length(coalesce(payload->>'event_id','')) not between 1 and 256 then raise exception 'invalid_event'; end if;
  stamp:=(payload->>'timestamp')::timestamptz;
  if stamp is null or stamp>now()+interval '5 minutes' then raise exception 'invalid_timestamp'; end if;
  select * into c from public.messenger_conversations where connection_id=conn.id and sender_id=payload->>'sender_id' for update;
  if found then
   select * into m from public.messenger_messages where conversation_id=c.id and external_id=payload->>'event_id';
   if found then return jsonb_build_object('id',m.id,'duplicate',true); end if;
  else
   customer:=gen_random_uuid();
   insert into public.customers(id,business_id,name) values(customer,conn.business_id,'Messenger customer '||right(payload->>'sender_id',4));
   insert into public.messenger_conversations(business_id,connection_id,sender_id,customer_id,last_customer_at)
   values(conn.business_id,conn.id,payload->>'sender_id',customer,stamp) returning * into c;
  end if;
  body:=trim(coalesce(payload->>'text',''));
  if length(body)>4000 then body:='[Message exceeds supported text length]'; valid:=false; end if;
  if body='' or coalesce((payload->>'unsupported')::boolean,false) then body:='[Unsupported message or attachment — open Messenger to review]';valid:=false; end if;
  probe:=conn.verified_at is null and c.sender_id=conn.probe_sender_id;
  -- Old events are retained but cannot supersede the active conversation.
  if stamp<c.last_customer_at then
   insert into public.messenger_messages(business_id,conversation_id,external_id,role,body,state,kind,conversation_version,event_at)
   values(conn.business_id,c.id,payload->>'event_id','customer',body,'suppressed','inbound',c.version,stamp) returning id into mid;
   return jsonb_build_object('id',mid,'stale',true);
  end if;
  update public.messenger_conversations set version=version+1,last_customer_at=greatest(last_customer_at,stamp),updated_at=now(),
   needs_attention=needs_attention or not valid or takeover or not conn.enabled where id=c.id returning * into c;
  update public.messenger_messages set state='suppressed',error_code='newer_message' where conversation_id=c.id and kind in ('inbound','reply') and state in ('pending','processing','queued','offered');
  update public.messenger_summaries ms set valid=false where ms.conversation_id=c.id and ms.valid and
   upper(body) is distinct from 'CONFIRM '||ms.code and coalesce(payload->>'reply_kind','') not in ('yes','unclear');
  insert into public.messenger_messages(business_id,conversation_id,external_id,role,body,state,kind,conversation_version,event_at,error_code)
  values(conn.business_id,c.id,payload->>'event_id','customer',body,
   case when (valid or (payload->>'reply_kind'='unclear' and exists(select 1 from public.messenger_summaries ms where ms.conversation_id=c.id and ms.valid and ms.expires_at>now())))
    and not c.takeover and (conn.enabled or probe) and stamp>now()-interval '24 hours' then 'pending' else 'done' end,
   'inbound',c.version,stamp,case when not valid then 'unsupported_message' end) returning id into mid;
  update public.messenger_connections set last_inbound_at=now() where id=conn.id;
  return jsonb_build_object('id',mid);
 elsif op='claim' then
  update public.messenger_connections set worker_seen_at=now() where id=conn.id;
  update public.messenger_messages set state='unknown',error_code='callback_missing'
   where business_id=conn.business_id and state='sending' and lease_until<now();
  update public.messenger_attempts set state='unknown',error_code='callback_missing'
   where business_id=conn.business_id and state='sending' and authorized_at<now()-interval '5 minutes';
  -- An offered hook may be delivered again; a sending action is never retried.
  update public.messenger_messages set state=case when attempts<5 then 'queued' else 'failed' end,
   error_code=case when attempts>=5 then 'handoff_exhausted' else error_code end
   where business_id=conn.business_id and state='offered' and lease_until<now();
  update public.messenger_attempts set state='suppressed',finished_at=now() where business_id=conn.business_id and state='offered'
   and created_at<now()-interval '2 minutes';
  update public.messenger_messages set state=case when attempts<3 then 'pending' else 'failed' end,error_code='worker_interrupted'
   where business_id=conn.business_id and state='processing' and lease_until<now();
  update public.messenger_conversations cc set needs_attention=true where cc.business_id=conn.business_id
   and exists(select 1 from public.messenger_messages mm where mm.conversation_id=cc.id and mm.state in ('unknown','failed'));
  select mm.* into m from public.messenger_messages mm join public.messenger_conversations cc on cc.id=mm.conversation_id
   where mm.business_id=conn.business_id and mm.state='pending' and mm.next_attempt_at<=now() and not cc.takeover
   and (conn.enabled or (conn.verified_at is null and cc.sender_id=conn.probe_sender_id))
   order by mm.seq limit 1 for update of mm;
  if not found then return null; end if;
  select * into c from public.messenger_conversations where id=m.conversation_id for update;
  if m.conversation_version<>c.version or c.last_customer_at<=now()-interval '24 hours' then
   update public.messenger_messages set state='suppressed',error_code='stale_or_window' where id=m.id; return null;
  end if;
  if (select count(*) from public.messenger_messages where business_id=conn.business_id and role='customer' and attempts>0 and created_at>now()-interval '1 hour')>=120 and m.attempts=0 then
   update public.messenger_messages set state='failed',error_code='hourly_limit' where id=m.id;
   update public.messenger_conversations set needs_attention=true where id=c.id; return null;
  end if;
  token:=gen_random_uuid();
  update public.messenger_messages set state='processing',processing_token=token,lease_until=now()+interval '60 seconds',attempts=attempts+1 where id=m.id returning * into m;
  select * into biz from public.businesses where id=conn.business_id;
  return jsonb_build_object('message',to_jsonb(m),'conversation',to_jsonb(c),'business',to_jsonb(biz),
   'probe',conn.verified_at is null and c.sender_id=conn.probe_sender_id,
   'products',coalesce((select jsonb_agg(t) from (select id,name,description,price_centavos,active,version from public.products where business_id=conn.business_id and active order by name limit 100)t),'[]'::jsonb),
   'knowledge',coalesce((select jsonb_agg(t) from (select id,title,bk.body,version,approved from public.business_knowledge bk where business_id=conn.business_id and approved order by title limit 40)t),'[]'::jsonb),
   'allocations',coalesce((select jsonb_agg(t) from (select product_id,da.total,used from public.daily_allocations da where business_id=conn.business_id and business_date=(now() at time zone 'Asia/Manila')::date)t),'[]'::jsonb),
   'history',coalesce((select jsonb_agg(t order by seq) from (select role,mm.body,seq from public.messenger_messages mm where conversation_id=c.id and seq<=m.seq and (role='customer' or state='accepted') order by seq desc limit 30)t),'[]'::jsonb),
   'summary',(select jsonb_build_object('code',ms.code) from public.messenger_summaries ms where ms.conversation_id=c.id and ms.valid and ms.expires_at>now() order by ms.created_at desc limit 1));
 elsif op='finish' then
  select * into m from public.messenger_messages where id=(payload->>'message_id')::uuid and business_id=conn.business_id for update;
  if not found or m.state<>'processing' or m.processing_token is distinct from (payload->>'processing_token')::uuid or m.lease_until<now() then return '{"stale":true}'::jsonb; end if;
  select * into c from public.messenger_conversations where id=m.conversation_id for update;
  probe:=conn.verified_at is null and c.sender_id=conn.probe_sender_id;
  tl:=coalesce(case when payload->>'language' in ('en','taglish') then payload->>'language' end,c.reply_language)='taglish';
  if c.version<>m.conversation_version or c.takeover or (not conn.enabled and not probe) or c.last_customer_at<=now()-interval '24 hours' then
   update public.messenger_messages set state='suppressed' where id=m.id; return '{"stale":true}'::jsonb;
  end if;
  if payload->>'error' is not null then
   update public.messenger_messages set state='failed',error_code='ai_unavailable' where id=m.id;
   update public.messenger_conversations set needs_attention=true where id=c.id; return '{"failed":true}'::jsonb;
  end if;
  select * into biz from public.businesses where id=conn.business_id;
  body:=payload->>'body';
  if probe then body:='Messenger connection test received. Please confirm receipt in the app before enabling live automation.';
  elsif upper(trim(m.body)) ~ '^CONFIRM [A-Z0-9]{8}$' or payload->>'confirm_code' ~ '^[A-Z0-9]{8}$' then
   code:=coalesce(payload->>'confirm_code',substring(upper(trim(m.body)) from 9));
   select ms.* into s from public.messenger_summaries ms where ms.conversation_id=c.id and ms.code=code order by ms.created_at desc limit 1;
   if s.order_id is not null then body:=case when tl then 'Confirmed na po ang order na ito. Ang staff na po ang bahala.' else 'This summary is already confirmed. Staff will handle your order.' end;
   elsif s.id is null or not s.valid or s.expires_at<=now() then body:=case when tl then 'Expired na po o nabago ang summary na iyan. Paki-send po ulit ang order niyo para sa bagong summary.' else 'That summary has expired or changed. Please send your order details again for a fresh summary.' end;
   else
    valid:=biz.rules_approved and biz.version=s.business_version
     and exists(select 1 from public.messenger_messages where id=s.message_id and state='accepted')
     and (s.draft->>'pickup_at')::timestamptz>now()
     and ((s.draft->>'pickup_at')::timestamptz at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
     and (now() at time zone 'Asia/Manila')::time between biz.opening_time and biz.cutoff_time;
    for item in select value from jsonb_array_elements(s.draft->'items') loop
     select * into p from public.products where id=(item->>'product_id')::uuid and business_id=conn.business_id;
     select da.total-da.used into available from public.daily_allocations da where da.business_id=conn.business_id and da.product_id=p.id and da.business_date=(now() at time zone 'Asia/Manila')::date;
     valid:=valid and coalesce(p.active,false) and coalesce(available,0)>=(item->>'quantity')::integer
      and exists(select 1 from jsonb_array_elements(s.sources) src where src->>'id'=p.id::text and (src->>'version')::integer=p.version);
     total:=total+p.price_centavos::bigint*(item->>'quantity')::integer;
    end loop;
    if c.order_id is not null and exists(select 1 from public.orders where id=c.order_id and status in ('confirmed','accepted','ready')) then valid:=false; end if;
    if valid then
     oid:=gen_random_uuid();
     insert into public.orders(id,business_id,customer_id,total_centavos,pickup_at,business_date,payment_method,reserved)
     values(oid,conn.business_id,c.customer_id,total,(s.draft->>'pickup_at')::timestamptz,(now() at time zone 'Asia/Manila')::date,s.draft->>'payment_method',true);
     insert into public.order_items(order_id,business_id,product_id,name,quantity,price_centavos)
      select oid,conn.business_id,pr.id,pr.name,(i->>'quantity')::integer,pr.price_centavos from jsonb_array_elements(s.draft->'items') i
      join public.products pr on pr.id=(i->>'product_id')::uuid and pr.business_id=conn.business_id;
     update public.daily_allocations da set used=da.used+(i->>'quantity')::integer,version=da.version+1 from jsonb_array_elements(s.draft->'items') i
      where da.business_id=conn.business_id and da.product_id=(i->>'product_id')::uuid and da.business_date=(now() at time zone 'Asia/Manila')::date;
     update public.messenger_conversations set order_id=oid where id=c.id;
     update public.messenger_summaries set order_id=oid,valid=false where id=s.id;
     body:=case when tl then 'Confirmed na po ang order niyo at naka-reserve na ang items. Imi-message namin kayo pag in-accept na ng staff.' else 'Your order is confirmed and your items are reserved. We will message you when staff accepts it.' end;
    else
     update public.messenger_summaries set valid=false where id=s.id;
     body:=case when tl then 'Nagbago po ang availability, oras, o detalye ng order. I-message po ang owner o i-send ulit ang order para sa bagong summary.' else 'Availability, hours, or order details changed. Please contact the owner or send your order again for a fresh summary.' end;
    end if;
   end if;
  elsif c.order_id is not null and exists(select 1 from public.orders where id=c.order_id and status in ('confirmed','accepted','ready')) then
   body:=case when tl then 'Naipasa na po namin sa owner ang message niyo. Hindi nabago ang existing order niyo.' else 'Your message has been flagged for the owner. Your existing order has not been changed.' end;
   update public.messenger_conversations set needs_attention=true where id=c.id;
  else
   -- AI grounding must still refer to current business/product/knowledge versions.
   valid:=biz.version=(payload->>'business_version')::integer;
   for source in select value from jsonb_array_elements(coalesce(payload->'sources','[]'::jsonb)) loop
    valid:=valid and (exists(select 1 from public.products where business_id=conn.business_id and id=(source->>'id')::uuid and version=(source->>'version')::integer and active)
     or exists(select 1 from public.business_knowledge where business_id=conn.business_id and id=(source->>'id')::uuid and version=(source->>'version')::integer and approved)
     or (source->>'id'=biz.id::text and (source->>'version')::integer=biz.version));
   end loop;
   if not coalesce(valid,false) then
    update public.messenger_messages set state='failed',error_code='sources_changed' where id=m.id;
    update public.messenger_conversations set needs_attention=true where id=c.id; return '{"failed":true}'::jsonb;
   end if;
   if coalesce((payload->>'attention')::boolean,false) then update public.messenger_conversations set needs_attention=true where id=c.id; end if;
  end if;
  if length(coalesce(body,'')) not between 1 and 3900 then raise exception 'invalid_reply'; end if;
  mid:=private.messenger_enqueue(c.id,body,case when probe then 'probe' else 'reply' end);
  if not probe then
   update public.messenger_messages set grounded_sources=coalesce(payload->'sources','[]'::jsonb),business_version=biz.version where id=mid;
   if payload->>'language' in ('en','taglish') then update public.messenger_conversations set reply_language=payload->>'language' where id=c.id; end if;
  end if;
  if not probe and jsonb_typeof(payload->'draft')='object' and not (upper(trim(m.body)) ~ '^CONFIRM ') and
   not exists(select 1 from public.orders where id=c.order_id and status in ('confirmed','accepted','ready')) then
   if not biz.rules_approved then
    update public.messenger_messages set body=case when tl then 'Kailangan pa pong i-approve ng owner ang ordering rules bago kami makatanggap ng order.' else 'The owner must approve the ordering rules before we can take your order.' end where id=mid;
   else
    code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    update public.messenger_summaries set valid=false where conversation_id=c.id;
    insert into public.messenger_summaries(business_id,conversation_id,message_id,code,draft,sources,business_version,expires_at)
    values(conn.business_id,c.id,mid,code,payload->'draft',payload->'sources',biz.version,least(now()+interval '30 minutes',(payload->'draft'->>'pickup_at')::timestamptz));
   end if;
  end if;
  update public.messenger_messages set state='done',error_code=null where id=m.id;
  return jsonb_build_object('id',mid);
 elsif op='offer' then
  select mm.* into m from public.messenger_messages mm join public.messenger_conversations cc on cc.id=mm.conversation_id
   where mm.business_id=conn.business_id and mm.state='queued' and mm.next_attempt_at<=now()
   and (conn.enabled or (mm.kind='probe' and conn.verified_at is null and cc.sender_id=conn.probe_sender_id))
   and not exists(select 1 from public.messenger_messages earlier where earlier.conversation_id=mm.conversation_id and earlier.seq<mm.seq and earlier.state in ('offered','sending','unknown'))
   order by mm.seq limit 1 for update of mm;
  if not found then return null; end if;
  token:=gen_random_uuid();
  insert into public.messenger_attempts(id,business_id,message_id,state) values(token,conn.business_id,m.id,'offered');
  update public.messenger_messages set state='offered',processing_token=token,lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=m.id;
  return jsonb_build_object('job_id',m.id,'attempt_id',token,'connection_id',conn.id);
 elsif op in ('authorize','result') then
  select * into a from public.messenger_attempts where id=(payload->>'attempt_id')::uuid and business_id=conn.business_id for update;
  if not found then return '{"allowed":false}'::jsonb; end if;
  select * into m from public.messenger_messages where id=a.message_id for update;
  select * into c from public.messenger_conversations where id=m.conversation_id for update;
  if op='result' then
   if a.state='accepted' then return '{"duplicate":true}'::jsonb; end if;
   if a.state not in ('sending','unknown') or m.processing_token is distinct from a.id then return '{"ignored":true}'::jsonb; end if;
   -- Only positive results prove provider acceptance. Every other result is unknown.
   body:=case when payload->>'outcome'='accepted' then 'accepted' else 'unknown' end;
   update public.messenger_attempts set state=body,finished_at=now(),provider_id=left(payload->>'provider_id',256),run_reference=left(payload->>'run_reference',256) where id=a.id;
   update public.messenger_messages set state=body,provider_id=left(payload->>'provider_id',256),error_code=case when body='unknown' then 'provider_outcome_unknown' end where id=m.id;
   if body='accepted' then update public.messenger_connections set last_accepted_at=now() where id=conn.id; end if;
   return jsonb_build_object('state',body);
  end if;
  if a.state<>'offered' or m.state<>'offered' or m.processing_token is distinct from a.id then return '{"allowed":false}'::jsonb; end if;
  valid:=m.lease_until>now() and (conn.enabled or (m.kind='probe' and conn.verified_at is null and c.sender_id=conn.probe_sender_id))
   and c.last_customer_at>now()-interval '24 hours'
   and ((m.kind='manual' and c.takeover) or (m.kind<>'manual' and not c.takeover))
   and (m.kind not in ('reply','probe') or m.conversation_version=c.version)
   and (m.kind<>'status' or exists(select 1 from public.orders where id=m.order_id and version=m.order_version));
  if m.business_version is not null then
   valid:=valid and exists(select 1 from public.businesses where id=conn.business_id and version=m.business_version);
   for source in select value from jsonb_array_elements(m.grounded_sources) loop
    valid:=valid and (exists(select 1 from public.products where business_id=conn.business_id and id=(source->>'id')::uuid and version=(source->>'version')::integer and active)
     or exists(select 1 from public.business_knowledge where business_id=conn.business_id and id=(source->>'id')::uuid and version=(source->>'version')::integer and approved)
     or (source->>'id'=conn.business_id::text and (source->>'version')::integer=m.business_version));
   end loop;
  end if;
  -- Summary facts must still be current at the actual send boundary.
  select * into s from public.messenger_summaries where message_id=m.id;
  if found then
   valid:=valid and s.valid and s.expires_at>now() and exists(select 1 from public.businesses where id=conn.business_id and version=s.business_version and rules_approved);
   for source in select value from jsonb_array_elements(s.sources) loop
    valid:=valid and exists(select 1 from public.products where business_id=conn.business_id and id=(source->>'id')::uuid and version=(source->>'version')::integer and active);
   end loop;
   for item in select value from jsonb_array_elements(s.draft->'items') loop
    valid:=valid and exists(select 1 from public.daily_allocations da where da.business_id=conn.business_id and da.product_id=(item->>'product_id')::uuid
     and da.business_date=(now() at time zone 'Asia/Manila')::date and da.total-da.used>=(item->>'quantity')::integer);
   end loop;
  end if;
  if not coalesce(valid,false) then
   update public.messenger_messages set state='suppressed',error_code='authorization_expired' where id=m.id;
   update public.messenger_attempts set state='suppressed',finished_at=now() where id=a.id;
   return '{"allowed":false}'::jsonb;
  end if;
  update public.messenger_messages set state='sending',lease_until=now()+interval '5 minutes' where id=m.id;
  update public.messenger_attempts set state='sending',authorized_at=now() where id=a.id;
  return jsonb_build_object('allowed',true,'text',m.body,'recipient_id',c.sender_id,'page_id',conn.page_id,'attempt_id',a.id,'language',c.reply_language,
   'code',case when m.kind='reply' then (select ms.code from public.messenger_summaries ms where ms.conversation_id=c.id and ms.valid and ms.expires_at>now() order by ms.created_at desc limit 1) end);
 elsif op='offer_failed' then
  -- Keep the same offered attempt until expiry: a timed-out hook may still run.
  update public.messenger_messages set error_code='zapier_handoff_failed' where business_id=conn.business_id and processing_token=(payload->>'attempt_id')::uuid and state='offered';
  return '{}'::jsonb;
 end if;
 raise exception 'unsupported_operation';
end $$;
