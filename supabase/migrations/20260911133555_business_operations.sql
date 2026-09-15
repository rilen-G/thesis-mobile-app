-- All business mutations are serialized per business in short transactions.
-- No provider calls occur under these locks. No exposed SECURITY DEFINER functions.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.businesses (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 120),
  address text not null default '' check (length(address) <= 500),
  opening_time time not null default '08:00', cutoff_time time not null default '22:00',
  rules_approved boolean not null default false, restore_before_preparing boolean not null default false,
  default_post_format text not null default 'Text only', version integer not null default 1,
  check (opening_time < cutoff_time), check (default_post_format in ('Text only','Photo and text'))
);
create table public.business_members (
  business_id uuid not null references public.businesses(id), user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','staff')), display_name text not null default '', primary key (business_id,user_id), unique(user_id)
);
create table public.products (
  id uuid primary key, business_id uuid not null references public.businesses(id),
  name text not null check (length(trim(name)) between 1 and 120), description text not null default '' check(length(description)<=2000),
  price_centavos integer not null check(price_centavos between 0 and 999999999), active boolean not null default true,
  photo_path text, version integer not null default 1, unique(business_id,id)
);
create index products_business on public.products(business_id);
create table public.daily_allocations (
  product_id uuid not null, business_id uuid not null, business_date date not null,
  total integer not null check(total between 0 and 999999), used integer not null default 0 check(used >= 0),
  version integer not null default 1, primary key(product_id,business_date), check(used <= total),
  foreign key(business_id,product_id) references public.products(business_id,id)
);
create index allocations_business_date on public.daily_allocations(business_id,business_date);
create table public.customers (
  id uuid primary key, business_id uuid not null references public.businesses(id),
  name text not null check(length(trim(name)) between 1 and 120), phone text not null default '' check(length(phone)<=40),
  notes text not null default '' check(length(notes)<=2000), archived boolean not null default false,
  version integer not null default 1, unique(business_id,id)
);
create index customers_business on public.customers(business_id);
create table public.orders (
  id uuid primary key, business_id uuid not null references public.businesses(id), customer_id uuid not null,
  status text not null default 'confirmed' check(status in ('confirmed','accepted','ready','completed','rejected','expired')),
  total_centavos bigint not null check(total_centavos between 0 and 9000000000000000),
  pickup_at timestamptz not null, business_date date not null,
  payment_method text not null check(length(trim(payment_method)) between 1 and 80),
  notes text not null default '' check(length(notes)<=2000),
  restore_before_preparing boolean not null default false,
  created_at timestamptz not null default now(), version integer not null default 1,
  foreign key(business_id,customer_id) references public.customers(business_id,id), unique(business_id,id)
);
create index orders_business_created on public.orders(business_id,created_at desc);
create index orders_customer on public.orders(customer_id);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null, business_id uuid not null,
  product_id uuid not null, name text not null, quantity integer not null check(quantity between 1 and 999999),
  price_centavos integer not null check(price_centavos>=0), unique(order_id,product_id),
  foreign key(business_id,order_id) references public.orders(business_id,id),
  foreign key(business_id,product_id) references public.products(business_id,id)
);
create index items_business on public.order_items(business_id);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id),
  actor_id uuid not null, action text not null, record_id uuid not null,
  detail jsonb not null default '{}', created_at timestamptz not null default now()
);
create index events_business_created on public.audit_events(business_id,created_at desc);
create table private.requests (
  actor_id uuid not null, request_id uuid not null, payload jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
alter table private.requests enable row level security;

create function private.member_role(bid uuid) returns text language sql stable security definer set search_path = '' as $$
  select role from public.business_members where business_id=bid and user_id=(select auth.uid())
$$;
revoke all on function private.member_role(uuid) from public;
grant execute on function private.member_role(uuid) to authenticated;

do $$ declare tab text; begin
  foreach tab in array array['businesses','business_members','products','daily_allocations','customers','orders','order_items','audit_events'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from anon, authenticated',tab);
    execute format('grant select on public.%I to authenticated',tab);
  end loop;
end $$;
create policy business_read on public.businesses for select to authenticated using(private.member_role(id) is not null);
create policy member_read on public.business_members for select to authenticated using(user_id=(select auth.uid()) or private.member_role(business_id)='owner');
create policy product_read on public.products for select to authenticated using(private.member_role(business_id) is not null);
create policy allocation_read on public.daily_allocations for select to authenticated using(private.member_role(business_id) is not null);
create policy customer_read on public.customers for select to authenticated using(private.member_role(business_id) is not null);
create policy order_read on public.orders for select to authenticated using(private.member_role(business_id) is not null);
create policy item_read on public.order_items for select to authenticated using(private.member_role(business_id) is not null);
create policy audit_read on public.audit_events for select to authenticated using(private.member_role(business_id)='owner');

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

create function private.command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke all on function private.command(jsonb) from public;
grant execute on function private.command(jsonb) to authenticated;
create function public.app_command(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.command(payload) $$;
revoke all on function public.app_command(jsonb) from public;
grant execute on function public.app_command(jsonb) to authenticated;

create function public.app_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
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
revoke all on function public.app_snapshot() from public;
grant execute on function public.app_snapshot() to authenticated;

