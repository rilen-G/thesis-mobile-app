import { PGlite } from '@electric-sql/pglite';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';

export async function databaseEngine(real=false){
 if(!real)return new PGlite();
 const listener=createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 const root=resolve('.test-artifacts');await mkdir(root,{recursive:true});
 const databaseDir=resolve(root,`postgres-${randomUUID()}`);
 if(!databaseDir.startsWith(root+ (process.platform==='win32'?'\\':'/')))throw new Error('Test directory escaped workspace');
 const password=randomUUID();
 const cluster=new EmbeddedPostgres({databaseDir,user:'postgres',password,port,persistent:true,createPostgresUser:false,postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:()=>{}});
 await cluster.initialise();await cluster.start();
 const pool=new pg.Pool({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',max:8});
 return {
  exec:(sql)=>pool.query(sql),query:(sql,args)=>pool.query(sql,args),
  async transaction(fn){const client=await pool.connect();try{await client.query('begin');const result=await fn({exec:(sql)=>client.query(sql),query:(sql,args)=>client.query(sql,args)});await client.query('commit');return result;}catch(error){await client.query('rollback');throw error;}finally{client.release();}},
  async close(){await pool.end();await cluster.stop();},
 };
}
