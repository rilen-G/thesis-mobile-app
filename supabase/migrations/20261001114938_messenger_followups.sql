-- Transactional follow-ups (SO6/SO10): per-conversation cases, two timed reminders, and stop checks. Off by default.
alter table public.messenger_connections add column followups_enabled boolean not null default false;
alter table public.messenger_messages drop constraint messenger_messages_kind_check,
 add constraint messenger_messages_kind_check check(kind in ('inbound','reply','manual','status','probe','followup'));
create table public.messenger_followups (
 id uuid primary key default gen_random_uuid(), business_id uuid not null, conversation_id uuid not null,
 trigger_type text not null check(trigger_type in ('inquiry','incomplete','draft')),
 detail text check(detail in ('item','quantity','pickup','payment')),
 source_message_id uuid not null, customer_at timestamptz not null, summary_id uuid references public.messenger_summaries(id),
 product_ids jsonb not null default '[]'::jsonb,
 fu1_template text not null, fu1_body text not null check(length(fu1_body) between 1 and 1000),
 fu2_template text not null, fu2_body text not null check(length(fu2_body) between 1 and 1000),
 status text not null default 'eligible_first' check(status in ('not_eligible','eligible_first','first_sent','eligible_second','second_sent',
  'recovered','closed_no_response','skipped_manual','skipped_closed','skipped_unavailable','skipped_window')),
 fu1_due_at timestamptz not null, fu1_sent_at timestamptz, fu1_message_id uuid,
 fu2_due_at timestamptz, fu2_sent_at timestamptz, fu2_message_id uuid,
 end_reason text, responded_at timestamptz, response_seconds integer, order_id uuid,
 created_at timestamptz not null default now(),
 foreign key(business_id,conversation_id) references public.messenger_conversations(business_id,id),
 foreign key(business_id,source_message_id) references public.messenger_messages(business_id,id),
 foreign key(business_id,order_id) references public.orders(business_id,id)
);
create unique index messenger_followups_open on public.messenger_followups(conversation_id) where status in ('eligible_first','first_sent','eligible_second','second_sent');
create index messenger_followups_due on public.messenger_followups(business_id,status,fu1_due_at);
alter table public.messenger_followups enable row level security;
revoke all on public.messenger_followups from public, anon, authenticated;
grant select on public.messenger_followups to authenticated;
create policy owner_read on public.messenger_followups for select to authenticated using (private.member_role(business_id) = 'owner');

create or replace function private.messenger_service(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 op text:=payload->>'op'; conn public.messenger_connections; c public.messenger_conversations;
 m public.messenger_messages; s public.messenger_summaries; a public.messenger_attempts;
 biz public.businesses; p public.products; item jsonb; source jsonb; result jsonb;
 mid uuid; token uuid; customer uuid; oid uuid; body text; code text; stamp timestamptz;
 total bigint:=0; amount integer; available integer; valid boolean:=true; probe boolean; tl boolean; label text;
 f public.messenger_followups; outcome text;
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
  update public.messenger_messages set state='suppressed',error_code='newer_message' where conversation_id=c.id and kind in ('inbound','reply','followup') and state in ('pending','processing','queued','offered');
  update public.messenger_summaries ms set valid=false where ms.conversation_id=c.id and ms.valid and
   upper(body) is distinct from 'CONFIRM '||ms.code and coalesce(payload->>'reply_kind','') not in ('yes','unclear','closing');
  insert into public.messenger_messages(business_id,conversation_id,external_id,role,body,state,kind,conversation_version,event_at,error_code)
  values(conn.business_id,c.id,payload->>'event_id','customer',body,
   case when (valid or (payload->>'reply_kind'='unclear' and exists(select 1 from public.messenger_summaries ms where ms.conversation_id=c.id and ms.valid and ms.expires_at>now())))
    and not c.takeover and (conn.enabled or probe) and stamp>now()-interval '24 hours' and coalesce(payload->>'reply_kind','') not in ('closing','opt_out') then 'pending' else 'done' end,
   'inbound',c.version,stamp,case when not valid then 'unsupported_message' end) returning id into mid;
  update public.messenger_followups mf set
   status=case when not x.sent or payload->>'reply_kind'='opt_out' then 'not_eligible' else 'recovered' end,
   end_reason=case when payload->>'reply_kind'='opt_out' then 'opt_out' when x.sent then 'customer_response'
    when payload->>'reply_kind'='closing' then 'closing_message' else 'customer_replied' end,
   responded_at=case when x.sent and valid then stamp end,
   response_seconds=case when x.sent and valid then extract(epoch from stamp-mf.fu1_sent_at)::integer end
   from (select mf3.id,exists(select 1 from public.messenger_messages fm where fm.id=mf3.fu1_message_id and fm.state in ('sending','accepted','unknown')) sent
    from public.messenger_followups mf3 where mf3.conversation_id=c.id and mf3.status in ('eligible_first','first_sent','eligible_second','second_sent')) x where mf.id=x.id;
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
   if s.order_id is not null then
    label:=coalesce(' ('||(select string_agg(oi.quantity||' × '||oi.name,', ' order by oi.name) from public.order_items oi where oi.order_id=s.order_id)||')','');
    body:=case when tl then 'Confirmed na po ang order na ito'||label||'. Ang staff na po ang bahala.' else 'Your order'||label||' is already confirmed. Staff will handle it.' end;
   elsif s.id is null or not s.valid or s.expires_at<=now() then body:=case when tl then 'Expired na po o nabago ang summary na iyan. Paki-send po ulit ang order niyo para sa bagong summary.' else 'That summary has expired or changed. Please send your order details again for a fresh summary.' end;
   else
    valid:=biz.rules_approved and biz.version=s.business_version
     and exists(select 1 from public.messenger_messages where id=s.message_id and state='accepted')
     and (s.draft->>'pickup_at')::timestamptz>now()
     and ((s.draft->>'pickup_at')::timestamptz at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date
     and ((s.draft->>'pickup_at')::timestamptz at time zone 'Asia/Manila')::time between biz.opening_time and biz.cutoff_time
     and lower(s.draft->>'payment_method') in ('cash','gcash');
    for item in select value from jsonb_array_elements(s.draft->'items') loop
     select * into p from public.products where id=(item->>'product_id')::uuid and business_id=conn.business_id;
     select da.total-da.used into available from public.daily_allocations da where da.business_id=conn.business_id and da.product_id=p.id and da.business_date=(now() at time zone 'Asia/Manila')::date;
     valid:=valid and coalesce(p.active,false) and coalesce(available,0)>=(item->>'quantity')::integer
      and exists(select 1 from jsonb_array_elements(s.sources) src where src->>'id'=p.id::text and (src->>'version')::integer=p.version);
     total:=total+p.price_centavos::bigint*(item->>'quantity')::integer;
    end loop;
    if valid then
     oid:=gen_random_uuid();
     insert into public.orders(id,business_id,customer_id,total_centavos,pickup_at,business_date,payment_method,reserved,notes)
     values(oid,conn.business_id,c.customer_id,total,(s.draft->>'pickup_at')::timestamptz,(now() at time zone 'Asia/Manila')::date,s.draft->>'payment_method',true,left(coalesce(s.draft->>'notes',''),200));
     insert into public.order_items(order_id,business_id,product_id,name,quantity,price_centavos)
      select oid,conn.business_id,pr.id,pr.name,(i->>'quantity')::integer,pr.price_centavos from jsonb_array_elements(s.draft->'items') i
      join public.products pr on pr.id=(i->>'product_id')::uuid and pr.business_id=conn.business_id;
     update public.daily_allocations da set used=da.used+(i->>'quantity')::integer,version=da.version+1 from jsonb_array_elements(s.draft->'items') i
      where da.business_id=conn.business_id and da.product_id=(i->>'product_id')::uuid and da.business_date=(now() at time zone 'Asia/Manila')::date;
     update public.messenger_conversations set order_id=oid where id=c.id;
     update public.messenger_summaries set order_id=oid,valid=false where id=s.id;
     update public.messenger_followups mf set order_id=oid,end_reason=case when mf.end_reason='customer_replied' then 'confirmed' else mf.end_reason end
      where mf.id=(select mf2.id from public.messenger_followups mf2 where mf2.conversation_id=c.id order by mf2.created_at desc limit 1);
     label:=coalesce(' ('||(select string_agg(oi.quantity||' × '||oi.name,', ' order by oi.name) from public.order_items oi where oi.order_id=oid)||')','');
     body:=case when tl then 'Confirmed na po ang order niyo'||label||' at naka-reserve na ang items. Imi-message namin kayo pag in-accept na ng staff.' else 'Your order'||label||' is confirmed and your items are reserved. We will message you when staff accepts it.' end;
    else
     update public.messenger_summaries set valid=false where id=s.id;
     body:=case when tl then 'Nagbago po ang availability, oras, o detalye ng order. I-message po ang owner o i-send ulit ang order para sa bagong summary.' else 'Availability, hours, or order details changed. Please contact the owner or send your order again for a fresh summary.' end;
    end if;
   end if;
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
  if not probe and jsonb_typeof(payload->'draft')='object' and not (upper(trim(m.body)) ~ '^CONFIRM ') then
   if not biz.rules_approved then
    update public.messenger_messages set body=case when tl then 'Kailangan pa pong i-approve ng owner ang ordering rules bago kami makatanggap ng order.' else 'The owner must approve the ordering rules before we can take your order.' end where id=mid;
   else
    code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    update public.messenger_summaries set valid=false where conversation_id=c.id;
    insert into public.messenger_summaries(business_id,conversation_id,message_id,code,draft,sources,business_version,expires_at)
    values(conn.business_id,c.id,mid,code,payload->'draft',payload->'sources',biz.version,least(now()+interval '24 hours',((now() at time zone 'Asia/Manila')::date+biz.cutoff_time) at time zone 'Asia/Manila'));
   end if;
  end if;
  if not probe and conn.followups_enabled and jsonb_typeof(payload->'followup')='object' and payload->'followup'->>'trigger' in ('inquiry','incomplete','draft')
   and exists(select 1 from public.messenger_messages mm where mm.id=mid and mm.state='queued')
   and (payload->'followup'->>'trigger'<>'draft' or exists(select 1 from public.messenger_summaries ms where ms.message_id=mid)) then
   update public.messenger_followups mf set status='not_eligible',end_reason='superseded' where mf.conversation_id=c.id and mf.status in ('eligible_first','first_sent','eligible_second','second_sent');
   insert into public.messenger_followups(business_id,conversation_id,trigger_type,detail,source_message_id,customer_at,summary_id,product_ids,fu1_template,fu1_body,fu2_template,fu2_body,fu1_due_at)
   values(conn.business_id,c.id,payload->'followup'->>'trigger',payload->'followup'->>'detail',mid,coalesce(m.event_at,m.created_at),(select ms.id from public.messenger_summaries ms where ms.message_id=mid),
    coalesce(payload->'followup'->'product_ids','[]'::jsonb),payload->'followup'->>'fu1_template',payload->'followup'->>'fu1_body',payload->'followup'->>'fu2_template',payload->'followup'->>'fu2_body',
    coalesce(m.event_at,m.created_at)+interval '30 minutes');
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
   and (m.kind not in ('reply','probe','followup') or m.conversation_version=c.version)
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
   update public.messenger_messages set state='suppressed',error_code=case when m.kind='status' and not exists(select 1 from public.orders o where o.id=m.order_id and o.version=m.order_version)
    then 'status_superseded' else 'authorization_expired' end where id=m.id;
   update public.messenger_attempts set state='suppressed',finished_at=now() where id=a.id;
   return '{"allowed":false}'::jsonb;
  end if;
  update public.messenger_messages set state='sending',lease_until=now()+interval '5 minutes' where id=m.id;
  update public.messenger_attempts set state='sending',authorized_at=now() where id=a.id;
  return jsonb_build_object('allowed',true,'text',m.body,'recipient_id',c.sender_id,'page_id',conn.page_id,'attempt_id',a.id,'language',c.reply_language,
   'code',case when m.kind in ('reply','followup') then (select ms.code from public.messenger_summaries ms where ms.conversation_id=c.id and ms.valid and ms.expires_at>now() order by ms.created_at desc limit 1) end);
 elsif op='followups' then
  if not conn.followups_enabled then return '{"queued":0}'::jsonb; end if;
  select * into biz from public.businesses where id=conn.business_id;
  update public.messenger_followups mf set
   status=case when mm.state='accepted' then 'eligible_second' when mm.error_code in ('integration_paused','takeover_changed') then 'skipped_manual' else 'closed_no_response' end,
   end_reason=case when mm.state='accepted' then mf.end_reason when mm.error_code='integration_paused' then 'ai_paused' when mm.error_code='takeover_changed' then 'manual_handling' else 'send_'||mm.state end
   from public.messenger_messages mm where mf.business_id=conn.business_id and mf.status='first_sent' and mm.id=mf.fu1_message_id and mm.state in ('accepted','suppressed','failed','unknown');
  update public.messenger_followups mf set status='closed_no_response',end_reason='no_response'
   where mf.business_id=conn.business_id and mf.status in ('eligible_second','second_sent') and mf.fu1_sent_at<=now()-interval '24 hours';
  total:=0;
  for f in select mf.* from public.messenger_followups mf where mf.business_id=conn.business_id
   and ((mf.status='eligible_first' and mf.fu1_due_at<=now()) or (mf.status='eligible_second' and mf.fu2_due_at<=now())) order by mf.created_at for update of mf loop
   select * into c from public.messenger_conversations where id=f.conversation_id for update;
   select * into s from public.messenger_summaries where id=f.summary_id;
   outcome:=case when not conn.enabled then 'skipped_manual:ai_paused'
    when c.takeover then 'skipped_manual:manual_handling'
    when c.last_customer_at<=now()-interval '24 hours' then 'skipped_window:window_expired'
    when (now() at time zone 'Asia/Manila')::time not between biz.opening_time and biz.cutoff_time then 'skipped_closed:business_closed'
    when exists(select 1 from jsonb_array_elements_text(f.product_ids) pid left join public.products pr on pr.id=pid.value::uuid and pr.business_id=conn.business_id
     left join public.daily_allocations da on da.product_id=pr.id and da.business_id=conn.business_id and da.business_date=(now() at time zone 'Asia/Manila')::date
     where not coalesce(pr.active,false) or coalesce(da.total-da.used,0)<=0) then 'skipped_unavailable:item_unavailable'
    when f.trigger_type='draft' and (s.id is null or not s.valid or s.order_id is not null or s.expires_at<=now() or (s.draft->>'pickup_at')::timestamptz<=now()) then 'closed_no_response:draft_expired' end;
   if outcome is not null then
    update public.messenger_followups mf set status=split_part(outcome,':',1),end_reason=split_part(outcome,':',2) where mf.id=f.id;
   elsif f.status='eligible_first' then
    mid:=private.messenger_enqueue(c.id,f.fu1_body,'followup');
    update public.messenger_followups mf set status='first_sent',fu1_sent_at=now(),fu1_message_id=mid,fu2_due_at=now()+interval '2 hours' where mf.id=f.id;
    total:=total+1;
   else
    mid:=private.messenger_enqueue(c.id,f.fu2_body,'followup');
    update public.messenger_followups mf set status='second_sent',fu2_sent_at=now(),fu2_message_id=mid where mf.id=f.id;
    total:=total+1;
   end if;
  end loop;
  return jsonb_build_object('queued',total);
 elsif op='offer_failed' then
  -- Keep the same offered attempt until expiry: a timed-out hook may still run.
  update public.messenger_messages set error_code='zapier_handoff_failed' where business_id=conn.business_id and processing_token=(payload->>'attempt_id')::uuid and state='offered';
  return '{}'::jsonb;
 end if;
 raise exception 'unsupported_operation';
end $$;

create or replace function private.messenger_command(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare bid uuid:=(payload->>'business_id')::uuid; actor uuid:=auth.uid(); req uuid:=(payload->>'request_id')::uuid;
 op text:=payload->>'op'; c public.messenger_conversations; conn public.messenger_connections; m public.messenger_messages;
 previous private.messenger_requests; rid uuid; result jsonb;
begin
 if actor is null or private.member_role(bid) is distinct from 'owner' then raise exception 'permission_denied' using errcode='42501'; end if;
 if req is null or length(payload::text)>6000 then raise exception 'invalid_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended(bid::text,2));
 select * into previous from private.messenger_requests where actor_id=actor and request_id=req;
 if found then if previous.payload<>payload then raise exception 'request_conflict'; end if; return previous.result; end if;
 select * into strict conn from public.messenger_connections where business_id=bid for update;
 rid:=conn.id;
 if op='verify' then
  if not exists(select 1 from public.messenger_messages where business_id=bid and kind='probe' and state='accepted') then raise exception 'Complete the Messenger reply test first.'; end if;
  update public.messenger_connections set verified_at=now(),version=version+1 where id=conn.id;
 elsif op='enabled' then
  if conn.version is distinct from (payload->>'version')::integer then raise exception 'conflict'; end if;
  if (payload->>'enabled')::boolean and conn.verified_at is null then raise exception 'Verify the Page connection first.'; end if;
  update public.messenger_connections set enabled=(payload->>'enabled')::boolean,version=version+1 where id=conn.id;
  if not (payload->>'enabled')::boolean then
   update public.messenger_messages set state='suppressed',error_code='integration_paused' where business_id=bid and state in ('queued','offered','pending','processing');
   update public.messenger_summaries set valid=false where business_id=bid;
  end if;
 elsif op='followups' then
  if conn.version is distinct from (payload->>'version')::integer then raise exception 'conflict'; end if;
  update public.messenger_connections set followups_enabled=(payload->>'enabled')::boolean,version=version+1 where id=conn.id;
  if not (payload->>'enabled')::boolean then
   update public.messenger_followups set status='skipped_manual',end_reason='disabled' where business_id=bid and status in ('eligible_first','first_sent','eligible_second','second_sent');
  end if;
 else
  select * into strict c from public.messenger_conversations where id=(payload->>'conversation_id')::uuid and business_id=bid for update;
  rid:=c.id;
  if c.version is distinct from (payload->>'version')::integer then raise exception 'conflict'; end if;
  if op='takeover' then
   update public.messenger_conversations set takeover=(payload->>'takeover')::boolean,version=version+1,needs_attention=false,updated_at=now() where id=c.id returning * into c;
   update public.messenger_messages set state='suppressed',error_code='takeover_changed' where conversation_id=c.id and state in ('queued','offered','pending','processing');
   update public.messenger_summaries set valid=false where conversation_id=c.id;
   if not c.takeover and conn.enabled then
    select * into m from public.messenger_messages where conversation_id=c.id order by seq desc limit 1;
    if m.role='customer' and m.error_code is distinct from 'unsupported_message' and c.last_customer_at>now()-interval '24 hours' then update public.messenger_messages set state='pending',conversation_version=c.version,attempts=0 where id=m.id; end if;
   end if;
  elsif op='reply' then
   if not c.takeover or not conn.enabled or c.last_customer_at<=now()-interval '24 hours' then raise exception 'Take over an active conversation within the messaging window before replying.'; end if;
   if length(trim(coalesce(payload->>'body',''))) not between 1 and 3900 then raise exception 'invalid_reply'; end if;
   rid:=private.messenger_enqueue(c.id,trim(payload->>'body'),'manual');
   update public.messenger_conversations set version=version+1,updated_at=now() where id=c.id;
  elsif op in ('retry','reconcile') then
   select * into strict m from public.messenger_messages where id=(payload->>'message_id')::uuid and conversation_id=c.id for update;
   if op='retry' then
    if m.state<>'failed' or not conn.enabled or c.last_customer_at<=now()-interval '24 hours' then raise exception 'This message cannot be retried safely.'; end if;
    if m.role='customer' then
     if c.takeover or m.conversation_version<>c.version then raise exception 'This message cannot be retried safely.'; end if;
     update public.messenger_messages set state='pending',error_code=null,next_attempt_at=now() where id=m.id;
    else
     if m.error_code is distinct from 'handoff_exhausted' or exists(select 1 from public.messenger_attempts where message_id=m.id and state in ('sending','unknown','accepted')) then raise exception 'Reconcile the external outcome before retrying.'; end if;
     update public.messenger_messages set state='queued',attempts=0,error_code=null,next_attempt_at=now() where id=m.id;
    end if;
   else
    if m.state<>'unknown' or payload->>'outcome' not in ('accepted','not_sent') or length(trim(coalesce(payload->>'note','')))<5 then raise exception 'Review Messenger and Zap history, then record the outcome and evidence.'; end if;
    update public.messenger_messages set state=case when payload->>'outcome'='accepted' then 'accepted' else 'suppressed' end,error_code='owner_reconciled' where id=m.id;
    update public.messenger_attempts set state=case when payload->>'outcome'='accepted' then 'accepted' else 'suppressed' end,finished_at=now() where id=m.processing_token;
   end if;
   rid:=m.id;
  else raise exception 'unsupported_operation'; end if;
 end if;
 insert into public.audit_events(business_id,actor_id,action,record_id,detail)
 values(bid,actor,'messenger_'||op,rid,jsonb_build_object('note',left(payload->>'note',500),'outcome',payload->>'outcome'));
 result:=jsonb_build_object('id',rid);
 insert into private.messenger_requests values(actor,req,payload,result);
 return result;
end $$;
