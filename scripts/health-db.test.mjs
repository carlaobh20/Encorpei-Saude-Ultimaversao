import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',doctor='33333333-3333-4333-8333-333333333333';
const migration=readFileSync(new URL('../supabase/migrations/20261105144003_health_sync_incremental.sql',import.meta.url),'utf8');
const sample={id:'sample-1',sourceId:'watch',source:'Watch',type:'heart_rate',start:'2026-01-01T10:00:00Z',end:'2026-01-01T10:00:00Z',value:72,unit:'bpm'};
async function setup() {
 const db=new PGlite();
 await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${owner}'),('${other}'),('${doctor}'); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon; create function public.is_linked_professional(patient uuid,professional uuid) returns boolean language sql stable as $$select patient='${owner}' and professional='${doctor}'$$;`);
 await db.exec(migration);
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`);
 const {rows}=await db.query("insert into health_connections(patient_user_id,platform) values($1,'apple_health') returning id",[owner]);
 return {db,id:rows[0].id};
}
const send=(db,id,batch,revision,samples=[sample],deletions=[])=>db.query('select health_sync_batch($1,$2,$3,$4::jsonb,$5::jsonb) as result',[id,batch,revision,JSON.stringify(samples),JSON.stringify(deletions)]);
test('incremental database: replay, update, deletion and stale cursor',async()=>{
 const {db,id}=await setup();try{
 const batch='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 await send(db,id,batch,0);const replay=await send(db,id,batch,0);assert.equal(replay.rows[0].result.replayed,true);
 assert.equal((await db.query('select count(*)::int n from health_samples')).rows[0].n,1);
 await assert.rejects(()=>send(db,id,batch,0,[{...sample,value:80}]));
 await assert.rejects(()=>send(db,id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',0));
 await send(db,id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',1,[{...sample,value:80}]);
 assert.equal(Number((await db.query('select value from health_samples')).rows[0].value),80);
 await send(db,id,'dddddddd-dddd-4ddd-8ddd-dddddddddddd',2,[],[{id:sample.id,sourceId:sample.sourceId}]);
 assert.equal((await db.query('select count(*)::int n from health_samples')).rows[0].n,0);
 }finally{await db.close();}
});
test('whole batch rolls back for invalid units, dates, future and oversized input',async()=>{
 const {db,id}=await setup();try{
 for(const bad of [{unit:'Hz'},{value:999},{value:'NaN'},{end:'infinity'},{end:'2099-01-01T10:00:00Z'},{start:'2026-01-01 10:00:00'}]) {
 await assert.rejects(()=>send(db,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,[sample,{...sample,id:'bad',...bad}]));
 assert.equal((await db.query('select count(*)::int n from health_samples')).rows[0].n,0);
 assert.equal(Number((await db.query('select revision from health_connections')).rows[0].revision),0);
 }
 await assert.rejects(()=>send(db,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0,Array(501).fill(sample)));
 }finally{await db.close();}
});
test('RLS: unrelated patient cannot read/write; linked doctor reads but cannot send; anonymous denied',async()=>{
 const {db,id}=await setup();try{
 await send(db,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0);
 await db.exec(`set request.jwt.claim.sub='${other}';`);
 assert.equal((await db.query('select * from health_samples')).rows.length,0);
 await assert.rejects(()=>send(db,id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1));
 await assert.rejects(()=>db.query("insert into health_connections(patient_user_id,platform) values($1,'health_connect')",[owner]));
 await db.exec(`set request.jwt.claim.sub='${doctor}';`);
 assert.equal((await db.query('select * from health_samples')).rows.length,1);
 await assert.rejects(()=>send(db,id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1));
 assert.equal((await db.query('update health_connections set status=\'revoked\' returning id')).rows.length,0);
 await db.exec('reset role; set role anon;');
 await assert.rejects(()=>send(db,id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',1));
 }finally{await db.close();}
});
test('revocation blocks even replay and preserves previously received history',async()=>{
 const {db,id}=await setup();try{
 await send(db,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0);
 await db.query("update health_connections set status='revoked' where id=$1",[id]);
 await assert.rejects(()=>send(db,id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',0));
 assert.equal((await db.query('select count(*)::int n from health_samples')).rows[0].n,1);
 }finally{await db.close();}
});
