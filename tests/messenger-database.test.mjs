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
   await command(owner,{op:'save_product',business_id:bid,id:randomUUID(),version:0,name:'Tea',price_centavos:9000,active:true});
   await as(owner,tx=>tx.query('select public.knowledge_command($1)',[{op:'knowledge',business_id:bid,id:randomUUID(),request_id:randomUUID(),version:0,title:'Pickup',body:'Collect at the counter.',approved:true}]));
   await intake('one coffee');const work=await svc('claim');
   assert.equal(work.history.at(-1).body,'one coffee');assert.ok(work.history.every(m=>typeof m.body==='string'));
   assert.equal(work.knowledge[0].body,'Collect at the counter.');assert.equal(work.allocations[0].total,2);
   const reply=await finish(work,{body:'Review coffee',sources:[{id:product,version:1}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash',notes:'less ice'}});
   await send();const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
   await intake(`CONFIRM ${summary.code}`);const confirmed=await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_messages',confirmed.id)).body,'Your order (1 × Coffee) is confirmed and your items are reserved. We will message you when staff accepts it.');
   const saved=await row('messenger_summaries',summary.id);assert.ok(saved.order_id);
   const order=await row('orders',saved.order_id);assert.equal(order.status,'confirmed');assert.equal(Number(order.total_centavos),15000);assert.equal(order.notes,'less ice');
   await assert.rejects(command(staff,{op:'update_order',business_id:bid,id:order.id,version:order.version,pickup_at:pickup,payment_method:'GCash',notes:''}),/messenger_order_locked/);
   assert.deepEqual((await db.query('select product_id,name,quantity from public.order_items where order_id=$1',[order.id])).rows,[{product_id:product,name:'Coffee',quantity:1}]);
   assert.equal(order.reserved,true);assert.equal((await db.query('select used from public.daily_allocations where product_id=$1',[product])).rows[0].used,1);
   await intake(`CONFIRM ${summary.code}`);const again=await finish(await svc('claim'));await send();
   assert.equal((await row('messenger_messages',again.id)).body,'Your order (1 × Coffee) is already confirmed. Staff will handle it.');
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
  await t.test('reserved confirmed orders restore stock when rejected or expired; replies follow the conversation language',async()=>{
   const used=async()=>(await db.query('select used from public.daily_allocations where product_id=$1',[product])).rows[0].used;const start=await used();
   for(const [sender,status] of [['310','rejected'],['311','expired']]) {
    await intake('isang coffee po',{sender_id:sender});const work=await svc('claim');
    const reply=await finish(work,{body:'Pakicheck po',sources:[{id:product,version:(await row('products',product)).version}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'},language:'taglish'});
    assert.doesNotMatch((await row('messenger_messages',reply.id)).body,/CONFIRM/);await send();
    const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
    await intake(`CONFIRM ${summary.code}`,{sender_id:sender});const confirmed=await finish(await svc('claim'));await send();
    assert.equal((await row('messenger_messages',confirmed.id)).body,'Confirmed na po ang order niyo (1 × Coffee) at naka-reserve na ang items. Imi-message namin kayo pag in-accept na ng staff.');assert.equal(await used(),start+1);
    const order=await row('orders',(await row('messenger_summaries',summary.id)).order_id);
    await command(staff,{op:'transition_order',business_id:bid,id:order.id,version:order.version,status,reason:'test'});
    assert.equal(await used(),start);
    const notice=(await db.query("select body from public.messenger_messages where order_id=$1 and kind='status'",[order.id])).rows[0];
    if(status==='rejected'){assert.equal(notice.body,'Pasensya na po, hindi po namin ma-accommodate ang order niyo (1 × Coffee): test');assert.equal((await row('orders',order.id)).rejection_reason,'test');}
    else assert.match(notice.body,/Expired na po/);
    await send();
   }
  });
  await t.test('typed yes confirms and unclear replies re-ask without invalidating the pending summary',async()=>{
   const version=async()=>(await row('products',product)).version;
   await intake('coffee',{sender_id:'320'});let work=await svc('claim');
   const reply=await finish(work,{body:'Please check your order',sources:[{id:product,version:await version()}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'}});
   const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
   let offer=await svc('offer');let auth=await svc('authorize',offer);assert.equal(auth.code,summary.code);await svc('result',{...offer,outcome:'accepted'});
   await intake('hmm',{sender_id:'320',reply_kind:'unclear'});assert.equal((await row('messenger_summaries',summary.id)).valid,true);
   work=await svc('claim');assert.equal(work.summary.code,summary.code);await finish(work,{body:'Would you like to confirm this order?'});
   offer=await svc('offer');assert.equal((await svc('authorize',offer)).code,summary.code);await svc('result',{...offer,outcome:'accepted'});
   const sticker=await intake('',{sender_id:'320',unsupported:true,reply_kind:'unclear'});assert.equal((await row('messenger_messages',sticker.id)).state,'pending');
   work=await svc('claim');assert.equal(work.message.error_code,'unsupported_message');assert.equal(work.summary.code,summary.code);await finish(work,{body:'Would you like to confirm this order?'});await send();
   await intake('oo po',{sender_id:'320',reply_kind:'yes'});work=await svc('claim');
   await finish(work,{body:'Checking your confirmation.',confirm_code:work.summary.code});
   const orderId=(await row('messenger_summaries',summary.id)).order_id;assert.ok(orderId);await send();
   for(const next of ['accepted','ready','completed']) {const current=await row('orders',orderId);await command(staff,{op:'transition_order',business_id:bid,id:orderId,version:current.version,status:next});await send();}
   assert.equal((await db.query("select body from public.messenger_messages where order_id=$1 and kind='status' order by seq desc limit 1",[orderId])).rows[0].body,'Thank you for picking up your order (1 × Coffee)! Follow our Page for new menu updates.');
  });
  await t.test('an edited order invalidates the old summary so its code can no longer confirm',async()=>{
   await db.query('update public.daily_allocations set total=total+5 where product_id=$1',[product]);
   await intake('coffee',{sender_id:'321'});const work=await svc('claim');
   const reply=await finish(work,{body:'Please check your order',sources:[{id:product,version:(await row('products',product)).version}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'}});await send();
   const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
   await intake('make it 2 please',{sender_id:'321'});assert.equal((await row('messenger_summaries',summary.id)).valid,false);
   const next=await svc('claim');assert.equal(next.summary,null);
   await finish(next,{body:'Checking your confirmation.',confirm_code:summary.code});await send();
   assert.equal((await row('messenger_summaries',summary.id)).order_id,null);
  });
  await t.test('a new order while another is active gets its own summary, order, and notices',async()=>{
   const place=async()=>{await intake('coffee',{sender_id:'322'});const work=await svc('claim');
    const reply=await finish(work,{body:'Please check your order',sources:[{id:product,version:(await row('products',product)).version}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'cash'}});await send();
    const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];assert.ok(summary);
    await intake('CONFIRM '+summary.code,{sender_id:'322'});await finish(await svc('claim'));await send();
    return (await row('messenger_summaries',summary.id)).order_id;};
   const first=await place();const second=await place();assert.ok(first&&second&&first!==second);
   const order=await row('orders',first);await command(staff,{op:'transition_order',business_id:bid,id:first,version:order.version,status:'rejected',reason:'Sold out'});
   assert.deepEqual((await db.query("select body from public.messenger_messages where order_id=$1 and kind='status'",[first])).rows,[{body:"Sorry, we can't accommodate your order (1 × Coffee) because it's sold out today."}]);await send();
  });
  await t.test('only Cash or GCash summaries confirm; stale status notices are labelled superseded',async()=>{
   const place=async(payment)=>{await intake('coffee',{sender_id:'323'});const work=await svc('claim');
    const reply=await finish(work,{body:'Please check your order',sources:[{id:product,version:(await row('products',product)).version}],draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:payment}});await send();
    const summary=(await db.query('select * from public.messenger_summaries where message_id=$1',[reply.id])).rows[0];
    await intake('CONFIRM '+summary.code,{sender_id:'323'});await finish(await svc('claim'));await send();
    return (await row('messenger_summaries',summary.id)).order_id;};
   assert.equal(await place('card'),null);
   const id=await place('Cash');assert.ok(id);
   for(const status of ['accepted','ready','completed']){const order=await row('orders',id);await command(staff,{op:'transition_order',business_id:bid,id,version:order.version,status});}
   for(let i=0;i<2;i++){const offer=await svc('offer');assert.equal((await svc('authorize',offer)).allowed,false);assert.equal((await row('messenger_messages',offer.job_id)).error_code,'status_superseded');}
   const last=await send();assert.match((await row('messenger_messages',last.job_id)).body,/Thank you for picking up your order/);
  });
  await t.test('follow-ups: off by default, timed FU1/FU2, responses, closing, opt-out, confirmation, and stop checks',async()=>{
   const followup=trigger=>({trigger,detail:trigger==='incomplete'?'pickup':null,product_ids:[product],fu1_template:trigger+'_1',fu1_body:'FU1 '+trigger,fu2_template:trigger+'_2',fu2_body:'FU2 '+trigger});
   const caseOf=async sender=>(await db.query('select f.* from public.messenger_followups f join public.messenger_conversations c on c.id=f.conversation_id where c.sender_id=$1 order by f.created_at desc limit 1',[sender])).rows[0];
   const due=(id,column='fu1_due_at')=>db.query('update public.messenger_followups set '+column+"=now()-interval '1 second' where id=$1",[id]);
   const state=async id=>{const g=await row('messenger_followups',id);return [g.status,g.end_reason];};
   const open=async(sender,trigger='incomplete',draft=false)=>{await intake('order po',{sender_id:sender});const work=await svc('claim');
    await finish(work,{body:'What time?',sources:draft?[{id:product,version:(await row('products',product)).version}]:[],followup:followup(trigger),...(draft?{draft:{items:[{product_id:product,quantity:1}],pickup_at:pickup,payment_method:'Cash'}}:{})});
    await send();return caseOf(sender);};
   const fu1=async(sender,trigger,draft)=>{const c=await open(sender,trigger,draft);await due(c.id);assert.equal((await svc('followups')).queued,1);await send();return row('messenger_followups',c.id);};
   const reply=async(sender,text,extra={})=>{const r=await intake(text,{sender_id:sender,...extra});const w=await svc('claim');if(w){await finish(w);await send();}return r;};
   await db.query('update public.daily_allocations set total=total+20 where product_id=$1',[product]);
   assert.equal(await open('330'),undefined);
   let connection=await row('messenger_connections',conn);assert.equal(connection.followups_enabled,false);
   await assert.rejects(app('followups',{enabled:true,version:connection.version},staff),/permission_denied/);
   await app('followups',{enabled:true,version:connection.version});
   let c=await open('331');assert.equal(c.status,'eligible_first');assert.equal(new Date(c.fu1_due_at)-new Date(c.customer_at),30*60000);
   assert.equal((await svc('followups')).queued,0);
   await due(c.id);assert.equal((await svc('followups')).queued,1);
   c=await row('messenger_followups',c.id);assert.equal(c.status,'first_sent');
   const first=await row('messenger_messages',c.fu1_message_id);assert.equal(first.kind,'followup');assert.equal(first.body,'FU1 incomplete');
   await send();await svc('followups');assert.equal((await row('messenger_followups',c.id)).status,'eligible_second');
   assert.equal((await svc('followups')).queued,0);
   await due(c.id,'fu2_due_at');assert.equal((await svc('followups')).queued,1);await send();
   c=await row('messenger_followups',c.id);assert.equal(c.status,'second_sent');assert.equal((await row('messenger_messages',c.fu2_message_id)).body,'FU2 incomplete');
   await due(c.id,'fu2_due_at');assert.equal((await svc('followups')).queued,0);
   await db.query("update public.messenger_followups set fu1_sent_at=now()-interval '25 hours' where id=$1",[c.id]);await svc('followups');
   assert.deepEqual(await state(c.id),['closed_no_response','no_response']);
   c=await fu1('332','incomplete');await reply('332','7pm po');c=await row('messenger_followups',c.id);
   assert.equal(c.status,'recovered');assert.ok(c.responded_at);assert.ok(c.response_seconds>=0);
   c=await open('333');await reply('333','7pm po');assert.deepEqual(await state(c.id),['not_eligible','customer_replied']);
   c=await open('334');const bye=await reply('334','salamat po',{reply_kind:'closing'});
   assert.deepEqual(await state(c.id),['not_eligible','closing_message']);assert.equal((await row('messenger_messages',bye.id)).state,'done');
   c=await fu1('335','inquiry');await reply('335','salamat po',{reply_kind:'closing'});
   assert.equal((await row('messenger_followups',c.id)).status,'recovered');assert.ok((await row('messenger_followups',c.id)).responded_at);
   c=await fu1('336','incomplete');const stop=await reply('336','stop',{reply_kind:'opt_out'});
   assert.deepEqual(await state(c.id),['not_eligible','opt_out']);assert.ok((await row('messenger_followups',c.id)).responded_at);assert.equal((await row('messenger_messages',stop.id)).state,'done');
   const skip=async(sender,setup,expected,undo)=>{const d=await open(sender);await setup(d);await due(d.id);await svc('followups');const result=await state(d.id);if(undo)await undo(d);assert.deepEqual(result,expected);};
   await skip('337',async()=>{const v=await row('messenger_connections',conn);await app('enabled',{enabled:false,version:v.version});},['skipped_manual','ai_paused'],
    async()=>{const v=await row('messenger_connections',conn);await app('enabled',{enabled:true,version:v.version});});
   await skip('338',async d=>{const v=await row('messenger_conversations',d.conversation_id);await app('takeover',{conversation_id:v.id,version:v.version,takeover:true});},['skipped_manual','manual_handling']);
   await skip('339',d=>db.query("update public.messenger_conversations set last_customer_at=now()-interval '25 hours' where id=$1",[d.conversation_id]),['skipped_window','window_expired']);
   const used=(await db.query('select used from public.daily_allocations where product_id=$1',[product])).rows[0].used;
   await skip('340',()=>db.query('update public.daily_allocations set used=total where product_id=$1',[product]),['skipped_unavailable','item_unavailable'],
    ()=>db.query('update public.daily_allocations set used=$2 where product_id=$1',[product,used]));
   await skip('341',()=>db.query("update public.businesses set opening_time=case when extract(hour from now() at time zone 'Asia/Manila')<22 then make_time(extract(hour from now() at time zone 'Asia/Manila')::int+1,0,0) else '00:00' end, cutoff_time=case when extract(hour from now() at time zone 'Asia/Manila')<22 then make_time(extract(hour from now() at time zone 'Asia/Manila')::int+2,0,0) else '01:00' end where id=$1",[bid]),
    ['skipped_closed','business_closed'],()=>db.query("update public.businesses set opening_time='00:00',cutoff_time='23:59:59' where id=$1",[bid]));
   c=await open('342','draft',true);
   assert.equal((await db.query("select s.expires_at=(((now() at time zone 'Asia/Manila')::date+b.cutoff_time) at time zone 'Asia/Manila') ok from public.messenger_summaries s join public.businesses b on b.id=s.business_id where s.id=$1",[c.summary_id])).rows[0].ok,true);
   await db.query('update public.messenger_summaries set valid=false where id=$1',[c.summary_id]);await due(c.id);await svc('followups');
   assert.deepEqual(await state(c.id),['closed_no_response','draft_expired']);
   c=await open('343','draft',true);const summary=await row('messenger_summaries',c.summary_id);await due(c.id);await svc('followups');
   const offer=await svc('offer');assert.equal((await svc('authorize',offer)).code,summary.code);await svc('result',{...offer,outcome:'accepted'});
   await reply('343','CONFIRM '+summary.code);c=await row('messenger_followups',c.id);assert.equal(c.status,'recovered');assert.ok(c.order_id);
   c=await open('344','draft',true);await reply('344','CONFIRM '+(await row('messenger_summaries',c.summary_id)).code);
   assert.deepEqual(await state(c.id),['not_eligible','confirmed']);assert.ok((await row('messenger_followups',c.id)).order_id);
   c=await open('345');await due(c.id);await svc('followups');const queued=(await row('messenger_followups',c.id)).fu1_message_id;
   await reply('345','7pm po');assert.equal((await row('messenger_messages',queued)).state,'suppressed');assert.deepEqual(await state(c.id),['not_eligible','customer_replied']);
   c=await open('346');connection=await row('messenger_connections',conn);await app('followups',{enabled:false,version:connection.version});
   assert.deepEqual(await state(c.id),['skipped_manual','disabled']);await due(c.id);assert.equal((await svc('followups')).queued,0);
  });
 } finally { await db.close(); }
});
