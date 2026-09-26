-- Read-only post-deployment checks. No customer message bodies or credentials.
select jsonb_build_object(
 'messenger_tables', (select jsonb_agg(tablename order by tablename) from pg_tables
   where schemaname='public' and tablename like 'messenger_%'),
 'knowledge_entries', (select count(*) from public.business_knowledge),
 'knowledge_history_entries', (select count(*) from public.knowledge_versions),
 'knowledge_rpc', to_regprocedure('public.knowledge_command(jsonb)') is not null,
 'messenger_tables_without_rls', (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and c.relname like 'messenger_%' and not c.relrowsecurity),
 'configured_connections', (select count(*) from public.messenger_connections),
 'enabled_connections', (select count(*) from public.messenger_connections where enabled)
) as verification;
