import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptarRegistroApple, importarContrato, prepararLinhas, previaDeAmostras, validarAmostra } from "./import.ts";
import { linhasParaLeituras } from "../wearable/normalize.ts";
const sample=(extra={})=>({type:"heart_rate",source:"Watch",start:"2026-01-01T10:00:00-03:00",end:"2026-01-01T10:00:00-03:00",value:72,unit:"bpm",...extra});
test("Apple oxygen fraction and timezone normalize without losing origin",()=>{
 const a=validarAmostra(adaptarRegistroApple({type:"HKQuantityTypeIdentifierOxygenSaturation",sourceName:"Watch",startDate:"2026-01-01 10:00:00 -0300",endDate:"2026-01-01 10:00:00 -0300",value:"0.98",unit:"%"}));
 const rows=prepararLinhas(previaDeAmostras([a]),"Watch","2026-01-01","2026-01-01").linhas;
 assert.equal(rows[0].spo2,98); assert.equal(rows[0].recordedAt,"2026-01-01T13:00:00.000Z");
});
test("invalid units, unknown types and future dates are rejected",()=>{
 for(const extra of [{unit:"Hz"},{type:"glucose"},{value:NaN},{start:"2026-01-01"},{end:"2099-01-01T10:00:00Z"}]) assert.throws(()=>validarAmostra(sample(extra)));
});
test("contract rejects other exports and strips patient identifiers",()=>{
 assert.throws(()=>importarContrato('{"samples":[]}'));
 const result=importarContrato(JSON.stringify({schema:"encorpei.health.v1",platform:"health_connect",samples:[sample({patient_user_id:"another-patient"})]}));
 assert.equal("patient_user_id" in result.samples[0],false);
});
test("equivalent instants deduplicate and only selected source is imported",()=>{
 const p=previaDeAmostras([sample(),sample({start:"2026-01-01T13:00:00Z",end:"2026-01-01T13:00:00Z"}),sample({source:"Phone"})]);
 assert.equal(p.ignored,1);assert.equal(prepararLinhas(p,"Watch","2026-01-01","2026-01-01").linhas.length,1);
});
test("overlapping steps are rejected; current day totals are excluded",()=>{
 const s=sample({type:"steps",unit:"count",value:100,start:"2026-01-01T10:00:00Z",end:"2026-01-01T12:00:00Z"});
 const p=previaDeAmostras([s,{...s,value:200,start:"2026-01-01T11:00:00Z"}]);
 assert.equal(prepararLinhas(p,"Watch","2026-01-01","2026-01-02","2026-01-03").linhas.length,0);
 assert.equal(prepararLinhas(previaDeAmostras([s]),"Watch","2026-01-01","2026-01-02","2026-01-01").linhas.length,0);
});
test("overlapping sleep intervals form a union and use waking day",()=>{
 const s=sample({type:"sleep",unit:"asleep",value:1,start:"2026-01-01T23:00:00-03:00",end:"2026-01-02T06:00:00-03:00"});
 const p=previaDeAmostras([s,{...s,start:"2026-01-02T01:00:00-03:00",end:"2026-01-02T07:00:00-03:00"}]);
 const r=prepararLinhas(p,"Watch","2026-01-02","2026-01-02","2026-01-03").linhas;
 assert.equal(r[0].sleepMinutes,480);assert.equal(r[0].recordedAt.slice(0,10),"2026-01-02");
});
test("Apple awake and unknown types do not create readings",()=>{
 assert.equal(adaptarRegistroApple({type:"HKCategoryTypeIdentifierSleepAnalysis",value:"HKCategoryValueSleepAnalysisAwake"}),null);
 assert.equal(adaptarRegistroApple({type:"HKQuantityTypeIdentifierBloodGlucose"}),null);
});

test("imported heart rate is never assumed resting; provenance is preserved",()=>{
 const result=linhasParaLeituras([{recordedAt:"2026-01-01T13:00:00Z",heartRate:140,validation:"estimated"}],{patientUserId:"patient",deviceName:"Apple Saúde · Watch",deviceId:"device"});
 assert.equal(result.heartRate[0].context,null);assert.equal(result.heartRate[0].source_device_id,"device");assert.equal(result.heartRate[0].validation_status,"estimated");
});
