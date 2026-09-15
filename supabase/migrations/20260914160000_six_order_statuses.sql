-- Align existing Phase 2 databases with the approved six-state order lifecycle.
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status=case status
  when 'draft' then 'confirmed'
  when 'preparing' then 'accepted'
  when 'cancelled' then 'rejected'
  when 'unclaimed' then 'ready'
  else status
end;
alter table public.orders alter column status set default 'confirmed';
alter table public.orders add constraint orders_status_check
  check(status in ('confirmed','accepted','ready','completed','rejected','expired'));

-- Keep non-order commands on the original audited command service. Intercept
-- order edits/transitions so already-deployed projects receive the new rules.
create or replace function private.command_v2(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
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
revoke all on function private.command_v2(jsonb) from public;
grant execute on function private.command_v2(jsonb) to authenticated;

create or replace function public.app_command(payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.command_v2(payload) $$;
revoke all on function public.app_command(jsonb) from public;
grant execute on function public.app_command(jsonb) to authenticated;
