import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {HealthSample} from '@capgo/capacitor-health';
import {adaptarNativo,deduplicarNativas,lerJanelaCompleta} from './nativeAdapter.ts';
const s:HealthSample={dataType:'heartRate',value:73,unit:'bpm',startDate:'2026-01-01T10:00:00Z',endDate:'2026-01-01T10:00:00Z',platformId:'record',sourceId:'app.watch',sourceName:'Watch'};
test('stable key keeps correction and separates samples in Android heart-rate series',()=>{
 const a=adaptarNativo(s)[0],b=adaptarNativo({...s,value:80})[0],c=adaptarNativo({...s,startDate:'2026-01-01T10:01:00Z',endDate:'2026-01-01T10:01:00Z'})[0];
 assert.equal(a.id,b.id);assert.notEqual(a.id,c.id);assert.equal(deduplicarNativas([a,b,c]).length,2);assert.equal(deduplicarNativas([a,b])[0].value,80);
});
test('missing stable source is rejected; sleep awake/in-bed not imported',()=>{
 assert.throws(()=>adaptarNativo({...s,platformId:undefined}));
 for(const sleepState of ['awake','inBed'] as const) assert.equal(adaptarNativo({...s,dataType:'sleep',sleepState}).length,0);
});
test('oxygen percentage is not multiplied twice',()=>{assert.equal(adaptarNativo({...s,dataType:'oxygenSaturation',unit:'percent',value:97})[0].value,97);});
test('sleep stages use their own intervals and exclude awake',()=>{
 const rows=adaptarNativo({...s,dataType:'sleep',stages:[{startDate:'2026-01-01T10:00:00Z',endDate:'2026-01-01T11:00:00Z',stage:'deep',durationMinutes:60},{startDate:'2026-01-01T11:00:00Z',endDate:'2026-01-01T12:00:00Z',stage:'awake',durationMinutes:60}]});
 assert.equal(rows.length,1);assert.equal(rows[0].end,'2026-01-01T11:00:00Z');
});
test('full pages subdivide; unsplittable saturated windows fail',async()=>{
 let calls=0;
 const result=await lerJanelaCompleta(async()=>({samples:++calls===1?Array(1000).fill(s):[s]}),'heartRate',0,10000);
 assert.equal(calls,3);assert.equal(result.length,2);
 await assert.rejects(()=>lerJanelaCompleta(async()=>({samples:Array(1000).fill(s)}),'heartRate',0,500));
});
