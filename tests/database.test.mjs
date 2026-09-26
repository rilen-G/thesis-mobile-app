import test from 'node:test';
import assert from 'node:assert/strict';
import { databaseEngine } from './database-engine.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

await test('Business operations database suite', async (t) => {
const realPostgres=process.env.OPERATIONS_TEST_ENGINE === 'postgres';
const db = await databaseEngine(realPostgres);
try {
const owner=randomUUID(), staff=randomUUID(), stranger=randomUUID(), otherOwner=randomUUID();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert on storage.objects to authenticated;`);
// Fresh hosted projects may give client roles broad default privileges. The
// baseline must explicitly narrow these, not rely on a pristine PostgreSQL ACL.
await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;`);
for(const file of (await readdir('supabase/migrations')).filter(file=>file.endsWith('.sql')).sort()) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
for(const [id,email] of [[owner,'owner@test.invalid'],[staff,'staff@test.invalid'],[stranger,'stranger@test.invalid'],[otherOwner,'other@test.invalid']]) await db.query('insert into auth.users values($1,$2,now())',[id,email]);
async function as(user,fn){return db.transaction(async(tx)=>{await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);return fn(tx);});}
async function cmd(user,payload){return as(user,async(tx)=>(await tx.query('select public.app_command($1::jsonb) as result',[JSON.stringify({request_id:randomUUID(),...payload})])).rows[0].result);}
async function snap(user){return as(user,async(tx)=>(await tx.query('select public.app_snapshot() as result')).rows[0].result);}
const bid=(await cmd(owner,{op:'create_business',name:'Kitchen'})).id;
const bid2=(await cmd(otherOwner,{op:'create_business',name:'Other kitchen'})).id;
const b=(op,more={})=>({op,business_id:bid,...more});
const customer=randomUUID(), product=randomUUID();
let day, pickup;
await t.test('owner/staff bootstrap and business isolation',async()=>{
 await cmd(owner,b('add_staff',{email:'staff@test.invalid'}));
 assert.equal((await snap(staff)).role,'staff');assert.equal(await snap(stranger),null);assert.equal((await snap(otherOwner)).business.id,bid2);
 await assert.rejects(cmd(staff,b('save_business',{name:'Attacker'})),/permission_denied/);
 await assert.rejects(cmd(otherOwner,b('save_customer',{id:randomUUID(),version:0,name:'Leak'})),/permission_denied/);
 await assert.rejects(as(staff,tx=>tx.exec("update public.business_members set role='owner'")),/permission denied/);
 await assert.rejects(as(staff,tx=>tx.exec("insert into public.products(id,business_id,name,price_centavos) values(gen_random_uuid(),gen_random_uuid(),'bypass',1)")),/permission denied/);
});
await t.test('menu categories persist, validate, isolate, and replay safely',async()=>{
 const id=randomUUID();
 const save=(more={})=>b('save_product',{id,version:0,name:'Category item',price_centavos:100,active:true,...more});
 const request_id=randomUUID();
 await cmd(owner,save({category:'Rice Meals',request_id}));
 assert.equal((await snap(staff)).products.find(p=>p.id===id).category,'Rice Meals');
 await assert.rejects(cmd(staff,save({version:1,category:'Drinks'})),/permission_denied/);
 await assert.rejects(cmd(otherOwner,save({version:1,category:'Drinks'})),/permission_denied/);
 await assert.rejects(cmd(owner,save({version:1,category:'All'})),/Invalid menu category/);
 await assert.rejects(cmd(owner,save({version:1,category:12})),/Invalid menu category/);
 assert.equal((await snap(owner)).products.find(p=>p.id===id).version,1);
 await cmd(owner,save({version:1,category:'Drinks'}));
 await cmd(owner,save({category:'Rice Meals',request_id}));
 assert.equal((await snap(owner)).products.find(p=>p.id===id).category,'Drinks');
 await assert.rejects(cmd(owner,save({category:'Desserts',request_id})),/request_conflict/);
 await cmd(owner,save({version:2}));
 assert.equal((await snap(owner)).products.find(p=>p.id===id).category,'Drinks');
 await cmd(owner,save({version:3,category:null}));
 assert.equal((await snap(owner)).products.find(p=>p.id===id).category,null);
 await assert.rejects(cmd(owner,save({version:3,category:'Sizzling'})),/conflict/);
 for(const invalid of ['', '   ', 'all', 'Uncategorized', 'x'.repeat(41), 'Bad\nCategory',true,{},[]])await assert.rejects(cmd(owner,save({version:4,category:invalid})),/Invalid menu category/);
 await cmd(owner,save({version:4,category:'  Coffee  '}));
 assert.equal((await snap(owner)).products.find(p=>p.id===id).category,'Coffee');
 await cmd(owner,save({version:5,category:'coffee'}));
 assert.equal((await snap(owner)).products.find(p=>p.id===id).category,'Coffee');
 assert.equal((await snap(otherOwner)).products.length,0);
 // The command service permits server-generated IDs; categories must follow its returned ID.
 const generatedPayload=save({id:undefined,category:'Drinks',request_id:randomUUID()});
 const generated=await cmd(owner,generatedPayload);
 assert.equal((await snap(owner)).products.find(p=>p.id===generated.id).category,'Drinks');
 assert.deepEqual(await cmd(owner,generatedPayload),generated);
 assert.equal((await snap(owner)).products.filter(p=>p.id===generated.id).length,1);
 await db.query('delete from public.products where id=$1',[generated.id]);
 // Keep the rest of the suite's original product assumptions intact.
 await db.query('delete from public.products where id=$1',[id]);
});
await t.test('persistent customer/menu and stale updates',async()=>{
 await cmd(staff,b('save_customer',{id:customer,version:0,name:'Customer',phone:'09123456789',notes:'Pickup'}));
 await cmd(owner,b('save_product',{id:product,version:0,name:'Meal',price_centavos:12550,active:true}));
 const data=await snap(owner); day=data.today;
 // Set an isolated test clock through the order pickup. No production clock override exists.
 const now=(await db.query("select now() as now")).rows[0].now;
 pickup=new Date(new Date(now).getTime()+60000).toISOString();
 await assert.rejects(cmd(staff,b('save_product',{id:product,version:1,name:'bad',price_centavos:1,active:true})),/permission_denied/);
 await assert.rejects(cmd(owner,b('save_product',{id:product,version:9,name:'bad',price_centavos:1,active:true})),/conflict/);
 await assert.rejects(cmd(owner,b('save_product',{id:product,version:1,name:'bad',price_centavos:-1,active:true})),/check constraint/);
 assert.equal((await snap(staff)).customers[0].name,'Customer');
 assert.equal((await snap(otherOwner)).products.length,0);
});
await t.test('private immutable storage paths enforce owner and tenant boundaries',async()=>{
 const path=`${bid}/${product}/${randomUUID()}.jpeg`;
 await as(owner,tx=>tx.query("insert into storage.objects(bucket_id,name) values('product-photos',$1)",[path]));
 assert.equal((await as(staff,tx=>tx.query('select * from storage.objects'))).rows.length,1);
 assert.equal((await as(otherOwner,tx=>tx.query('select * from storage.objects'))).rows.length,0);
 await assert.rejects(as(staff,tx=>tx.query("insert into storage.objects(bucket_id,name) values('product-photos',$1)",[`${bid}/${product}/bad.jpeg`])),/row-level security/);
 await assert.rejects(cmd(owner,b('save_product',{id:product,version:1,name:'Meal',price_centavos:12550,active:true,photo_path:`${bid2}/${product}/bad.jpeg`})),/Invalid product photo/);
 await cmd(owner,b('save_product',{id:product,version:1,name:'Meal',price_centavos:12550,active:true,photo_path:path}));
 assert.equal((await snap(owner)).products[0].photo_path,path);
 await assert.rejects(as(owner,tx=>tx.exec('delete from storage.objects')),/permission denied/);
});
async function createOrder(n=1,id=randomUUID(),request_id=randomUUID()){
 await cmd(staff,b('create_order',{id,request_id,customer_id:customer,pickup_at:pickup,payment_method:'Cash',items:[{product_id:product,quantity:n}]}));return id;
}
async function transition(id,status,version,reason='Test reason',request_id=randomUUID()) {return cmd(staff,b('transition_order',{id,status,version,reason,request_id}));}
await t.test('allocation reason, version and historical date protections',async()=>{
 await assert.rejects(cmd(owner,b('set_allocation',{id:product,business_date:day,total:1,version:0,reason:''})),/reason/);
 await assert.rejects(cmd(owner,b('set_allocation',{id:product,business_date:'2000-01-01',total:1,version:0,reason:'bad'})),/Only today/);
 await cmd(owner,b('set_allocation',{id:product,business_date:day,total:1,version:0,reason:'Opening'}));
 await assert.rejects(cmd(owner,b('set_allocation',{id:product,business_date:day,total:4,version:0,reason:'stale'})),/conflict/);
});
let first;
await t.test('confirmed orders do not allocate; rules approval gates staff acceptance',async()=>{
 first=await createOrder(); assert.equal((await snap(owner)).allocations[0].used,0);
 assert.equal((await snap(owner)).orders.find(o=>o.id===first).status,'confirmed');
 await assert.rejects(transition(first,'accepted',1),/rules_required/);
 await cmd(owner,b('save_business',{version:1,name:'Kitchen',address:'Address',opening_time:'00:00',cutoff_time:'23:59:59',rules_approved:true,restore_before_preparing:true,default_post_format:'Text only'}));
});
await t.test('acceptance retries allocate once; competing requests cannot oversell (engine-specific)' ,async()=>{
 const second=await createOrder();const firstRequest=randomUUID();const secondRequest=randomUUID();
 const results=await Promise.allSettled([transition(first,'accepted',1,'',firstRequest),transition(second,'accepted',1,'',secondRequest)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await snap(owner)).allocations[0].used,1);
 const request_id=results[0].status==='fulfilled'?firstRequest:secondRequest;
 if(results[0].status!=='fulfilled')first=second;
 await transition(first,'accepted',1,'',request_id);assert.equal((await snap(owner)).allocations[0].used,1);
 await assert.rejects(transition(first,'accepted',1,'changed',request_id),/request_conflict/);
 await assert.rejects(transition(first,'completed',2),/invalid_transition/);
 await assert.rejects(cmd(owner,b('set_allocation',{id:product,business_date:day,total:0,version:2,reason:'bad'})),/below/);
});
await t.test('rejection after acceptance restores once and requires a reason',async()=>{
 await assert.rejects(transition(first,'rejected',2,''),/reason/);
 const req=randomUUID();await transition(first,'rejected',2,'Cannot fulfill',req);await transition(first,'rejected',2,'Cannot fulfill',req);
 assert.equal((await snap(owner)).allocations[0].used,0);await assert.rejects(transition(first,'accepted',3),/invalid_transition/);
});
await t.test('prices are immutable and ready orders cannot be rejected',async()=>{
 const id=await createOrder();await cmd(owner,b('save_product',{id:product,version:2,name:'Meal changed',price_centavos:99999,active:true,category:'Rice Meals'}));
 await transition(id,'accepted',1);await transition(id,'ready',2);await assert.rejects(transition(id,'rejected',3),/invalid_transition/);
 const data=await snap(owner);assert.equal(data.orders.find(o=>o.id===id).total_centavos,12550);assert.equal(data.items.find(i=>i.order_id===id).name,'Meal');assert.equal(data.allocations[0].used,1);
 const current=data.products.find(p=>p.id===product);
 await cmd(owner,b('save_product',{...current,category:'Sizzling'}));
 const recategorized=await snap(owner);
 assert.equal(recategorized.products.find(p=>p.id===product).category,'Sizzling');
 assert.deepEqual(recategorized.orders,data.orders);
 assert.deepEqual(recategorized.items,data.items);
 assert.deepEqual(recategorized.allocations,data.allocations);
});
await t.test('rejected accepted orders restore; unclaimed ready orders remain uncollected',async()=>{
 let data=await snap(owner);await cmd(owner,b('set_allocation',{id:product,business_date:day,total:3,version:data.allocations[0].version,reason:'More portions'}));
 const id=await createOrder();await transition(id,'accepted',1);await transition(id,'rejected',2);assert.equal((await snap(owner)).allocations[0].used,1);
 const next=await createOrder();await transition(next,'accepted',1);await transition(next,'ready',2);assert.equal((await snap(owner)).allocations[0].used,2);
 assert.equal((await snap(owner)).orders.find(o=>o.id===next).status,'ready');
});
await t.test('order creation is idempotent; duplicates and cross-business references fail',async()=>{
 const id=randomUUID(),req=randomUUID();await createOrder(1,id,req);await createOrder(1,id,req);
 assert.equal((await snap(owner)).orders.filter(o=>o.id===id).length,1);
 const otherCustomer=randomUUID();await cmd(otherOwner,{op:'save_customer',business_id:bid2,id:otherCustomer,version:0,name:'Other'});
 await assert.rejects(cmd(staff,b('create_order',{id:randomUUID(),customer_id:otherCustomer,pickup_at:pickup,payment_method:'Cash',items:[{product_id:product,quantity:1}]})),/active customer/);
 await assert.rejects(cmd(staff,b('create_order',{id:randomUUID(),customer_id:customer,pickup_at:pickup,payment_method:'Cash',items:[{product_id:product,quantity:1},{product_id:product,quantity:1}]})),/unique constraint/);
});
await t.test('multi-item failure rolls back every allocation and the order status',async()=>{
 const secondProduct=randomUUID();await cmd(owner,b('save_product',{id:secondProduct,version:0,name:'Side',price_centavos:5000,active:true}));
 const id=randomUUID();await cmd(staff,b('create_order',{id,customer_id:customer,pickup_at:pickup,payment_method:'Cash',items:[{product_id:product,quantity:1},{product_id:secondProduct,quantity:1}]}));
 const before=(await snap(owner)).allocations[0].used;
 await assert.rejects(transition(id,'accepted',1),/insufficient_quantity/);
 const data=await snap(owner);assert.equal(data.allocations[0].used,before);assert.equal(data.orders.find(o=>o.id===id).status,'confirmed');
});
await t.test('missing versions cannot bypass concurrency checks and old pickups cannot confirm',async()=>{
 const id=await createOrder();
 await assert.rejects(cmd(staff,b('transition_order',{id,status:'accepted'})),/version is required/);
 await assert.rejects(cmd(owner,b('set_allocation',{id:product,business_date:day,total:10,reason:'missing version'})),/version is required/);
 const past=new Date(new Date(pickup).getTime()-120000).toISOString();
 await cmd(staff,b('update_order',{id,version:1,pickup_at:past,payment_method:'Cash',notes:'Past'}));
 await assert.rejects(transition(id,'accepted',2),/pickup_closed/);
});
await t.test('completed orders retain quantity and archived customers cannot receive new orders',async()=>{
 const id=await createOrder();await transition(id,'accepted',1);await transition(id,'ready',2);
 const used=(await snap(owner)).allocations[0].used;await transition(id,'completed',3);assert.equal((await snap(owner)).allocations[0].used,used);
 await assert.rejects(transition(id,'rejected',4),/invalid_transition/);
 await cmd(staff,b('save_customer',{id:customer,version:1,name:'Customer',phone:'09123456789',notes:'',archived:true}));
 await assert.rejects(createOrder(),/active customer/);
 assert.ok((await snap(owner)).orders.some(o=>o.customer_id===customer));
});
await t.test('audit records are owner-only and staff removal applies immediately',async()=>{
 assert.ok((await snap(owner)).events.length>0);assert.equal((await snap(staff)).events.length,0);
 await cmd(owner,b('remove_staff',{id:staff}));assert.equal(await snap(staff),null);
 await assert.rejects(cmd(staff,b('save_customer',{id:randomUUID(),version:0,name:'No access'})),/permission_denied/);
});
await t.test('knowledge supports owner-only versioned idempotent saves',async()=>{
 const save=(user,payload)=>as(user,async tx=>(await tx.query('select public.knowledge_command($1::jsonb) as result',[JSON.stringify({request_id:randomUUID(),business_id:bid,...payload})])).rows[0].result);
 const id=randomUUID(),request_id=randomUUID();
 const payload={op:'knowledge',id,request_id,title:'Pickup',body:'Counter pickup',approved:true,version:0};
 await cmd(owner,b('add_staff',{email:'staff@test.invalid'}));
 for(const user of [staff,otherOwner,stranger]) await assert.rejects(save(user,payload),/permission_denied/);
 await save(owner,payload);await save(owner,payload);
 await assert.rejects(save(owner,{...payload,title:'Changed'}),/request_conflict/);
 await save(owner,{...payload,request_id:randomUUID(),version:1,approved:false});
 await assert.rejects(save(owner,{...payload,request_id:randomUUID(),version:1}),/conflict/);
 await save(owner,payload); // Lost acknowledgement of an older save cannot undo later changes.
 assert.equal((await as(owner,tx=>tx.query('select * from public.knowledge_versions where id=$1',[id]))).rows.length,2);
 assert.equal((await as(owner,tx=>tx.query('select approved from public.business_knowledge where id=$1',[id]))).rows[0].approved,false);
 for(const user of [otherOwner,staff]) assert.equal((await as(user,tx=>tx.query('select * from public.business_knowledge'))).rows.length,0);
 await assert.rejects(as(owner,tx=>tx.query('update public.business_knowledge set approved=true')),/permission denied/);
 await assert.rejects(save(owner,{...payload,id:randomUUID(),request_id:randomUUID(),approved:'true'}),/Invalid knowledge request/);
 await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role anon');await tx.query('select public.knowledge_command($1::jsonb)',[JSON.stringify(payload)]);}),/permission denied/);
});
await t.test('anonymous cannot invoke application RPCs',async()=>{
 await assert.rejects(db.transaction(async(tx)=>{await tx.exec('set local role anon');await tx.query('select public.app_snapshot()');}),/permission denied/);
});





} finally { await db.close(); }
});

