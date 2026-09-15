/// <reference types="node" />
import test from 'node:test';
import assert from 'node:assert/strict';
import { money, parsePrice, pickupTimestamp, quantity, transitions } from '../src/features/operations/domain';
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
test('pending save survives restart, keeps retry key, and isolates accounts',async()=>{
 const values=new Map<string,string>();const storage={getItem:async(key:string)=>values.get(key)??null,setItem:async(key:string,value:string)=>{values.set(key,value);},removeItem:async(key:string)=>{values.delete(key);}};
 const first=pendingJournal(storage,'owner');const operation={payload:{op:'create_order',id:'record'},requestId:'stable-request'};
 await first.prepare(operation);
 const restarted=pendingJournal(storage,'owner');assert.deepEqual(await restarted.read(),operation);
 assert.equal((await restarted.prepare({...operation,requestId:'new-id'})).requestId,'stable-request');
 await assert.rejects(restarted.prepare({payload:{op:'create_order',id:'other'},requestId:'new'}),/uncertain result/);
 assert.equal(await pendingJournal(storage,'staff').read(),null);
 await restarted.clear();assert.equal(await first.read(),null);
});
