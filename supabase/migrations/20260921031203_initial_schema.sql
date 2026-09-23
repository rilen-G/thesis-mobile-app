-- Application baseline, consolidated 2026-09-21.
-- Recreates the eight-migration application schema; contains no tenant/demo records.
-- Supabase supplies auth/storage schemas. Do not run against an existing application schema.

--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: private; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA private;


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: chat_command(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.chat_command(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
 bid uuid:=(payload->>'business_id')::uuid; rid uuid:=(payload->>'id')::uuid;
 req uuid:=(payload->>'request_id')::uuid; actor uuid:=auth.uid(); op text:=payload->>'op';
 c public.test_conversations; m public.test_messages; previous private.test_requests;
 result jsonb; changed integer;
begin
 if actor is null or private.member_role(bid) is distinct from 'owner' then raise exception 'permission_denied' using errcode='42501'; end if;
 if req is null or rid is null or op is null or length(payload::text)>65536 then raise exception 'Invalid request' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||req::text,0));
 select * into previous from private.test_requests where actor_id=actor and request_id=req;
 if found then
  if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
  return previous.result;
 end if;
 perform 1 from public.businesses where id=bid for update;
 if op in ('create_order','transition_order','update_order','set_allocation') then
  return private.test_command_v2(payload);
 elsif op='knowledge' then
  if (payload->>'version')::integer=0 then
   insert into public.business_knowledge(id,business_id,title,body,approved) values(rid,bid,payload->>'title',payload->>'body',(payload->>'approved')::boolean);
  else
   update public.business_knowledge set title=payload->>'title',body=payload->>'body',approved=(payload->>'approved')::boolean,version=version+1 where id=rid and business_id=bid and version=(payload->>'version')::integer;
   get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
  end if;
  insert into public.knowledge_versions(business_id,id,version,title,body,approved)
   select business_id,id,version,title,body,approved from public.business_knowledge where id=rid and business_id=bid;
 elsif op='conversation' then
  insert into public.test_conversations(id,business_id) values(rid,bid);
  insert into public.test_customers(id,business_id,name) values(rid,bid,'Test customer');
 elsif op in ('takeover','message') then
  select * into c from public.test_conversations where id=(case when op='takeover' then rid else (payload->>'conversation_id')::uuid end) and business_id=bid for update;
  if not found then raise exception 'Conversation not found' using errcode='22023'; end if;
  if op='takeover' then
   if c.version is distinct from (payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
   update public.test_conversations set takeover=(payload->>'takeover')::boolean,version=version+1 where id=rid;
   if (payload->>'takeover')::boolean then update public.test_messages set state='suppressed' where conversation_id=rid and state in ('pending','failed'); end if;
  else
   if payload->>'role' not in ('customer','owner') or payload->>'role' is null then raise exception 'Invalid role' using errcode='22023'; end if;
   if payload->>'role'='owner' and not c.takeover then raise exception 'Take over before replying' using errcode='22023'; end if;
   if exists(select 1 from public.test_messages where conversation_id=c.id and state in ('pending','failed')) then raise exception 'Retry the pending reply or take over first' using errcode='22023'; end if;
   insert into public.test_messages(id,business_id,conversation_id,role,body,state) values(rid,bid,c.id,payload->>'role',trim(payload->>'body'),case when payload->>'role'='customer' and not c.takeover then 'pending' else 'done' end);
  end if;
 else raise exception 'Unsupported test command' using errcode='22023'; end if;
 insert into public.test_audit_events(business_id,actor_id,action,record_id) values(bid,actor,op,rid);
 result:=jsonb_build_object('id',rid);
 insert into private.test_requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
 return result;
end $$;


--
-- Name: claim_test_reply(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.claim_test_reply(message_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare m public.test_messages; c public.test_conversations; token uuid:=gen_random_uuid();
begin
 select * into m from public.test_messages where id=message_id;
 if not found or private.member_role(m.business_id) is distinct from 'owner' then raise exception 'permission_denied'; end if;
 select * into c from public.test_conversations where id=m.conversation_id for update;
 select * into m from public.test_messages where id=message_id for update;
 if c.takeover or m.role<>'customer' or m.state not in ('pending','failed') or m.processing_until>now() then return null; end if;
 if (select count(*) from public.ai_evaluations where business_id=m.business_id and created_at>now()-interval '1 hour')>=120 then raise exception 'Test AI hourly limit reached'; end if;
 update public.test_messages set processing_token=token,processing_until=now()+interval '45 seconds' where id=message_id;
 return token;
end $$;


--
-- Name: command(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.command(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid := auth.uid(); req uuid := (payload->>'request_id')::uuid;
  bid uuid := (payload->>'business_id')::uuid; rid uuid := coalesce((payload->>'id')::uuid,gen_random_uuid());
  op text := payload->>'op'; role_name text; previous private.requests; result jsonb;
  biz public.businesses; prod public.products; ord public.orders; alloc public.daily_allocations;
  row_item record; j jsonb; today date := (now() at time zone 'Asia/Manila')::date;
  pickup timestamptz; next_status text; qty integer; order_total bigint := 0; changed integer;
  detail jsonb := '{}'; target_user uuid; photo text;
begin
  if actor is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if req is null or op is null then raise exception 'request_id and op are required' using errcode='22023'; end if;
  if length(payload::text)>65536 then raise exception 'Request is too large' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || req::text,0));
  select * into previous from private.requests where actor_id=actor and request_id=req;
  if found then
    if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
    if op<>'create_business' and private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
    return previous.result;
  end if;
  if op='create_business' then
    perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
    if exists(select 1 from public.business_members where user_id=actor) then raise exception 'Account already belongs to a business' using errcode='22023'; end if;
    insert into public.businesses(id,name) values(rid,trim(payload->>'name'));
    insert into public.business_members(business_id,user_id,role) values(rid,actor,'owner');
    bid := rid;
  else
    -- This serializes all availability mutations, including adjustments and cancellations.
    perform pg_advisory_xact_lock(hashtextextended(bid::text,2));
    role_name := private.member_role(bid);
    if role_name is null then raise exception 'permission_denied' using errcode='42501'; end if;
    if op in ('save_business','save_product','set_allocation','add_staff','remove_staff') and role_name<>'owner' then raise exception 'permission_denied' using errcode='42501'; end if;
    select * into strict biz from public.businesses where id=bid;
    if op in ('save_business','save_product','set_allocation','save_customer','update_order','transition_order')
      and ((payload->>'version')::integer is null or (payload->>'version')::integer < 0)
      then raise exception 'A nonnegative record version is required' using errcode='22023'; end if;

    if op='save_business' then
      update public.businesses set name=trim(payload->>'name'),address=coalesce(payload->>'address',''),
        opening_time=(payload->>'opening_time')::time,cutoff_time=(payload->>'cutoff_time')::time,
        rules_approved=(payload->>'rules_approved')::boolean,restore_before_preparing=(payload->>'restore_before_preparing')::boolean,
        default_post_format=payload->>'default_post_format',version=version+1
        where id=bid and version=(payload->>'version')::integer;
      get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      rid:=bid; detail:=jsonb_build_object('rules_approved',payload->'rules_approved','restore_before_preparing',payload->'restore_before_preparing','opening_time',payload->>'opening_time','cutoff_time',payload->>'cutoff_time');
    elsif op='add_staff' then
      select id into target_user from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
      if target_user is null then raise exception 'Staff must first register and verify this email' using errcode='22023'; end if;
      insert into public.business_members(business_id,user_id,role,display_name) values(bid,target_user,'staff',lower(trim(payload->>'email'))); rid:=target_user;
    elsif op='remove_staff' then
      delete from public.business_members where business_id=bid and user_id=rid and role='staff';
      get diagnostics changed=row_count; if changed<>1 then raise exception 'Staff membership not found' using errcode='22023'; end if;
    elsif op='save_product' then
      photo:=nullif(payload->>'photo_path','');
      if photo is not null and (split_part(photo,'/',1)<>bid::text or split_part(photo,'/',2)<>rid::text or not exists(select 1 from storage.objects where bucket_id='product-photos' and name=photo)) then raise exception 'Invalid product photo' using errcode='22023'; end if;
      if (payload->>'version')::integer=0 then
        insert into public.products(id,business_id,name,description,price_centavos,active,photo_path)
        values(rid,bid,trim(payload->>'name'),coalesce(payload->>'description',''),(payload->>'price_centavos')::integer,(payload->>'active')::boolean,photo);
      else
        update public.products set name=trim(payload->>'name'),description=coalesce(payload->>'description',''),price_centavos=(payload->>'price_centavos')::integer,
          active=(payload->>'active')::boolean,photo_path=photo,version=version+1 where id=rid and business_id=bid and version=(payload->>'version')::integer;
        get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      end if;
    elsif op='set_allocation' then
      if length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'Adjustment reason is required' using errcode='22023'; end if;
      if (payload->>'business_date')::date is distinct from today then raise exception 'Only today can be adjusted' using errcode='22023'; end if;
      select * into alloc from public.daily_allocations where product_id=rid and business_date=today and business_id=bid;
      if not found then
        if (payload->>'version')::integer<>0 then raise exception 'conflict' using errcode='40001'; end if;
        insert into public.daily_allocations(product_id,business_id,business_date,total) values(rid,bid,today,(payload->>'total')::integer);
      else
        if alloc.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
        if (payload->>'total')::integer < alloc.used then raise exception 'Total cannot be below the already allocated quantity' using errcode='22023'; end if;
        update public.daily_allocations set total=(payload->>'total')::integer,version=version+1 where product_id=rid and business_date=today;
      end if;
      detail:=jsonb_build_object('business_date',today,'previous_total',coalesce(alloc.total,0),'total',payload->'total','reason',left(payload->>'reason',500));
    elsif op='save_customer' then
      if (payload->>'version')::integer=0 then
        insert into public.customers(id,business_id,name,phone,notes) values(rid,bid,trim(payload->>'name'),coalesce(payload->>'phone',''),coalesce(payload->>'notes',''));
      else
        update public.customers set name=trim(payload->>'name'),phone=coalesce(payload->>'phone',''),notes=coalesce(payload->>'notes',''),
          archived=(payload->>'archived')::boolean,version=version+1 where id=rid and business_id=bid and version=(payload->>'version')::integer;
        get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      end if;
    elsif op='create_order' then
      pickup:=(payload->>'pickup_at')::timestamptz;
      if (pickup at time zone 'Asia/Manila')::date is distinct from today then raise exception 'Only same-day pickup is supported' using errcode='22023'; end if;
      if not exists(select 1 from public.customers where id=(payload->>'customer_id')::uuid and business_id=bid and not archived) then raise exception 'Select an active customer' using errcode='22023'; end if;
      if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Select between 1 and 100 order items' using errcode='22023'; end if;
      insert into public.orders(id,business_id,customer_id,total_centavos,pickup_at,business_date,payment_method,notes)
        values(rid,bid,(payload->>'customer_id')::uuid,0,pickup,today,trim(payload->>'payment_method'),coalesce(payload->>'notes',''));
      for j in select value from jsonb_array_elements(payload->'items') loop
        select * into prod from public.products where id=(j->>'product_id')::uuid and business_id=bid and active;
        if not found then raise exception 'An item is unavailable' using errcode='22023'; end if;
        qty:=(j->>'quantity')::integer;
        insert into public.order_items(order_id,business_id,product_id,name,quantity,price_centavos) values(rid,bid,prod.id,prod.name,qty,prod.price_centavos);
        order_total:=order_total+prod.price_centavos::bigint*qty;
      end loop;
      update public.orders set total_centavos=order_total where id=rid;
    elsif op='update_order' then
      select * into ord from public.orders where id=rid and business_id=bid;
      if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
      if ord.status<>'confirmed' then raise exception 'Only confirmed order details may be edited before acceptance' using errcode='22023'; end if;
      pickup:=(payload->>'pickup_at')::timestamptz;
      if (pickup at time zone 'Asia/Manila')::date is distinct from ord.business_date then raise exception 'Pickup must remain on the order business date' using errcode='22023'; end if;
      update public.orders set pickup_at=pickup,payment_method=trim(payload->>'payment_method'),notes=coalesce(payload->>'notes',''),version=version+1 where id=rid;
    elsif op='transition_order' then
      select * into ord from public.orders where id=rid and business_id=bid for update;
      if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
      next_status:=payload->>'status';
      if next_status is null or not (
        (ord.status='confirmed' and next_status in ('accepted','rejected','expired')) or
        (ord.status='accepted' and next_status in ('ready','rejected')) or
        (ord.status='ready' and next_status='completed')
      ) then raise exception 'invalid_transition' using errcode='22023'; end if;
      if next_status='rejected' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'A reason is required' using errcode='22023'; end if;
      if next_status='accepted' then
        if not biz.rules_approved then raise exception 'rules_required' using errcode='22023'; end if;
        if ord.business_date<>today or ord.pickup_at<=now() or (now() at time zone 'Asia/Manila')::time<biz.opening_time
          or (now() at time zone 'Asia/Manila')::time>=biz.cutoff_time
          or (ord.pickup_at at time zone 'Asia/Manila')::time<biz.opening_time or (ord.pickup_at at time zone 'Asia/Manila')::time>biz.cutoff_time
        then raise exception 'pickup_closed' using errcode='22023'; end if;
        for row_item in select * from public.order_items where order_id=rid order by product_id loop
          if not exists(select 1 from public.products where id=row_item.product_id and active) then raise exception 'An item is unavailable' using errcode='22023'; end if;
          update public.daily_allocations set used=used+row_item.quantity,version=version+1
            where product_id=row_item.product_id and business_date=ord.business_date and total-used>=row_item.quantity;
          get diagnostics changed=row_count; if changed<>1 then raise exception 'insufficient_quantity' using errcode='22023'; end if;
        end loop;
        update public.orders set restore_before_preparing=biz.restore_before_preparing where id=rid;
      elsif next_status='rejected' and ord.status='accepted' and ord.restore_before_preparing then
        for row_item in select * from public.order_items where order_id=rid order by product_id loop
          update public.daily_allocations set used=used-row_item.quantity,version=version+1 where product_id=row_item.product_id and business_date=ord.business_date;
        end loop;
      end if;
      update public.orders set status=next_status,version=version+1 where id=rid;
      detail:=jsonb_build_object('from',ord.status,'to',next_status,'reason',left(payload->>'reason',500));
    else raise exception 'Unsupported operation' using errcode='22023';
    end if;
  end if;
  insert into public.audit_events(business_id,actor_id,action,record_id,detail) values(bid,actor,op,rid,detail);
  result:=jsonb_build_object('id',rid);
  insert into private.requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
  return result;
end $$;


--
-- Name: command_v2(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.command_v2(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid := auth.uid();
  req uuid := (payload->>'request_id')::uuid;
  bid uuid := (payload->>'business_id')::uuid;
  rid uuid := (payload->>'id')::uuid;
  op text := payload->>'op';
  previous private.requests;
  result jsonb;
  biz public.businesses;
  ord public.orders;
  row_item record;
  next_status text;
  today date := (now() at time zone 'Asia/Manila')::date;
  changed integer;
  pickup timestamptz;
  detail jsonb := '{}';
begin
  if op not in ('update_order','transition_order') then
    return private.command(payload);
  end if;
  if actor is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if req is null or bid is null or rid is null then raise exception 'request_id, business_id, and id are required' using errcode='22023'; end if;
  if length(payload::text)>65536 then raise exception 'Request is too large' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || req::text,0));
  select * into previous from private.requests where actor_id=actor and request_id=req;
  if found then
    if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
    if private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
    return previous.result;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(bid::text,2));
  if private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if (payload->>'version')::integer is null or (payload->>'version')::integer < 0 then raise exception 'A nonnegative record version is required' using errcode='22023'; end if;
  select * into strict biz from public.businesses where id=bid;
  select * into ord from public.orders where id=rid and business_id=bid for update;
  if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;

  if op='update_order' then
    if ord.status<>'confirmed' then raise exception 'Only confirmed order details may be edited before acceptance' using errcode='22023'; end if;
    pickup:=(payload->>'pickup_at')::timestamptz;
    if (pickup at time zone 'Asia/Manila')::date is distinct from ord.business_date then raise exception 'Pickup must remain on the order business date' using errcode='22023'; end if;
    update public.orders set pickup_at=pickup,payment_method=trim(payload->>'payment_method'),
      notes=coalesce(payload->>'notes',''),version=version+1 where id=rid;
  else
    next_status:=payload->>'status';
    if next_status is null or not (
      (ord.status='confirmed' and next_status in ('accepted','rejected','expired')) or
      (ord.status='accepted' and next_status in ('ready','rejected')) or
      (ord.status='ready' and next_status='completed')
    ) then raise exception 'invalid_transition' using errcode='22023'; end if;
    if next_status='rejected' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'A reason is required' using errcode='22023'; end if;

    if next_status='accepted' then
      if not biz.rules_approved then raise exception 'rules_required' using errcode='22023'; end if;
      if ord.business_date<>today or ord.pickup_at<=now() or (now() at time zone 'Asia/Manila')::time<biz.opening_time
        or (now() at time zone 'Asia/Manila')::time>=biz.cutoff_time
        or (ord.pickup_at at time zone 'Asia/Manila')::time<biz.opening_time
        or (ord.pickup_at at time zone 'Asia/Manila')::time>biz.cutoff_time
      then raise exception 'pickup_closed' using errcode='22023'; end if;
      for row_item in select * from public.order_items where order_id=rid order by product_id loop
        if not exists(select 1 from public.products where id=row_item.product_id and active) then raise exception 'An item is unavailable' using errcode='22023'; end if;
        update public.daily_allocations set used=used+row_item.quantity,version=version+1
          where product_id=row_item.product_id and business_date=ord.business_date and total-used>=row_item.quantity;
        get diagnostics changed=row_count;
        if changed<>1 then raise exception 'insufficient_quantity' using errcode='22023'; end if;
      end loop;
      update public.orders set restore_before_preparing=biz.restore_before_preparing where id=rid;
    elsif next_status='rejected' and ord.status='accepted' and ord.restore_before_preparing then
      for row_item in select * from public.order_items where order_id=rid order by product_id loop
        update public.daily_allocations set used=used-row_item.quantity,version=version+1
          where product_id=row_item.product_id and business_date=ord.business_date;
      end loop;
    end if;

    update public.orders set status=next_status,version=version+1 where id=rid;
    detail:=jsonb_build_object('from',ord.status,'to',next_status,'reason',left(payload->>'reason',500));
  end if;

  insert into public.audit_events(business_id,actor_id,action,record_id,detail) values(bid,actor,op,rid,detail);
  result:=jsonb_build_object('id',rid);
  insert into private.requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
  return result;
end $$;


--
-- Name: command_v3(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.command_v3(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  result jsonb;
  replay boolean;
  category_name text;
begin
  if payload->>'op' = 'save_product' then
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || (payload->>'request_id')::uuid::text,0));
    select exists(select 1 from private.requests
      where actor_id=auth.uid() and request_id=(command_v3.payload->>'request_id')::uuid) into replay;
  end if;
  result := private.command_v2(payload);
  if payload->>'op' = 'save_product' and not replay and payload ? 'category' then
    category_name := btrim(payload->>'category');
    if payload->'category' <> 'null'::jsonb and
      (jsonb_typeof(payload->'category') <> 'string' or length(category_name) not between 1 and 40
       or lower(category_name) in ('all','uncategorized') or category_name ~ '[[:cntrl:]]') then
      raise exception 'Invalid menu category' using errcode='22023';
    end if;
    -- Reuse the business's spelling to avoid Coffee/coffee duplicate filters.
    select coalesce((select p.category from public.products p
      where p.business_id=(payload->>'business_id')::uuid and lower(p.category)=lower(category_name)
      order by p.category limit 1),category_name) into category_name;
    update public.products set category=category_name
      where id=(result->>'id')::uuid and business_id=(payload->>'business_id')::uuid;
  end if;
  return result;
end $$;


--
-- Name: confirm_test_draft(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.confirm_test_draft(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
 actor uuid:=auth.uid(); bid uuid:=(payload->>'business_id')::uuid;
 rid uuid:=(payload->>'id')::uuid; req uuid:=(payload->>'request_id')::uuid;
 previous private.test_requests; m public.test_messages; c public.test_conversations;
 draft jsonb; item jsonb; canonical jsonb;
begin
 if actor is null or private.member_role(bid) is distinct from 'owner' then raise exception 'permission_denied' using errcode='42501'; end if;
 if rid is null or req is null or payload->>'op' is distinct from 'confirm_draft' or length(payload::text)>1000 then raise exception 'Invalid request' using errcode='22023'; end if;
 if payload - array['op','business_id','id','request_id'] <> '{}'::jsonb then raise exception 'Only a saved draft can be confirmed' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||req::text,0));
 select * into previous from private.test_requests where actor_id=actor and request_id=req;
 if found then
  if previous.payload->>'approval_message_id' is distinct from rid::text or previous.payload->>'business_id' is distinct from bid::text then raise exception 'request_conflict' using errcode='22023'; end if;
  return previous.result;
 end if;
 perform 1 from public.businesses where id=bid for update;
 select * into m from public.test_messages where id=rid and business_id=bid and role='assistant';
 if not found or jsonb_typeof(m.result->'draft') is distinct from 'object' then raise exception 'No reviewable draft' using errcode='22023'; end if;
 select * into c from public.test_conversations where id=m.conversation_id for update;
 if c.takeover or exists(select 1 from public.test_messages where conversation_id=c.id and created_at>m.created_at) then raise exception 'draft_changed' using errcode='40001'; end if;
 -- A second click with a new request ID still returns the same existing order.
 if exists(select 1 from public.test_orders where id=rid and business_id=bid) then return jsonb_build_object('id',rid); end if;
 draft:=m.result->'draft';
 if jsonb_typeof(draft->'items') is distinct from 'array' or jsonb_array_length(draft->'items') not between 1 and 100 then raise exception 'Invalid draft' using errcode='22023'; end if;
 for item in select value from jsonb_array_elements(draft->'items') loop
  if not exists(
   select 1 from public.products p join jsonb_array_elements(m.result->'sources') source on p.id=(source->>'id')::uuid and p.version=(source->>'version')::integer
   where p.id=(item->>'product_id')::uuid and p.business_id=bid and p.active
  ) then raise exception 'draft_changed' using errcode='40001'; end if;
 end loop;
 canonical:=jsonb_build_object('op','create_order','business_id',bid,'id',rid,'request_id',req,'approval_message_id',rid,
  'customer_id',c.id,'items',draft->'items','pickup_at',draft->>'pickup_at','payment_method',draft->>'payment_method');
 return private.test_command_v2(canonical);
end $$;


--
-- Name: finish_test_reply(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.finish_test_reply(payload jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare m public.test_messages; c public.test_conversations; outcome text;
begin
 select * into m from public.test_messages where id=(payload->>'message_id')::uuid;
 if not found or m.role<>'customer' then raise exception 'Invalid message'; end if;
 select * into c from public.test_conversations where id=m.conversation_id for update;
 select * into m from public.test_messages where id=m.id for update;
 if m.state not in ('pending','failed') then return; end if;
 if private.member_role(m.business_id) is distinct from 'owner' then raise exception 'permission_denied'; end if;
 if m.processing_token is null or m.processing_token is distinct from (payload->>'processing_token')::uuid then raise exception 'Stale reply worker'; end if;
   outcome:=payload->>'outcome';
   if outcome in ('validated','escalated') and exists(
    select 1 from jsonb_array_elements(coalesce(payload->'sources','[]'::jsonb)) s
    where not exists(select 1 from public.products p where p.business_id=m.business_id and p.id=(s->>'id')::uuid and p.active and p.version=(s->>'version')::integer)
      and not exists(select 1 from public.business_knowledge k where k.business_id=m.business_id and k.id=(s->>'id')::uuid and k.approved and k.version=(s->>'version')::integer)
      and not exists(select 1 from public.businesses b where b.id=m.business_id and b.id=(s->>'id')::uuid and b.version=(s->>'version')::integer)
   ) then outcome:='provider_failure'; end if;
 if c.takeover or c.version is distinct from (payload->>'conversation_version')::integer then outcome:='suppressed'; end if;
 if outcome='provider_failure' then
  update public.test_messages set state='failed' where id=m.id;
 elsif outcome='suppressed' then
  update public.test_messages set state='suppressed' where id=m.id;
 else
  insert into public.test_messages(id,business_id,conversation_id,role,body,reply_to,result)
   values(gen_random_uuid(),m.business_id,m.conversation_id,'assistant',payload->>'body',m.id,payload->'result');
  update public.test_messages set state='done' where id=m.id;
 end if;
 update public.test_messages set processing_token=null,processing_until=null where id=m.id;
 insert into public.ai_evaluations(business_id,message_id,prompt_version,model,latency_ms,input_tokens,output_tokens,estimated_cost_usd,sources,outcome)
 values(m.business_id,m.id,payload->>'prompt_version',payload->>'model',(payload->>'latency_ms')::integer,(payload->>'input_tokens')::integer,(payload->>'output_tokens')::integer,(payload->>'estimated_cost_usd')::numeric,coalesce(payload->'sources','[]'),outcome);
end $$;


--
-- Name: member_role(uuid); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.member_role(bid uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select role from public.business_members where business_id=bid and user_id=(select auth.uid())
$$;


--
-- Name: test_command(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.test_command(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid := auth.uid(); req uuid := (payload->>'request_id')::uuid;
  bid uuid := (payload->>'business_id')::uuid; rid uuid := coalesce((payload->>'id')::uuid,gen_random_uuid());
  op text := payload->>'op'; role_name text; previous private.test_requests; result jsonb;
  biz public.businesses; prod public.products; ord public.test_orders; alloc public.test_daily_allocations;
  row_item record; j jsonb; today date := (now() at time zone 'Asia/Manila')::date;
  pickup timestamptz; next_status text; qty integer; order_total bigint := 0; changed integer;
  detail jsonb := '{}'; target_user uuid; photo text;
begin
  if actor is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if req is null or op is null then raise exception 'request_id and op are required' using errcode='22023'; end if;
  if length(payload::text)>65536 then raise exception 'Request is too large' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text || req::text,0));
  select * into previous from private.test_requests where actor_id=actor and request_id=req;
  if found then
    if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
    if op<>'create_business' and private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
    return previous.result;
  end if;
  if op='create_business' then
    perform pg_advisory_xact_lock(hashtextextended(actor::text,1));
    if exists(select 1 from public.business_members where user_id=actor) then raise exception 'Account already belongs to a business' using errcode='22023'; end if;
    insert into public.businesses(id,name) values(rid,trim(payload->>'name'));
    insert into public.business_members(business_id,user_id,role) values(rid,actor,'owner');
    bid := rid;
  else
    -- This serializes all availability mutations, including adjustments and cancellations.
    perform pg_advisory_xact_lock(hashtextextended(bid::text,2));
    role_name := private.member_role(bid);
    if role_name is null then raise exception 'permission_denied' using errcode='42501'; end if;
    if op in ('save_business','save_product','set_allocation','add_staff','remove_staff') and role_name<>'owner' then raise exception 'permission_denied' using errcode='42501'; end if;
    select * into strict biz from public.businesses where id=bid;
    if op in ('save_business','save_product','set_allocation','save_customer','update_order','transition_order')
      and ((payload->>'version')::integer is null or (payload->>'version')::integer < 0)
      then raise exception 'A nonnegative record version is required' using errcode='22023'; end if;

    if op='save_business' then
      update public.businesses set name=trim(payload->>'name'),address=coalesce(payload->>'address',''),
        opening_time=(payload->>'opening_time')::time,cutoff_time=(payload->>'cutoff_time')::time,
        rules_approved=(payload->>'rules_approved')::boolean,restore_before_preparing=(payload->>'restore_before_preparing')::boolean,
        default_post_format=payload->>'default_post_format',version=version+1
        where id=bid and version=(payload->>'version')::integer;
      get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      rid:=bid; detail:=jsonb_build_object('rules_approved',payload->'rules_approved','restore_before_preparing',payload->'restore_before_preparing','opening_time',payload->>'opening_time','cutoff_time',payload->>'cutoff_time');
    elsif op='add_staff' then
      select id into target_user from auth.users where lower(email)=lower(trim(payload->>'email')) and email_confirmed_at is not null;
      if target_user is null then raise exception 'Staff must first register and verify this email' using errcode='22023'; end if;
      insert into public.business_members(business_id,user_id,role,display_name) values(bid,target_user,'staff',lower(trim(payload->>'email'))); rid:=target_user;
    elsif op='remove_staff' then
      delete from public.business_members where business_id=bid and user_id=rid and role='staff';
      get diagnostics changed=row_count; if changed<>1 then raise exception 'Staff membership not found' using errcode='22023'; end if;
    elsif op='save_product' then
      photo:=nullif(payload->>'photo_path','');
      if photo is not null and (split_part(photo,'/',1)<>bid::text or split_part(photo,'/',2)<>rid::text or not exists(select 1 from storage.objects where bucket_id='product-photos' and name=photo)) then raise exception 'Invalid product photo' using errcode='22023'; end if;
      if (payload->>'version')::integer=0 then
        insert into public.products(id,business_id,name,description,price_centavos,active,photo_path)
        values(rid,bid,trim(payload->>'name'),coalesce(payload->>'description',''),(payload->>'price_centavos')::integer,(payload->>'active')::boolean,photo);
      else
        update public.products set name=trim(payload->>'name'),description=coalesce(payload->>'description',''),price_centavos=(payload->>'price_centavos')::integer,
          active=(payload->>'active')::boolean,photo_path=photo,version=version+1 where id=rid and business_id=bid and version=(payload->>'version')::integer;
        get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      end if;
    elsif op='set_allocation' then
      if length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'Adjustment reason is required' using errcode='22023'; end if;
      if (payload->>'business_date')::date is distinct from today then raise exception 'Only today can be adjusted' using errcode='22023'; end if;
      select * into alloc from public.test_daily_allocations where product_id=rid and business_date=today and business_id=bid;
      if not found then
        if (payload->>'version')::integer<>0 then raise exception 'conflict' using errcode='40001'; end if;
        insert into public.test_daily_allocations(product_id,business_id,business_date,total) values(rid,bid,today,(payload->>'total')::integer);
      else
        if alloc.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
        if (payload->>'total')::integer < alloc.used then raise exception 'Total cannot be below the already allocated quantity' using errcode='22023'; end if;
        update public.test_daily_allocations set total=(payload->>'total')::integer,version=version+1 where product_id=rid and business_date=today;
      end if;
      detail:=jsonb_build_object('business_date',today,'previous_total',coalesce(alloc.total,0),'total',payload->'total','reason',left(payload->>'reason',500));
    elsif op='save_customer' then
      if (payload->>'version')::integer=0 then
        insert into public.test_customers(id,business_id,name,phone,notes) values(rid,bid,trim(payload->>'name'),coalesce(payload->>'phone',''),coalesce(payload->>'notes',''));
      else
        update public.test_customers set name=trim(payload->>'name'),phone=coalesce(payload->>'phone',''),notes=coalesce(payload->>'notes',''),
          archived=(payload->>'archived')::boolean,version=version+1 where id=rid and business_id=bid and version=(payload->>'version')::integer;
        get diagnostics changed=row_count; if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
      end if;
    elsif op='create_order' then
      pickup:=(payload->>'pickup_at')::timestamptz;
      if (pickup at time zone 'Asia/Manila')::date is distinct from today then raise exception 'Only same-day pickup is supported' using errcode='22023'; end if;
      if not exists(select 1 from public.test_customers where id=(payload->>'customer_id')::uuid and business_id=bid and not archived) then raise exception 'Select an active customer' using errcode='22023'; end if;
      if jsonb_typeof(payload->'items') is distinct from 'array' or jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Select between 1 and 100 order items' using errcode='22023'; end if;
      insert into public.test_orders(id,business_id,customer_id,total_centavos,pickup_at,business_date,payment_method,notes)
        values(rid,bid,(payload->>'customer_id')::uuid,0,pickup,today,trim(payload->>'payment_method'),coalesce(payload->>'notes',''));
      for j in select value from jsonb_array_elements(payload->'items') loop
        select * into prod from public.products where id=(j->>'product_id')::uuid and business_id=bid and active;
        if not found then raise exception 'An item is unavailable' using errcode='22023'; end if;
        qty:=(j->>'quantity')::integer;
        insert into public.test_order_items(order_id,business_id,product_id,name,quantity,price_centavos) values(rid,bid,prod.id,prod.name,qty,prod.price_centavos);
        order_total:=order_total+prod.price_centavos::bigint*qty;
      end loop;
      update public.test_orders set total_centavos=order_total where id=rid;
    elsif op='update_order' then
      select * into ord from public.test_orders where id=rid and business_id=bid;
      if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
      if ord.status<>'confirmed' then raise exception 'Only confirmed order details may be edited before acceptance' using errcode='22023'; end if;
      pickup:=(payload->>'pickup_at')::timestamptz;
      if (pickup at time zone 'Asia/Manila')::date is distinct from ord.business_date then raise exception 'Pickup must remain on the order business date' using errcode='22023'; end if;
      update public.test_orders set pickup_at=pickup,payment_method=trim(payload->>'payment_method'),notes=coalesce(payload->>'notes',''),version=version+1 where id=rid;
    elsif op='transition_order' then
      select * into ord from public.test_orders where id=rid and business_id=bid for update;
      if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;
      next_status:=payload->>'status';
      if next_status is null or not (
        (ord.status='confirmed' and next_status in ('accepted','rejected','expired')) or
        (ord.status='accepted' and next_status in ('ready','rejected')) or
        (ord.status='ready' and next_status='completed')
      ) then raise exception 'invalid_transition' using errcode='22023'; end if;
      if next_status='rejected' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'A reason is required' using errcode='22023'; end if;
      if next_status='accepted' then
        if not biz.rules_approved then raise exception 'rules_required' using errcode='22023'; end if;
        if ord.business_date<>today or ord.pickup_at<=now() or (now() at time zone 'Asia/Manila')::time<biz.opening_time
          or (now() at time zone 'Asia/Manila')::time>=biz.cutoff_time
          or (ord.pickup_at at time zone 'Asia/Manila')::time<biz.opening_time or (ord.pickup_at at time zone 'Asia/Manila')::time>biz.cutoff_time
        then raise exception 'pickup_closed' using errcode='22023'; end if;
        for row_item in select * from public.test_order_items where order_id=rid order by product_id loop
          if not exists(select 1 from public.products where id=row_item.product_id and active) then raise exception 'An item is unavailable' using errcode='22023'; end if;
          update public.test_daily_allocations set used=used+row_item.quantity,version=version+1
            where product_id=row_item.product_id and business_date=ord.business_date and total-used>=row_item.quantity;
          get diagnostics changed=row_count; if changed<>1 then raise exception 'insufficient_quantity' using errcode='22023'; end if;
        end loop;
        update public.test_orders set restore_before_preparing=biz.restore_before_preparing where id=rid;
      elsif next_status='rejected' and ord.status='accepted' and ord.restore_before_preparing then
        for row_item in select * from public.test_order_items where order_id=rid order by product_id loop
          update public.test_daily_allocations set used=used-row_item.quantity,version=version+1 where product_id=row_item.product_id and business_date=ord.business_date;
        end loop;
      end if;
      update public.test_orders set status=next_status,version=version+1 where id=rid;
      detail:=jsonb_build_object('from',ord.status,'to',next_status,'reason',left(payload->>'reason',500));
    else raise exception 'Unsupported operation' using errcode='22023';
    end if;
  end if;
  insert into public.test_audit_events(business_id,actor_id,action,record_id,detail) values(bid,actor,op,rid,detail);
  result:=jsonb_build_object('id',rid);
  insert into private.test_requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
  return result;
end $$;


--
-- Name: test_command_v2(jsonb); Type: FUNCTION; Schema: private; Owner: -
--

CREATE FUNCTION private.test_command_v2(payload jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  actor uuid := auth.uid();
  req uuid := (payload->>'request_id')::uuid;
  bid uuid := (payload->>'business_id')::uuid;
  rid uuid := (payload->>'id')::uuid;
  op text := payload->>'op';
  previous private.test_requests;
  result jsonb;
  biz public.businesses;
  ord public.test_orders;
  row_item record;
  next_status text;
  today date := (now() at time zone 'Asia/Manila')::date;
  changed integer;
  pickup timestamptz;
  detail jsonb := '{}';
begin
  if op not in ('update_order','transition_order') then
    return private.test_command(payload);
  end if;
  if actor is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if req is null or bid is null or rid is null then raise exception 'request_id, business_id, and id are required' using errcode='22023'; end if;
  if length(payload::text)>65536 then raise exception 'Request is too large' using errcode='22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(actor::text || req::text,0));
  select * into previous from private.test_requests where actor_id=actor and request_id=req;
  if found then
    if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
    if private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
    return previous.result;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(bid::text,2));
  if private.member_role(bid) is null then raise exception 'permission_denied' using errcode='42501'; end if;
  if (payload->>'version')::integer is null or (payload->>'version')::integer < 0 then raise exception 'A nonnegative record version is required' using errcode='22023'; end if;
  select * into strict biz from public.businesses where id=bid;
  select * into ord from public.test_orders where id=rid and business_id=bid for update;
  if not found or ord.version<>(payload->>'version')::integer then raise exception 'conflict' using errcode='40001'; end if;

  if op='update_order' then
    if ord.status<>'confirmed' then raise exception 'Only confirmed order details may be edited before acceptance' using errcode='22023'; end if;
    pickup:=(payload->>'pickup_at')::timestamptz;
    if (pickup at time zone 'Asia/Manila')::date is distinct from ord.business_date then raise exception 'Pickup must remain on the order business date' using errcode='22023'; end if;
    update public.test_orders set pickup_at=pickup,payment_method=trim(payload->>'payment_method'),
      notes=coalesce(payload->>'notes',''),version=version+1 where id=rid;
  else
    next_status:=payload->>'status';
    if next_status is null or not (
      (ord.status='confirmed' and next_status in ('accepted','rejected','expired')) or
      (ord.status='accepted' and next_status in ('ready','rejected')) or
      (ord.status='ready' and next_status='completed')
    ) then raise exception 'invalid_transition' using errcode='22023'; end if;
    if next_status='rejected' and length(trim(coalesce(payload->>'reason','')))=0 then raise exception 'A reason is required' using errcode='22023'; end if;

    if next_status='accepted' then
      if not biz.rules_approved then raise exception 'rules_required' using errcode='22023'; end if;
      if ord.business_date<>today or ord.pickup_at<=now() or (now() at time zone 'Asia/Manila')::time<biz.opening_time
        or (now() at time zone 'Asia/Manila')::time>=biz.cutoff_time
        or (ord.pickup_at at time zone 'Asia/Manila')::time<biz.opening_time
        or (ord.pickup_at at time zone 'Asia/Manila')::time>biz.cutoff_time
      then raise exception 'pickup_closed' using errcode='22023'; end if;
      for row_item in select * from public.test_order_items where order_id=rid order by product_id loop
        if not exists(select 1 from public.products where id=row_item.product_id and active) then raise exception 'An item is unavailable' using errcode='22023'; end if;
        update public.test_daily_allocations set used=used+row_item.quantity,version=version+1
          where product_id=row_item.product_id and business_date=ord.business_date and total-used>=row_item.quantity;
        get diagnostics changed=row_count;
        if changed<>1 then raise exception 'insufficient_quantity' using errcode='22023'; end if;
      end loop;
      update public.test_orders set restore_before_preparing=biz.restore_before_preparing where id=rid;
    elsif next_status='rejected' and ord.status='accepted' and ord.restore_before_preparing then
      for row_item in select * from public.test_order_items where order_id=rid order by product_id loop
        update public.test_daily_allocations set used=used-row_item.quantity,version=version+1
          where product_id=row_item.product_id and business_date=ord.business_date;
      end loop;
    end if;

    update public.test_orders set status=next_status,version=version+1 where id=rid;
    detail:=jsonb_build_object('from',ord.status,'to',next_status,'reason',left(payload->>'reason',500));
  end if;

  insert into public.test_audit_events(business_id,actor_id,action,record_id,detail) values(bid,actor,op,rid,detail);
  result:=jsonb_build_object('id',rid);
  insert into private.test_requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
  return result;
end $$;


--
-- Name: app_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_command(payload jsonb) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$ select private.command_v3(payload) $$;


--
-- Name: app_snapshot(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_snapshot() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
  select jsonb_build_object(
    'business',to_jsonb(b),'role',m.role,'today',(now() at time zone 'Asia/Manila')::date,
    'members',coalesce((select jsonb_agg(member) from public.business_members member where member.business_id=b.id),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(p order by p.name) from public.products p where p.business_id=b.id),'[]'::jsonb),
    'allocations',coalesce((select jsonb_agg(a) from public.daily_allocations a where a.business_id=b.id and a.business_date=(now() at time zone 'Asia/Manila')::date),'[]'::jsonb),
    'customers',coalesce((select jsonb_agg(c order by c.name) from public.customers c where c.business_id=b.id),'[]'::jsonb),
    'orders',coalesce((select jsonb_agg(o order by o.created_at desc) from public.orders o where o.business_id=b.id),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(i) from public.order_items i where i.business_id=b.id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(e order by e.created_at desc) from (select * from public.audit_events where business_id=b.id order by created_at desc limit 100) e),'[]'::jsonb)
  ) from public.business_members m join public.businesses b on b.id=m.business_id where m.user_id=(select auth.uid())
$$;


--
-- Name: claim_test_reply(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_test_reply(message_id uuid, owner_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 return private.claim_test_reply(message_id);
end $$;


--
-- Name: finish_test_reply(jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finish_test_reply(payload jsonb, owner_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform private.finish_test_reply(payload);
end $$;


--
-- Name: test_chat_command(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.test_chat_command(payload jsonb) RETURNS jsonb
    LANGUAGE sql
    SET search_path TO ''
    AS $$
 select case when payload->>'op'='confirm_draft' then private.confirm_test_draft(payload) else private.chat_command(payload) end
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: requests; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.requests (
    actor_id uuid NOT NULL,
    request_id uuid NOT NULL,
    payload jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: test_requests; Type: TABLE; Schema: private; Owner: -
--

CREATE TABLE private.test_requests (
    actor_id uuid CONSTRAINT requests_actor_id_not_null NOT NULL,
    request_id uuid CONSTRAINT requests_request_id_not_null NOT NULL,
    payload jsonb CONSTRAINT requests_payload_not_null NOT NULL,
    result jsonb CONSTRAINT requests_result_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT requests_created_at_not_null NOT NULL
);


--
-- Name: ai_evaluations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    message_id uuid NOT NULL,
    prompt_version text NOT NULL,
    model text NOT NULL,
    latency_ms integer NOT NULL,
    input_tokens integer,
    output_tokens integer,
    estimated_cost_usd numeric,
    sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    outcome text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_evaluations_latency_ms_check CHECK ((latency_ms >= 0)),
    CONSTRAINT ai_evaluations_outcome_check CHECK ((outcome = ANY (ARRAY['validated'::text, 'escalated'::text, 'provider_failure'::text, 'suppressed'::text])))
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    record_id uuid NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: business_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_knowledge (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    approved boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT business_knowledge_body_check CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 3000))),
    CONSTRAINT business_knowledge_title_check CHECK (((length(TRIM(BOTH FROM title)) >= 1) AND (length(TRIM(BOTH FROM title)) <= 120)))
);


--
-- Name: business_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_members (
    business_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    display_name text DEFAULT ''::text NOT NULL,
    CONSTRAINT business_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'staff'::text])))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    opening_time time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    cutoff_time time without time zone DEFAULT '22:00:00'::time without time zone NOT NULL,
    rules_approved boolean DEFAULT false NOT NULL,
    restore_before_preparing boolean DEFAULT false NOT NULL,
    default_post_format text DEFAULT 'Text only'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT businesses_address_check CHECK ((length(address) <= 500)),
    CONSTRAINT businesses_check CHECK ((opening_time < cutoff_time)),
    CONSTRAINT businesses_default_post_format_check CHECK ((default_post_format = ANY (ARRAY['Text only'::text, 'Photo and text'::text]))),
    CONSTRAINT businesses_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120)))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT customers_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT customers_notes_check CHECK ((length(notes) <= 2000)),
    CONSTRAINT customers_phone_check CHECK ((length(phone) <= 40))
);


--
-- Name: daily_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_allocations (
    product_id uuid NOT NULL,
    business_id uuid NOT NULL,
    business_date date NOT NULL,
    total integer NOT NULL,
    used integer DEFAULT 0 NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT daily_allocations_check CHECK ((used <= total)),
    CONSTRAINT daily_allocations_total_check CHECK (((total >= 0) AND (total <= 999999))),
    CONSTRAINT daily_allocations_used_check CHECK ((used >= 0))
);


--
-- Name: knowledge_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_versions (
    business_id uuid NOT NULL,
    id uuid NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    approved boolean NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    business_id uuid NOT NULL,
    product_id uuid NOT NULL,
    name text NOT NULL,
    quantity integer NOT NULL,
    price_centavos integer NOT NULL,
    CONSTRAINT order_items_price_centavos_check CHECK ((price_centavos >= 0)),
    CONSTRAINT order_items_quantity_check CHECK (((quantity >= 1) AND (quantity <= 999999)))
);


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    status text DEFAULT 'confirmed'::text NOT NULL,
    total_centavos bigint NOT NULL,
    pickup_at timestamp with time zone NOT NULL,
    business_date date NOT NULL,
    payment_method text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    restore_before_preparing boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT orders_notes_check CHECK ((length(notes) <= 2000)),
    CONSTRAINT orders_payment_method_check CHECK (((length(TRIM(BOTH FROM payment_method)) >= 1) AND (length(TRIM(BOTH FROM payment_method)) <= 80))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'accepted'::text, 'ready'::text, 'completed'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT orders_total_centavos_check CHECK (((total_centavos >= 0) AND (total_centavos <= '9000000000000000'::bigint)))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price_centavos integer NOT NULL,
    active boolean DEFAULT true NOT NULL,
    photo_path text,
    version integer DEFAULT 1 NOT NULL,
    category text,
    CONSTRAINT products_category_check CHECK (((category IS NULL) OR (((length(category) >= 1) AND (length(category) <= 40)) AND (category = btrim(category)) AND (lower(category) <> ALL (ARRAY['all'::text, 'uncategorized'::text])) AND (category !~ '[[:cntrl:]]'::text)))),
    CONSTRAINT products_description_check CHECK ((length(description) <= 2000)),
    CONSTRAINT products_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT products_price_centavos_check CHECK (((price_centavos >= 0) AND (price_centavos <= 999999999)))
);


--
-- Name: test_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_audit_events (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT audit_events_id_not_null NOT NULL,
    business_id uuid CONSTRAINT audit_events_business_id_not_null NOT NULL,
    actor_id uuid CONSTRAINT audit_events_actor_id_not_null NOT NULL,
    action text CONSTRAINT audit_events_action_not_null NOT NULL,
    record_id uuid CONSTRAINT audit_events_record_id_not_null NOT NULL,
    detail jsonb DEFAULT '{}'::jsonb CONSTRAINT audit_events_detail_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT audit_events_created_at_not_null NOT NULL
);


--
-- Name: test_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_conversations (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    takeover boolean DEFAULT false NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: test_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_customers (
    id uuid CONSTRAINT customers_id_not_null NOT NULL,
    business_id uuid CONSTRAINT customers_business_id_not_null NOT NULL,
    name text CONSTRAINT customers_name_not_null NOT NULL,
    phone text DEFAULT ''::text CONSTRAINT customers_phone_not_null NOT NULL,
    notes text DEFAULT ''::text CONSTRAINT customers_notes_not_null NOT NULL,
    archived boolean DEFAULT false CONSTRAINT customers_archived_not_null NOT NULL,
    version integer DEFAULT 1 CONSTRAINT customers_version_not_null NOT NULL,
    CONSTRAINT customers_name_check CHECK (((length(TRIM(BOTH FROM name)) >= 1) AND (length(TRIM(BOTH FROM name)) <= 120))),
    CONSTRAINT customers_notes_check CHECK ((length(notes) <= 2000)),
    CONSTRAINT customers_phone_check CHECK ((length(phone) <= 40))
);


--
-- Name: test_daily_allocations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_daily_allocations (
    product_id uuid CONSTRAINT daily_allocations_product_id_not_null NOT NULL,
    business_id uuid CONSTRAINT daily_allocations_business_id_not_null NOT NULL,
    business_date date CONSTRAINT daily_allocations_business_date_not_null NOT NULL,
    total integer CONSTRAINT daily_allocations_total_not_null NOT NULL,
    used integer DEFAULT 0 CONSTRAINT daily_allocations_used_not_null NOT NULL,
    version integer DEFAULT 1 CONSTRAINT daily_allocations_version_not_null NOT NULL,
    CONSTRAINT daily_allocations_check CHECK ((used <= total)),
    CONSTRAINT daily_allocations_total_check CHECK (((total >= 0) AND (total <= 999999))),
    CONSTRAINT daily_allocations_used_check CHECK ((used >= 0))
);


--
-- Name: test_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_messages (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    body text NOT NULL,
    state text DEFAULT 'done'::text NOT NULL,
    reply_to uuid,
    result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_token uuid,
    processing_until timestamp with time zone,
    CONSTRAINT test_messages_body_check CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 4000))),
    CONSTRAINT test_messages_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'assistant'::text, 'owner'::text]))),
    CONSTRAINT test_messages_state_check CHECK ((state = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text, 'suppressed'::text])))
);


--
-- Name: test_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_order_items (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT order_items_id_not_null NOT NULL,
    order_id uuid CONSTRAINT order_items_order_id_not_null NOT NULL,
    business_id uuid CONSTRAINT order_items_business_id_not_null NOT NULL,
    product_id uuid CONSTRAINT order_items_product_id_not_null NOT NULL,
    name text CONSTRAINT order_items_name_not_null NOT NULL,
    quantity integer CONSTRAINT order_items_quantity_not_null NOT NULL,
    price_centavos integer CONSTRAINT order_items_price_centavos_not_null NOT NULL,
    CONSTRAINT order_items_price_centavos_check CHECK ((price_centavos >= 0)),
    CONSTRAINT order_items_quantity_check CHECK (((quantity >= 1) AND (quantity <= 999999)))
);


--
-- Name: test_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.test_orders (
    id uuid CONSTRAINT orders_id_not_null NOT NULL,
    business_id uuid CONSTRAINT orders_business_id_not_null NOT NULL,
    customer_id uuid CONSTRAINT orders_customer_id_not_null NOT NULL,
    status text DEFAULT 'confirmed'::text CONSTRAINT orders_status_not_null NOT NULL,
    total_centavos bigint CONSTRAINT orders_total_centavos_not_null NOT NULL,
    pickup_at timestamp with time zone CONSTRAINT orders_pickup_at_not_null NOT NULL,
    business_date date CONSTRAINT orders_business_date_not_null NOT NULL,
    payment_method text CONSTRAINT orders_payment_method_not_null NOT NULL,
    notes text DEFAULT ''::text CONSTRAINT orders_notes_not_null NOT NULL,
    restore_before_preparing boolean DEFAULT false CONSTRAINT orders_restore_before_preparing_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT orders_created_at_not_null NOT NULL,
    version integer DEFAULT 1 CONSTRAINT orders_version_not_null NOT NULL,
    CONSTRAINT orders_notes_check CHECK ((length(notes) <= 2000)),
    CONSTRAINT orders_payment_method_check CHECK (((length(TRIM(BOTH FROM payment_method)) >= 1) AND (length(TRIM(BOTH FROM payment_method)) <= 80))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['confirmed'::text, 'accepted'::text, 'ready'::text, 'completed'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT orders_total_centavos_check CHECK (((total_centavos >= 0) AND (total_centavos <= '9000000000000000'::bigint)))
);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (actor_id, request_id);


--
-- Name: test_requests test_requests_pkey; Type: CONSTRAINT; Schema: private; Owner: -
--

ALTER TABLE ONLY private.test_requests
    ADD CONSTRAINT test_requests_pkey PRIMARY KEY (actor_id, request_id);


--
-- Name: ai_evaluations ai_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluations
    ADD CONSTRAINT ai_evaluations_pkey PRIMARY KEY (id);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: business_knowledge business_knowledge_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_knowledge
    ADD CONSTRAINT business_knowledge_business_id_id_key UNIQUE (business_id, id);


--
-- Name: business_knowledge business_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_knowledge
    ADD CONSTRAINT business_knowledge_pkey PRIMARY KEY (id);


--
-- Name: business_members business_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_pkey PRIMARY KEY (business_id, user_id);


--
-- Name: business_members business_members_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_user_id_key UNIQUE (user_id);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: customers customers_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_id_key UNIQUE (business_id, id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: daily_allocations daily_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_allocations
    ADD CONSTRAINT daily_allocations_pkey PRIMARY KEY (product_id, business_date);


--
-- Name: knowledge_versions knowledge_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_versions
    ADD CONSTRAINT knowledge_versions_pkey PRIMARY KEY (id, version);


--
-- Name: order_items order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_id_key UNIQUE (business_id, id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: products products_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_business_id_id_key UNIQUE (business_id, id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: test_audit_events test_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_audit_events
    ADD CONSTRAINT test_audit_events_pkey PRIMARY KEY (id);


--
-- Name: test_conversations test_conversations_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_conversations
    ADD CONSTRAINT test_conversations_business_id_id_key UNIQUE (business_id, id);


--
-- Name: test_conversations test_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_conversations
    ADD CONSTRAINT test_conversations_pkey PRIMARY KEY (id);


--
-- Name: test_customers test_customers_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_customers
    ADD CONSTRAINT test_customers_business_id_id_key UNIQUE (business_id, id);


--
-- Name: test_customers test_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_customers
    ADD CONSTRAINT test_customers_pkey PRIMARY KEY (id);


--
-- Name: test_daily_allocations test_daily_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_daily_allocations
    ADD CONSTRAINT test_daily_allocations_pkey PRIMARY KEY (product_id, business_date);


--
-- Name: test_messages test_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_messages
    ADD CONSTRAINT test_messages_pkey PRIMARY KEY (id);


--
-- Name: test_messages test_messages_reply_to_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_messages
    ADD CONSTRAINT test_messages_reply_to_key UNIQUE (reply_to);


--
-- Name: test_order_items test_order_items_order_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_order_items
    ADD CONSTRAINT test_order_items_order_id_product_id_key UNIQUE (order_id, product_id);


--
-- Name: test_order_items test_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_order_items
    ADD CONSTRAINT test_order_items_pkey PRIMARY KEY (id);


--
-- Name: test_orders test_orders_business_id_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_orders
    ADD CONSTRAINT test_orders_business_id_id_key UNIQUE (business_id, id);


--
-- Name: test_orders test_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_orders
    ADD CONSTRAINT test_orders_pkey PRIMARY KEY (id);


--
-- Name: ai_evaluations_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_evaluations_business_id_idx ON public.ai_evaluations USING btree (business_id);


--
-- Name: allocations_business_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX allocations_business_date ON public.daily_allocations USING btree (business_id, business_date);


--
-- Name: business_knowledge_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_knowledge_business_id_idx ON public.business_knowledge USING btree (business_id);


--
-- Name: customers_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customers_business ON public.customers USING btree (business_id);


--
-- Name: events_business_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_business_created ON public.audit_events USING btree (business_id, created_at DESC);


--
-- Name: items_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX items_business ON public.order_items USING btree (business_id);


--
-- Name: knowledge_versions_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_versions_business_id_idx ON public.knowledge_versions USING btree (business_id);


--
-- Name: orders_business_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_business_created ON public.orders USING btree (business_id, created_at DESC);


--
-- Name: orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_customer ON public.orders USING btree (customer_id);


--
-- Name: products_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX products_business ON public.products USING btree (business_id);


--
-- Name: test_audit_events_business_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_audit_events_business_id_created_at_idx ON public.test_audit_events USING btree (business_id, created_at DESC);


--
-- Name: test_audit_events_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_audit_events_business_id_idx ON public.test_audit_events USING btree (business_id);


--
-- Name: test_conversations_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_conversations_business_id_idx ON public.test_conversations USING btree (business_id);


--
-- Name: test_customers_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_customers_business_id_idx ON public.test_customers USING btree (business_id);


--
-- Name: test_customers_business_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_customers_business_id_idx1 ON public.test_customers USING btree (business_id);


--
-- Name: test_daily_allocations_business_id_business_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_daily_allocations_business_id_business_date_idx ON public.test_daily_allocations USING btree (business_id, business_date);


--
-- Name: test_daily_allocations_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_daily_allocations_business_id_idx ON public.test_daily_allocations USING btree (business_id);


--
-- Name: test_messages_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_messages_business_id_idx ON public.test_messages USING btree (business_id);


--
-- Name: test_order_items_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_order_items_business_id_idx ON public.test_order_items USING btree (business_id);


--
-- Name: test_order_items_business_id_idx1; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_order_items_business_id_idx1 ON public.test_order_items USING btree (business_id);


--
-- Name: test_orders_business_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_orders_business_id_created_at_idx ON public.test_orders USING btree (business_id, created_at DESC);


--
-- Name: test_orders_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_orders_business_id_idx ON public.test_orders USING btree (business_id);


--
-- Name: test_orders_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX test_orders_customer_id_idx ON public.test_orders USING btree (customer_id);


--
-- Name: ai_evaluations ai_evaluations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluations
    ADD CONSTRAINT ai_evaluations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: ai_evaluations ai_evaluations_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_evaluations
    ADD CONSTRAINT ai_evaluations_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.test_messages(id);


--
-- Name: audit_events audit_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: business_knowledge business_knowledge_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_knowledge
    ADD CONSTRAINT business_knowledge_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: business_members business_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: business_members business_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_members
    ADD CONSTRAINT business_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);


--
-- Name: customers customers_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: daily_allocations daily_allocations_business_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_allocations
    ADD CONSTRAINT daily_allocations_business_id_product_id_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products(business_id, id);


--
-- Name: knowledge_versions knowledge_versions_business_id_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_versions
    ADD CONSTRAINT knowledge_versions_business_id_id_fkey FOREIGN KEY (business_id, id) REFERENCES public.business_knowledge(business_id, id);


--
-- Name: order_items order_items_business_id_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_business_id_order_id_fkey FOREIGN KEY (business_id, order_id) REFERENCES public.orders(business_id, id);


--
-- Name: order_items order_items_business_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_business_id_product_id_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products(business_id, id);


--
-- Name: orders orders_business_id_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_customer_id_fkey FOREIGN KEY (business_id, customer_id) REFERENCES public.customers(business_id, id);


--
-- Name: orders orders_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: products products_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: test_conversations test_conversations_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_conversations
    ADD CONSTRAINT test_conversations_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id);


--
-- Name: test_daily_allocations test_daily_allocations_business_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_daily_allocations
    ADD CONSTRAINT test_daily_allocations_business_id_product_id_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products(business_id, id);


--
-- Name: test_messages test_messages_business_id_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_messages
    ADD CONSTRAINT test_messages_business_id_conversation_id_fkey FOREIGN KEY (business_id, conversation_id) REFERENCES public.test_conversations(business_id, id);


--
-- Name: test_messages test_messages_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_messages
    ADD CONSTRAINT test_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES public.test_messages(id);


--
-- Name: test_order_items test_order_items_business_id_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_order_items
    ADD CONSTRAINT test_order_items_business_id_order_id_fkey FOREIGN KEY (business_id, order_id) REFERENCES public.test_orders(business_id, id);


--
-- Name: test_order_items test_order_items_business_id_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_order_items
    ADD CONSTRAINT test_order_items_business_id_product_id_fkey FOREIGN KEY (business_id, product_id) REFERENCES public.products(business_id, id);


--
-- Name: test_orders test_orders_business_id_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.test_orders
    ADD CONSTRAINT test_orders_business_id_customer_id_fkey FOREIGN KEY (business_id, customer_id) REFERENCES public.test_customers(business_id, id);


--
-- Name: requests; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.requests ENABLE ROW LEVEL SECURITY;

--
-- Name: test_requests; Type: ROW SECURITY; Schema: private; Owner: -
--

ALTER TABLE private.test_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_evaluations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_evaluations ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_allocations allocation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY allocation_read ON public.daily_allocations FOR SELECT TO authenticated USING ((private.member_role(business_id) IS NOT NULL));


--
-- Name: audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_events audit_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_read ON public.audit_events FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: business_knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_knowledge ENABLE ROW LEVEL SECURITY;

--
-- Name: business_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses business_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_read ON public.businesses FOR SELECT TO authenticated USING ((private.member_role(id) IS NOT NULL));


--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customer_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_read ON public.customers FOR SELECT TO authenticated USING ((private.member_role(business_id) IS NOT NULL));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: order_items item_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY item_read ON public.order_items FOR SELECT TO authenticated USING ((private.member_role(business_id) IS NOT NULL));


--
-- Name: knowledge_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: business_members member_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY member_read ON public.business_members FOR SELECT TO authenticated USING (((user_id = ( SELECT auth.uid() AS uid)) OR (private.member_role(business_id) = 'owner'::text)));


--
-- Name: order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: orders order_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_read ON public.orders FOR SELECT TO authenticated USING ((private.member_role(business_id) IS NOT NULL));


--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_evaluations owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.ai_evaluations FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: business_knowledge owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.business_knowledge FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: knowledge_versions owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.knowledge_versions FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_audit_events owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_audit_events FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_conversations owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_conversations FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_customers owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_customers FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_daily_allocations owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_daily_allocations FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_messages owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_messages FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_order_items owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_order_items FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: test_orders owner_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY owner_read ON public.test_orders FOR SELECT TO authenticated USING ((private.member_role(business_id) = 'owner'::text));


--
-- Name: products product_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY product_read ON public.products FOR SELECT TO authenticated USING ((private.member_role(business_id) IS NOT NULL));


--
-- Name: products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

--
-- Name: test_audit_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_audit_events ENABLE ROW LEVEL SECURITY;

--
-- Name: test_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: test_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: test_daily_allocations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_daily_allocations ENABLE ROW LEVEL SECURITY;

--
-- Name: test_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: test_order_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_order_items ENABLE ROW LEVEL SECURITY;

--
-- Name: test_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.test_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA private; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA private TO authenticated;


--
-- Name: FUNCTION chat_command(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.chat_command(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.chat_command(payload jsonb) TO authenticated;


--
-- Name: FUNCTION claim_test_reply(message_id uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.claim_test_reply(message_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION command(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.command(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.command(payload jsonb) TO authenticated;


--
-- Name: FUNCTION command_v2(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.command_v2(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.command_v2(payload jsonb) TO authenticated;


--
-- Name: FUNCTION command_v3(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.command_v3(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.command_v3(payload jsonb) TO authenticated;


--
-- Name: FUNCTION confirm_test_draft(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.confirm_test_draft(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION private.confirm_test_draft(payload jsonb) TO authenticated;


--
-- Name: FUNCTION finish_test_reply(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.finish_test_reply(payload jsonb) FROM PUBLIC;


--
-- Name: FUNCTION member_role(bid uuid); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.member_role(bid uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.member_role(bid uuid) TO authenticated;


--
-- Name: FUNCTION test_command(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.test_command(payload jsonb) FROM PUBLIC;


--
-- Name: FUNCTION test_command_v2(payload jsonb); Type: ACL; Schema: private; Owner: -
--

REVOKE ALL ON FUNCTION private.test_command_v2(payload jsonb) FROM PUBLIC;


--
-- Name: FUNCTION app_command(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_command(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_command(payload jsonb) TO authenticated;


--
-- Name: FUNCTION app_snapshot(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.app_snapshot() FROM PUBLIC;
GRANT ALL ON FUNCTION public.app_snapshot() TO authenticated;


--
-- Name: FUNCTION claim_test_reply(message_id uuid, owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_test_reply(message_id uuid, owner_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION finish_test_reply(payload jsonb, owner_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finish_test_reply(payload jsonb, owner_id uuid) FROM PUBLIC;


--
-- Name: FUNCTION test_chat_command(payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.test_chat_command(payload jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.test_chat_command(payload jsonb) TO authenticated;


--
-- Name: TABLE ai_evaluations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ai_evaluations TO authenticated;


--
-- Name: TABLE audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.audit_events TO authenticated;


--
-- Name: TABLE business_knowledge; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.business_knowledge TO authenticated;


--
-- Name: TABLE business_members; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.business_members TO authenticated;


--
-- Name: TABLE businesses; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.businesses TO authenticated;


--
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.customers TO authenticated;


--
-- Name: TABLE daily_allocations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.daily_allocations TO authenticated;


--
-- Name: TABLE knowledge_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.knowledge_versions TO authenticated;


--
-- Name: TABLE order_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.order_items TO authenticated;


--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.orders TO authenticated;


--
-- Name: TABLE products; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.products TO authenticated;


--
-- Name: TABLE test_audit_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_audit_events TO authenticated;


--
-- Name: TABLE test_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_conversations TO authenticated;


--
-- Name: TABLE test_customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_customers TO authenticated;


--
-- Name: TABLE test_daily_allocations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_daily_allocations TO authenticated;


--
-- Name: TABLE test_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_messages TO authenticated;


--
-- Name: TABLE test_order_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_order_items TO authenticated;


--
-- Name: TABLE test_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.test_orders TO authenticated;


--
-- PostgreSQL database dump complete
--



-- Private product storage: bucket rows are not included in schema-only dumps.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-photos','product-photos',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy photo_read on storage.objects for select to authenticated using(
  bucket_id='product-photos' and exists(select 1 from public.business_members m where m.user_id=(select auth.uid()) and m.business_id::text=split_part(name,'/',1))
);
create policy photo_insert on storage.objects for insert to authenticated with check(
  bucket_id='product-photos' and array_length(string_to_array(name,'/'),1)=3 and exists(select 1 from public.business_members m where m.user_id=(select auth.uid()) and m.role='owner' and m.business_id::text=split_part(name,'/',1))
);
-- Immutable upload paths prevent replacement from silently changing a saved photo.
-- Unreferenced uploads are cleaned by an administrator; client deletion is not granted.


do $service_grants$ begin
  if exists(select 1 from pg_roles where rolname='service_role') then
    GRANT USAGE ON SCHEMA private TO service_role;
    GRANT ALL ON FUNCTION private.claim_test_reply(message_id uuid) TO service_role;
    GRANT ALL ON FUNCTION private.finish_test_reply(payload jsonb) TO service_role;
    GRANT ALL ON FUNCTION public.claim_test_reply(message_id uuid, owner_id uuid) TO service_role;
    GRANT ALL ON FUNCTION public.finish_test_reply(payload jsonb, owner_id uuid) TO service_role;
  end if;
end $service_grants$;

-- Override platform default grants, then restore the explicit application permissions.
REVOKE ALL ON FUNCTION private.chat_command(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.claim_test_reply(message_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.command(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.command_v2(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.command_v3(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.confirm_test_draft(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.finish_test_reply(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.member_role(bid uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.test_command(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.test_command_v2(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_command(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_test_reply(message_id uuid, owner_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_test_reply(payload jsonb, owner_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.test_chat_command(payload jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.test_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.ai_evaluations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_knowledge FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.business_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.businesses FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.daily_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_versions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.products FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_audit_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_daily_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_order_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.test_orders FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT ALL ON FUNCTION private.chat_command(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.command(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.command_v2(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.command_v3(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.confirm_test_draft(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION private.member_role(bid uuid) TO authenticated;
GRANT ALL ON FUNCTION public.app_command(payload jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.app_snapshot() TO authenticated;
GRANT ALL ON FUNCTION public.test_chat_command(payload jsonb) TO authenticated;
GRANT SELECT ON TABLE public.ai_evaluations TO authenticated;
GRANT SELECT ON TABLE public.audit_events TO authenticated;
GRANT SELECT ON TABLE public.business_knowledge TO authenticated;
GRANT SELECT ON TABLE public.business_members TO authenticated;
GRANT SELECT ON TABLE public.businesses TO authenticated;
GRANT SELECT ON TABLE public.customers TO authenticated;
GRANT SELECT ON TABLE public.daily_allocations TO authenticated;
GRANT SELECT ON TABLE public.knowledge_versions TO authenticated;
GRANT SELECT ON TABLE public.order_items TO authenticated;
GRANT SELECT ON TABLE public.orders TO authenticated;
GRANT SELECT ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.test_audit_events TO authenticated;
GRANT SELECT ON TABLE public.test_conversations TO authenticated;
GRANT SELECT ON TABLE public.test_customers TO authenticated;
GRANT SELECT ON TABLE public.test_daily_allocations TO authenticated;
GRANT SELECT ON TABLE public.test_messages TO authenticated;
GRANT SELECT ON TABLE public.test_order_items TO authenticated;
GRANT SELECT ON TABLE public.test_orders TO authenticated;

RESET search_path;
RESET row_security;
RESET check_function_bodies;
RESET client_min_messages;
