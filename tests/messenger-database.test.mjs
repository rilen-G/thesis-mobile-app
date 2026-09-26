import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { databaseEngine } from './database-engine.mjs';

await test('Messenger database boundaries and delivery recovery', async t => {
 const db = await databaseEngine(process.env.OPERATIONS_TEST_ENGINE === 'postgres');
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
   create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security; grant usage on schema storage to authenticated;
   grant select,insert on storage.objects to authenticated;
   alter default privileges in schema public grant all on tables to anon,authenticated;
   alter default privileges in schema public grant execute on functions to anon,authenticated;`);
  for (const file of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  const owner = randomUUID(), staff = randomUUID(), stranger = randomUUID();
  for (const id of [owner,staff,stranger]) await db.query('insert into auth.users values($1,$2,now())',[id,`${id}@test.invalid`]);
  async function as(user, fn) { return db.transaction(async tx => { await tx.exec('set local role authenticated'); await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]); return fn(tx); }); }
  const command = (user, payload) => as(user, async tx => (await tx.query('select public.app_command($1) result',[{request_id:randomUUID(),...payload}])).rows[0].result);
  const bid = (await command(owner,{op:'create_business',name:'Messenger Kitchen'})).id;
  const bid2 = (await command(stranger,{op:'create_business',name:'Other'})).id;
  await command(owner,{op:'add_staff',business_id:bid,email:`${staff}@test.invalid`});
  const conn = randomUUID();
  await db.query("insert into public.messenger_connections(id,business_id,page_id,page_name,probe_sender_id) values($1,$2,'100','Test Page','200')",[conn,bid]);
  const svc = async (op,payload={}) => db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query('select public.messenger_service($1) result',[{op,connection_id:conn,...payload}])).rows[0].result;});
  const app = (op,payload={},user=owner) => as(user,async tx => (await tx.query('select public.messenger_command($1) result',[{op,business_id:bid,request_id:randomUUID(),...payload}])).rows[0].result);
  const row = async (table,id) => (await db.query(`select * from public.${table} where id=$1`,[id])).rows[0];
  let event = 0;
  const intake = (text, extra={}) => svc('ingest',{page_id:'100',sender_id:'200',event_id:`e-${++event}`,timestamp:new Date().toISOString(),text,...extra});
  async function finish(work,extra={}) { return svc('finish',{message_id:work.message.id,processing_token:work.message.processing_token,business_version:work.business.version,body:'Hello',sources:[],...extra}); }
  async function send() { const offer=await svc('offer'); assert.ok(offer); const auth=await svc('authorize',offer); assert.equal(auth.allowed,true); await svc('result',{...offer,outcome:'accepted',provider_id:`p-${randomUUID()}`}); return offer; }
  let cid;
  await t.test('owner-only reads and mutations; no service RPC for client roles',async()=>{
   assert.equal((await as(owner,tx=>tx.query('select * from public.messenger_connections'))).rows.length,1);
   for(const user of [staff,stranger]) {
    assert.equal((await as(user,tx=>tx.query('select * from public.messenger_connections'))).rows.length,0);
    await assert.rejects(app('verify',{},user),/permission_denied/);
   }
   await assert.rejects(as(owner,tx=>tx.query('select public.messenger_service($1)',[{op:'claim',connection_id:conn}])),/permission denied/);
   await assert.rejects(as(owner,tx=>tx.exec('update public.messenger_connections set enabled=true')),/permission denied/);
   await assert.rejects(app('enabled',{version:1,enabled:true}),/Verify/);
   await assert.rejects(svc('ingest',{page_id:'999',sender_id:'200',event_id:'wrong',timestamp:new Date().toISOString()}),/wrong_page/);
  });
  await t.test('only allowlisted tester can receive a probe before verification',async()=>{
   await intake('hello',{sender_id:'201'}); assert.equal(await svc('claim'),null);
   const input=await intake('hello');const work=await svc('claim');cid=work.conversation.id;
   await finish(work);const offer=await send();
   assert.equal((await row('messenger_messages',offer.job_id)).kind,'probe');
   assert.deepEqual(await svc('authorize',offer),{allowed:false});
   assert.equal((await svc('result',{...offer,outcome:'accepted'})).duplicate,true);
   assert.equal((await row('messenger_messages',input.id)).state,'done');
   await app('verify');const connection=await row('messenger_connections',conn);assert.equal(connection.enabled,false);
   await app('enabled',{enabled:true,version:connection.version});
  });
  await t.test('event deduplication, echoes, stale events, and old worker completion',async()=>{
   const data={page_id:'100',sender_id:'200',event_id:'duplicate',timestamp:new Date().toISOString(),text:'menu'};
   const first=await svc('ingest',data);assert.equal((await svc('ingest',data)).id,first.id);
   const work=await svc('claim');
   assert.deepEqual(await svc('ingest',{...data,event_id:'echo',is_echo:true}),{ignored:true});
   await intake('latest');assert.deepEqual(await finish(work),{stale:true});
   const stale=await intake('old',{timestamp:new Date(Date.now()-100000).toISOString()});assert.equal(stale.stale,true);
   const latest=await svc('claim');await finish(latest);await send();
  });
  const product=randomUUID();let pickup;
  await t.test('summary confirmation is deterministic, idempotent, and reserves nothing',async()=>{
   await command(owner,{op:'save_business',business_id:bid,version:1,name:'Messenger Kitchen',opening_time:'00:00',cutoff_time:'23:59:59',rules_approved:true,restore_before_preparing:true,default_post_format:'Text only'});
   await command(owner,{op:'save_product',business_id:bid,id:product,version:0,name:'Coffee',price_centavos:15000,active:true});
   const day=(await db.query("select (now() at time zone 'Asia/Manila')::date::text as business_day")).rows[0].business_day;pickup=`${day}T23:59:00+08:00`;
   await command(owner,{op:'set_allocation',business_id:bid,id:product,version:0,business_date:day,total:2,reason:'test'});
   await intake('one coffee');const work=await svc('claim');
   const reply=await finish(work,{body:'Review coffee',sources:[{id:product,version:1}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'}});
   await send();const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
   await intake(`CONFIRM ${summary.code}`);await finish(await svc('claim'));await send();
   const saved=await row('messenger_summaries',summary.id);assert.ok(saved.order_id);
   const order=await row('orders',saved.order_id);assert.equal(order.status,'confirmed');assert.equal(Number(order.total_centavos),15000);
   assert.equal((await db.query('select used from public.daily_allocations where product_id=$1',[product])).rows[0].used,0);
   await intake(`CONFIRM ${summary.code}`);await finish(await svc('claim'));await send();
   assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1);
   await command(staff,{op:'transition_order',business_id:bid,id:order.id,version:order.version,status:'accepted'});
   assert.equal((await db.query('select used from public.daily_allocations where product_id=$1',[product])).rows[0].used,1);
   const status=await send();assert.equal((await row('messenger_messages',status.job_id)).kind,'status');
  });
  await t.test('takeover revokes offered replies; manual sends require takeover',async()=>{
   await intake('question');await finish(await svc('claim'));const offer=await svc('offer');
   let c=await row('messenger_conversations',cid);
   await assert.rejects(app('reply',{conversation_id:cid,version:c.version,body:'Hi'}),/Take over/);
   await app('takeover',{conversation_id:cid,version:c.version,takeover:true});assert.equal((await svc('authorize',offer)).allowed,false);
   c=await row('messenger_conversations',cid);
   await app('reply',{conversation_id:cid,version:c.version,body:'Owner reply'});await send();
   c=await row('messenger_conversations',cid);await app('takeover',{conversation_id:cid,version:c.version,takeover:false});
   assert.equal(await svc('claim'),null);
  });
  await t.test('unknown sends block successors and need owner reconciliation',async()=>{
   await intake('hello');await finish(await svc('claim'));const offer=await svc('offer');assert.equal((await svc('authorize',offer)).allowed,true);
   await db.query("update public.messenger_messages set lease_until=now()-interval '1 second' where id=$1",[offer.job_id]);
   await svc('claim');assert.equal((await row('messenger_messages',offer.job_id)).state,'unknown');
   await intake('another question');await finish(await svc('claim'));assert.equal(await svc('offer'),null);
   const c=await row('messenger_conversations',cid);
   await app('reconcile',{conversation_id:cid,version:c.version,message_id:offer.job_id,outcome:'not_sent',note:'Checked Zap history and Messenger.'});
   assert.equal((await svc('result',{...offer,outcome:'accepted'})).ignored,true);await send();
  });
  await t.test('overlapping workers and authorizations cannot acquire the same message twice',async()=>{
   await intake('question');
   const claims=await Promise.all([svc('claim'),svc('claim')]);assert.equal(claims.filter(Boolean).length,1);
   await finish(claims.find(Boolean));const offer=await svc('offer');
   const permits=await Promise.all([svc('authorize',offer),svc('authorize',offer)]);
   assert.equal(permits.filter(p=>p.allowed).length,1);await svc('result',{...offer,outcome:'accepted'});
  });
  await t.test('unsupported attachments stay owner-only on resume and revoked sources cannot send',async()=>{
   const unsupported=await intake('',{unsupported:true});assert.equal(await svc('claim'),null);
   let c=await row('messenger_conversations',cid);assert.equal(c.needs_attention,true);
   await app('takeover',{conversation_id:cid,version:c.version,takeover:true});c=await row('messenger_conversations',cid);
   await app('takeover',{conversation_id:cid,version:c.version,takeover:false});assert.equal(await svc('claim'),null);
   assert.equal((await row('messenger_messages',unsupported.id)).error_code,'unsupported_message');
   // Use another customer without an open order so source validation is exercised.
   await intake('coffee price',{sender_id:'300'});const work=await svc('claim');
   await finish(work,{body:'Coffee costs 150 pesos.',sources:[{id:product,version:1}]});const offer=await svc('offer');
   await db.query('update public.products set version=version+1 where id=$1',[product]);
   assert.equal((await svc('authorize',offer)).allowed,false);
  });
  await t.test('corrected, expired, and price-changed summaries cannot create orders',async()=>{
   async function summary(sender) {
    await intake('coffee',{sender_id:sender});const work=await svc('claim');
    const reply=await finish(work,{body:'Review coffee',sources:[{id:product,version:2}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'}});
    await send();return (await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
   }
   const corrected=await summary('301');
   await intake('change quantity',{sender_id:'301'});await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_summaries',corrected.id)).valid,false);
   await intake(`CONFIRM ${corrected.code}`,{sender_id:'301'});await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_summaries',corrected.id)).order_id,null);
   const expired=await summary('302');await db.query("update public.messenger_summaries set expires_at=now()-interval '1 second' where id=$1",[expired.id]);
   await intake(`CONFIRM ${expired.code}`,{sender_id:'302'});await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_summaries',expired.id)).order_id,null);
   const changed=await summary('303');await db.query('update public.products set price_centavos=price_centavos+100,version=version+1 where id=$1',[product]);
   await intake(`CONFIRM ${changed.code}`,{sender_id:'303'});await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_summaries',changed.id)).order_id,null);
   assert.equal((await db.query('select count(*)::int n from public.orders')).rows[0].n,1);
  });
  await t.test('expired hook offers get a new token; failed AI retries retain the original message',async()=>{
   await intake('question');let work=await svc('claim');await finish(work,{error:'provider'});
   let c=await row('messenger_conversations',cid);
   const request_id=randomUUID();const payload={conversation_id:cid,version:c.version,message_id:work.message.id,request_id};
   const first=await app('retry',payload);assert.equal((await app('retry',payload)).id,first.id);
   work=await svc('claim');await finish(work);const offer=await svc('offer');
   await db.query("update public.messenger_messages set lease_until=now()-interval '1 second' where id=$1",[offer.job_id]);
   await db.query("update public.messenger_attempts set created_at=now()-interval '3 minutes' where id=$1",[offer.attempt_id]);
   await svc('claim');const next=await svc('offer');assert.equal(next.job_id,offer.job_id);assert.notEqual(next.attempt_id,offer.attempt_id);
   assert.equal((await svc('authorize',offer)).allowed,false);assert.equal((await svc('authorize',next)).allowed,true);
   await svc('result',{...next,outcome:'accepted'});
  });
  await t.test('window expiry and integration pause suppress external actions',async()=>{
   await intake('hello');await finish(await svc('claim'));const offer=await svc('offer');
   await db.query("update public.messenger_conversations set last_customer_at=now()-interval '25 hours' where id=$1",[cid]);
   assert.equal((await svc('authorize',offer)).allowed,false);
   await intake('fresh');await finish(await svc('claim'));const next=await svc('offer');
   const c=await row('messenger_connections',conn);await app('enabled',{enabled:false,version:c.version});
   assert.equal((await svc('authorize',next)).allowed,false);
   const liveOrder=(await db.query('select * from public.orders limit 1')).rows[0];
   await command(staff,{op:'transition_order',business_id:bid,id:liveOrder.id,version:liveOrder.version,status:'ready'});
   const notice=(await db.query("select * from public.messenger_messages where order_id=$1 and kind='status' order by seq desc limit 1",[liveOrder.id])).rows[0];
   assert.equal(notice.state,'suppressed');
   const paused=await row('messenger_connections',conn);await app('enabled',{enabled:true,version:paused.version});
   assert.equal(await svc('offer'),null);
   assert.equal((await db.query('select count(*)::int n from public.messenger_conversations where business_id=$1',[bid2])).rows[0].n,0);
  });
 } finally { await db.close(); }
});
