-- Messenger orders cannot be edited once the customer confirms; manual orders stay editable.
CREATE OR REPLACE FUNCTION private.command_v2(payload jsonb) RETURNS jsonb
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
    if ord.reserved then raise exception 'messenger_order_locked' using errcode='22023'; end if;
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
        if not ord.reserved then
          update public.daily_allocations set used=used+row_item.quantity,version=version+1
            where product_id=row_item.product_id and business_date=ord.business_date and total-used>=row_item.quantity;
          get diagnostics changed=row_count;
          if changed<>1 then raise exception 'insufficient_quantity' using errcode='22023'; end if;
        end if;
      end loop;
      update public.orders set restore_before_preparing=biz.restore_before_preparing where id=rid;
    elsif (next_status='rejected' and ord.status='accepted' and ord.restore_before_preparing)
      or (next_status in ('rejected','expired') and ord.status='confirmed' and ord.reserved) then
      for row_item in select * from public.order_items where order_id=rid order by product_id loop
        update public.daily_allocations set used=used-row_item.quantity,version=version+1
          where product_id=row_item.product_id and business_date=ord.business_date;
      end loop;
    end if;

    update public.orders set status=next_status,version=version+1,rejection_reason=case when next_status='rejected' then left(btrim(payload->>'reason'),500) else rejection_reason end where id=rid;
    detail:=jsonb_build_object('from',ord.status,'to',next_status,'reason',left(payload->>'reason',500));
  end if;

  insert into public.audit_events(business_id,actor_id,action,record_id,detail) values(bid,actor,op,rid,detail);
  result:=jsonb_build_object('id',rid);
  insert into private.requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
  return result;
end $$;
