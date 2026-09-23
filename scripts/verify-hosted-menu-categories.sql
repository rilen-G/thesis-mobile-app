-- Run against the linked development project. All temporary writes roll back.
begin;
select set_config('request.jwt.claim.sub',
  (select user_id::text from public.business_members where role='owner' order by business_id limit 1),true) is not null as owner_available;
set local role authenticated;
do $$
declare
  snapshot jsonb := public.app_snapshot();
  product_id uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  generated_id uuid;
  payload jsonb;
begin
  if snapshot is null then raise exception 'Owner snapshot required'; end if;
  payload := jsonb_build_object('op','save_product','business_id',snapshot->'business'->>'id',
    'id',product_id,'request_id',request_id,'version',0,'name','Category verification',
    'price_centavos',100,'active',true,'category','Rice Meals');
  perform public.app_command(payload);
  if not exists(select 1 from public.products where id=product_id and category='Rice Meals' and version=1) then
    raise exception 'Category persistence failed';
  end if;
  perform public.app_command(payload || jsonb_build_object('request_id',gen_random_uuid(),'version',1,'category','Drinks'));
  perform public.app_command(payload);
  if not exists(select 1 from public.products where id=product_id and category='Drinks' and version=2) then
    raise exception 'Replay changed category';
  end if;
  begin
    perform public.app_command(payload || jsonb_build_object('request_id',gen_random_uuid(),'version',2,'category','All'));
    raise exception 'Invalid category accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'Invalid menu category' then raise; end if;
  end;
  if not exists(select 1 from public.products where id=product_id and category='Drinks' and version=2) then
    raise exception 'Invalid save did not roll back';
  end if;
  perform public.app_command(payload || jsonb_build_object('request_id',gen_random_uuid(),'version',2,'category',null));
  if not exists(select 1 from public.products where id=product_id and category is null and version=3) then
    raise exception 'Category clear failed';
  end if;
  payload := (payload - 'id') || jsonb_build_object('request_id',gen_random_uuid(),'category','Drinks');
  generated_id := (public.app_command(payload)->>'id')::uuid;
  if not exists(select 1 from public.products where id=generated_id and category='Drinks' and version=1) then
    raise exception 'Generated product ID lost its category';
  end if;
  if (public.app_command(payload)->>'id')::uuid is distinct from generated_id then
    raise exception 'Generated product retry duplicated the product';
  end if;
end $$;
select 'Category persistence, retries, validation rollback, and clearing passed' as verification;
rollback;
