import type { HealthSample, HealthDataType, QueryOptions } from '@capgo/capacitor-health';
import { validarAmostra, type AmostraSaude } from './import.ts';
export const NATIVE_TYPES: HealthDataType[]=['heartRate','oxygenSaturation','steps','calories','sleep'];
export interface SyncSample extends AmostraSaude {id:string;sourceId:string}
export function adaptarNativo(s:HealthSample): SyncSample[] {
  if(!s.platformId || !s.sourceId) throw Error('A origem não fornece identificadores estáveis.');
  const types={heartRate:'heart_rate',oxygenSaturation:'spo2',steps:'steps',calories:'active_calories',sleep:'sleep'} as const;
  const type=types[s.dataType as keyof typeof types]; if(!type) return [];
  if(type==='sleep' && s.stages?.length) return s.stages.flatMap(stage=>adaptarNativo({...s,stages:undefined,startDate:stage.startDate,endDate:stage.endDate,sleepState:stage.stage}));
  if(type==='sleep' && !['asleep','rem','deep','light'].includes(s.sleepState??'')) return [];
  const units:Record<string,string>={bpm:'bpm',percent:'%',count:'count',kilocalorie:'kcal'};
  const a=validarAmostra({type,source:s.sourceName||s.sourceId,start:s.startDate,end:s.endDate,value:type==='sleep'?1:s.value,unit:type==='sleep'?'asleep':units[s.unit]});
  return [{...a,sourceId:s.sourceId,id:`${s.platformId}:${s.dataType}:${s.startDate}${type==='sleep'?':'+s.sleepState:''}`}];
}
/** Sem cursor no plugin: divide a janela e falha em vez de truncar silenciosamente. */
export async function lerJanelaCompleta(read:(q:QueryOptions)=>Promise<{samples:HealthSample[]}>,dataType:HealthDataType,start:number,end:number,depth=0):Promise<HealthSample[]> {
  const {samples}=await read({dataType,startDate:new Date(start).toISOString(),endDate:new Date(end).toISOString(),ascending:true,limit:1000});
  if(samples.length<1000) return samples;
  if(depth>=20 || end-start<1000) throw Error('Volume de dados acima do limite de leitura. Nenhum trecho truncado será enviado.');
  const mid=Math.floor((start+end)/2);
  const a=await lerJanelaCompleta(read,dataType,start,mid,depth+1);
  const b=await lerJanelaCompleta(read,dataType,mid,end,depth+1);
  if(a.length+b.length>100000) throw Error('Mais de 100 mil amostras; reduza o período.');
  return [...a,...b];
}
export function deduplicarNativas(samples:SyncSample[]) {
  return [...new Map(samples.map(s=>[JSON.stringify([s.sourceId,s.id]),s])).values()];
}
