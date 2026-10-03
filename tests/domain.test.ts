/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { money, orderLabel, parsePrice, paymentLabel, pickupTimestamp, quantity, transitions, waitingMinutes, type OrderRecord } from '../src/features/operations/domain';
import { pendingJournal } from '../src/features/operations/pending';

test('money uses exact centavos and rejects malformed amounts',()=>{
 assert.equal(parsePrice('0.01'),1);assert.equal(parsePrice('125.50'),12550);assert.equal(money(12550),'₱125.50');
 for(const input of ['-1','1.001','₱5','NaN','1e3',''])assert.throws(()=>parsePrice(input));
});
test('quantities and Manila pickup boundaries',()=>{
 assert.equal(quantity('0'),0);assert.equal(quantity('999999'),999999);
 for(const input of ['-1','1.5','1000000','NaN'])assert.throws(()=>quantity(input));
 assert.equal(pickupTimestamp('2026-09-11','09:30'),'2026-09-11T09:30:00+08:00');assert.throws(()=>pickupTimestamp('2026-09-11','24:00'));
});
test('orders expose only the approved six-state lifecycle',()=>{
 assert.deepEqual(Object.keys(transitions),['confirmed','accepted','ready','completed','rejected','expired']);
 assert.deepEqual(transitions.confirmed,['accepted','rejected']);
 assert.deepEqual(transitions.accepted,['ready','rejected']);
 assert.deepEqual(transitions.ready,['completed']);
 for(const status of ['completed','rejected','expired'] as const)assert.deepEqual(transitions[status],[]);
});
test('pending save survives restart, keeps retry key, and isolates accounts and backends',async()=>{
 const values=new Map<string,string>();const storage={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
 const first=pendingJournal(storage,'owner','project-a');const operation={payload:{op:'create_order',id:'record'},requestId:'stable-request'};
 await first.prepare(operation);
 const restarted=pendingJournal(storage,'owner','project-a');assert.deepEqual(await restarted.read(),operation);
 assert.equal((await restarted.prepare({...operation,requestId:'new-id'})).requestId,'stable-request');
 await assert.rejects(restarted.prepare({payload:{op:'create_order',id:'other'},requestId:'new'}),/uncertain result/);
 assert.equal(await pendingJournal(storage,'staff','project-a').read(),null);
 assert.equal(await pendingJournal(storage,'owner','project-b').read(),null);
 await restarted.clear();assert.equal(await first.read(),null);
});
test('payment methods display as Cash or GCash', () => {
  for (const value of ['gcash', 'G-Cash po', 'GCASH']) assert.equal(paymentLabel(value), 'GCash');
  for (const value of ['cash', 'Cash on pickup', 'cash po']) assert.equal(paymentLabel(value), 'Cash');
  assert.equal(paymentLabel('Card'), 'Card');
});
test('order labels and waiting time use the later of confirmation and opening', () => {
  const order = { status: 'confirmed', created_at: '2026-09-22T23:00:00Z', business_date: '2026-09-23' } as OrderRecord;
  assert.equal(orderLabel(order), 'Confirmed'); assert.equal(orderLabel({ ...order, status: 'expired' }), 'Expired');
  assert.equal(waitingMinutes(order, '08:00:00', Date.parse('2026-09-23T00:20:00Z')), 20);
  assert.equal(waitingMinutes({ ...order, created_at: '2026-09-23T03:00:00Z' }, '08:00:00', Date.parse('2026-09-23T03:16:00Z')), 16);
});
