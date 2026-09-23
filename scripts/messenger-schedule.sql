-- Run after setting these Vault secrets using the Supabase dashboard:
-- messenger_project_url = https://<project>.supabase.co
-- messenger_worker_secret = same random secret used by MESSENGER_WORKER_SECRET
-- Contains no credentials. One schedule, idempotent by job name.
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
 if not exists(select 1 from vault.decrypted_secrets where name='messenger_project_url') or
    not exists(select 1 from vault.decrypted_secrets where name='messenger_worker_secret') then
  raise exception 'Configure the Messenger Vault secrets first';
 end if;
end $$;
select cron.schedule('messenger-recovery','* * * * *', $job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='messenger_project_url')||'/functions/v1/messenger-worker',
  headers:=jsonb_build_object('Content-Type','application/json','x-messenger-worker',
   (select decrypted_secret from vault.decrypted_secrets where name='messenger_worker_secret')),
  body:='{}'::jsonb,timeout_milliseconds:=5000
 );
$job$);
