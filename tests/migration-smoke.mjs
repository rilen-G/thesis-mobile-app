import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`);
for(const file of (await readdir('supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
console.log('All migrations parsed and applied successfully to isolated PostgreSQL.');
await db.close();
