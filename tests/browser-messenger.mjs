// Uses mocked Auth/REST responses only. No hosted database or Facebook writes.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
 const errors = [];page.on('pageerror', e => errors.push(e.message));
 const bid=randomUUID(), owner=randomUUID(), cid=randomUUID();let staff=false, failReply=false, missingBackend=true;
 const knowledge=[{id:randomUUID(),title:'Pickup',body:'Collect at the counter.',approved:true,version:1}];
 const connection={id:randomUUID(),business_id:bid,page_name:'Test Page',page_id:'100',enabled:true,verified_at:new Date().toISOString(),
  last_inbound_at:new Date().toISOString(),last_accepted_at:new Date().toISOString(),worker_seen_at:new Date().toISOString(),version:1};
 const conversation={id:cid,sender_id:'200',takeover:false,needs_attention:true,version:1,last_customer_at:new Date().toISOString(),updated_at:new Date().toISOString(),order_id:null};
 const messages=[{id:randomUUID(),seq:1,role:'customer',body:'May coffee po?',state:'done',kind:'inbound',error_code:null,provider_id:null,created_at:new Date().toISOString()}];
 const user={id:owner,aud:'authenticated',role:'authenticated',email:'owner@test.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:new Date().toISOString()};
 const token=[{alg:'HS256',typ:'JWT'},{sub:owner,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},'signature'].map((v,i)=>i===2?v:Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
 await page.route('**/auth/v1/**',async route=>{
  const data=route.request().url().includes('/token')?{access_token:token,refresh_token:'test-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user}:user;
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.route('**/rest/v1/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data;
  if(missingBackend && /\/messenger_(connections|conversations)$/.test(path)) {
   await route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({code:'PGRST205',message:'Missing table'})});return;
  }
  if(path.endsWith('/business_knowledge')) data=staff?[]:knowledge;
  else if(path.endsWith('/rpc/knowledge_command')) {
   const {payload:p}=route.request().postDataJSON();knowledge.push({id:p.id,title:p.title,body:p.body,approved:p.approved,version:1});data={id:p.id};
  }
  else if(path.endsWith('/rpc/app_snapshot')) data={business:{id:bid,name:'Messenger Test Kitchen',opening_time:'00:00',cutoff_time:'23:59',rules_approved:true,version:1},role:staff?'staff':'owner',members:[],products:[],allocations:[],customers:[],orders:[],items:[],events:[],today:'2026-09-23'};
  else if(path.endsWith('/messenger_connections')) data=staff?null:connection;
  else if(path.endsWith('/messenger_conversations')) data=staff?[]:[conversation];
  else if(path.endsWith('/messenger_messages')) data=staff?[]:[...messages].reverse();
  else if(path.endsWith('/rpc/messenger_command')) {
   const {payload:p}=route.request().postDataJSON();
   if(p.op==='takeover'){conversation.takeover=p.takeover;conversation.version++;}
   if(p.op==='reply'){
    if(failReply){await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'P0001',message:'Test failure: reply preserved'})});return;}
    messages.push({id:randomUUID(),seq:messages.length+1,role:'owner',body:p.body,state:'queued',kind:'manual',created_at:new Date().toISOString()});conversation.version++;
   }
   data={id:cid};
  } else data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.UI_TEST_URL||'http://127.0.0.1:8083',{waitUntil:'domcontentloaded',timeout:120000});
 await page.getByPlaceholder('owner@qfacio.test').fill('owner@test.invalid');
 await page.getByPlaceholder('Enter your password').fill('test-password');
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await expect(page.getByRole('button',{name:'Open AI test chat',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Open Messenger inbox',exact:true}).click();
 await page.getByText(/Messenger backend setup is incomplete/).waitFor();
 await expect(page.getByText('No live conversations yet.',{exact:true})).toHaveCount(0);
 await expect(page.getByText(/Messenger is not configured in the backend yet/)).toHaveCount(0);
 missingBackend=false;await page.getByRole('button',{name:'Refresh inbox',exact:true}).click();
 await page.getByText('Test Page · Enabled',{exact:true}).waitFor();
 await page.getByRole('button',{name:/Customer …200/}).click();
 await page.getByText('May coffee po?',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Take over conversation',exact:true}).click();
 await page.getByLabel('Reply to customer',{exact:true}).fill('Available po, how many?');
 failReply=true;await page.getByRole('button',{name:'Send reply',exact:true}).click();
 await page.getByText('Test failure: reply preserved',{exact:true}).waitFor();
 await expect(page.getByLabel('Reply to customer',{exact:true})).toHaveValue('Available po, how many?');
 failReply=false;await page.getByRole('button',{name:'Send reply',exact:true}).click();
 await expect(page.getByLabel('Reply to customer',{exact:true})).toHaveValue('');
 await page.getByText('Available po, how many?',{exact:true}).waitFor();
 await mkdir('.test-artifacts',{recursive:true});await page.screenshot({path:'.test-artifacts/messenger-inbox.png',fullPage:true});
 await page.goto(new URL('/settings',page.url()).href);
 await page.getByRole('button',{name:'Approved knowledge',exact:true}).click();
 await expect(page.getByLabel('Title',{exact:true}).nth(1)).toHaveValue('Pickup');
 await page.getByLabel('Title',{exact:true}).first().fill('Parking');
 await page.getByLabel('Answer / policy',{exact:true}).first().fill('Ask the owner about parking.');
 await page.getByRole('button',{name:'Save knowledge',exact:true}).first().click();
 await expect(page.getByLabel('Title',{exact:true})).toHaveCount(3);
 await page.goto(new URL('/messenger',page.url()).href);
 staff=true;await page.reload();
 await expect(page.getByRole('button',{name:'Take over conversation',exact:true})).toHaveCount(0);
 await expect(page.getByText('May coffee po?',{exact:true})).toHaveCount(0);
 assert.deepEqual(errors,[]);
 console.log('Mocked Messenger UI passed: owner inbox, takeover, preserved failed reply, successful reply, staff restriction; no runtime errors.');
} finally { await browser.close(); }
