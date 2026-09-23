-- Preserve approved business knowledge; remove the retired simulator and its data.
create function private.knowledge_command(payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid(); bid uuid := (payload->>'business_id')::uuid;
 rid uuid := (payload->>'id')::uuid; req uuid := (payload->>'request_id')::uuid;
 revision integer := (payload->>'version')::integer;
 previous private.requests; result jsonb; changed integer;
begin
 if actor is null or private.member_role(bid) is distinct from 'owner' then
  raise exception 'permission_denied' using errcode='42501';
 end if;
 if req is null or rid is null or payload->>'op' is distinct from 'knowledge'
  or revision is null or revision < 0 or length(payload::text)>16384
  or jsonb_typeof(payload->'title') is distinct from 'string'
  or jsonb_typeof(payload->'body') is distinct from 'string'
  or jsonb_typeof(payload->'approved') is distinct from 'boolean' then
  raise exception 'Invalid knowledge request' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||req::text,0));
 select * into previous from private.requests where actor_id=actor and request_id=req;
 if found then
  if previous.payload<>payload then raise exception 'request_conflict' using errcode='22023'; end if;
  return previous.result;
 end if;
 perform 1 from public.businesses where id=bid for update;
 if revision=0 then
  insert into public.business_knowledge(id,business_id,title,body,approved)
   values(rid,bid,btrim(payload->>'title'),btrim(payload->>'body'),(payload->>'approved')::boolean);
 else
  update public.business_knowledge set title=btrim(payload->>'title'),body=btrim(payload->>'body'),
   approved=(payload->>'approved')::boolean,version=version+1
   where id=rid and business_id=bid and version=revision;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'conflict' using errcode='40001'; end if;
 end if;
 insert into public.knowledge_versions(business_id,id,version,title,body,approved)
  select business_id,id,version,title,body,approved from public.business_knowledge where id=rid and business_id=bid;
 result:=jsonb_build_object('id',rid);
 insert into private.requests(actor_id,request_id,payload,result) values(actor,req,payload,result);
 return result;
end $$;
create function public.knowledge_command(payload jsonb) returns jsonb
language sql set search_path = '' as $$select private.knowledge_command(payload)$$;
revoke all on function public.knowledge_command(jsonb),private.knowledge_command(jsonb) from public,anon,authenticated;
grant execute on function public.knowledge_command(jsonb),private.knowledge_command(jsonb) to authenticated;

drop function public.test_chat_command(jsonb);
drop function public.claim_test_reply(uuid,uuid);
drop function public.finish_test_reply(jsonb,uuid);
drop function private.chat_command(jsonb);
drop function private.claim_test_reply(uuid);
drop function private.confirm_test_draft(jsonb);
drop function private.finish_test_reply(jsonb);
drop function private.test_command_v2(jsonb);
drop function private.test_command(jsonb);
drop table public.ai_evaluations;
drop table public.test_order_items;
drop table public.test_orders;
drop table public.test_daily_allocations;
drop table public.test_messages;
drop table public.test_conversations;
drop table public.test_customers;
drop table public.test_audit_events;
drop table private.test_requests;
notify pgrst, 'reload schema';
