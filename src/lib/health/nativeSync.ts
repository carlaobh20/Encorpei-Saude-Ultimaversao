import { Capacitor } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { supabase } from '@/integrations/supabase/client';
import { adaptarNativo, deduplicarNativas, lerJanelaCompleta, NATIVE_TYPES } from './nativeAdapter';
export const plataformaNativa=()=>Capacitor.isNativePlatform() ? (Capacitor.getPlatform()==='ios'?'apple_health':'health_connect') : null;

export async function conectarNativo(uid:string) {
  const platform=plataformaNativa();
  if(!platform || !(await Health.isAvailable()).available) throw Error('Instale a versão nativa compatível para autorizar o acesso.');
  // Checa a migração antes de abrir permissões do sistema.
  const check=await (supabase as any).from('health_connections').select('id').limit(1);
  if(check.error) throw Error('A sincronização ainda não foi ativada neste servidor.');
  const auth=await Health.requestAuthorization({read:NATIVE_TYPES,write:[]});
  if(platform==='health_connect' && !auth.readAuthorized.length) throw Error('Nenhuma permissão de leitura foi autorizada.');
  const {data:session}=await supabase.auth.getSession();
  if(session.session?.user.id!==uid) throw Error('Sua sessão mudou. Entre novamente.');
  const lookup=await (supabase as any).from('health_connections').select('id').eq('patient_user_id',uid).eq('platform',platform).maybeSingle();
  if(lookup.error) throw Error('Não foi possível consultar a conexão.');
  const consent={status:'active',consent_version:'2026-11-05',consent_at:new Date().toISOString(),revoked_at:null};
  const {error}=lookup.data
    ? await (supabase as any).from('health_connections').update(consent).eq('id',lookup.data.id).eq('patient_user_id',uid)
    : await (supabase as any).from('health_connections').insert({patient_user_id:uid,platform,...consent});
  if(error) throw Error('Não foi possível registrar sua autorização.');
}

async function executarSincronizacao(uid:string,onProgress:(text:string)=>void) {
  const platform=plataformaNativa(); if(!platform) throw Error('A leitura direta requer o aplicativo nativo.');
  const {data:c,error}=await (supabase as any).from('health_connections').select('*').eq('patient_user_id',uid).eq('platform',platform).single();
  if(error||c?.status!=='active') throw Error('Autorize a conexão antes de sincronizar.');
  const auth=await Health.checkAuthorization({read:NATIVE_TYPES,write:[]});
  const types=platform==='apple_health'?NATIVE_TYPES:NATIVE_TYPES.filter(t=>auth.readAuthorized.includes(t));
  if(!types.length) throw Error('Permissão de leitura revogada. Autorize novamente nas configurações de saúde.');
  const end=Date.now(),start=end-7*86400000;
  const all=[];let ignored=0;
  for(const type of types) {
    onProgress(`Lendo ${NATIVE_TYPES.indexOf(type)+1}/${NATIVE_TYPES.length} tipos…`);
    const samples=await lerJanelaCompleta(q=>Health.readSamples(q),type,start,end);
    for(const sample of samples) {try{all.push(...adaptarNativo(sample));}catch{ignored++;}}
    if(all.length>100000) throw Error('Volume acima de 100 mil amostras.');
  }
  const samples=deduplicarNativas(all);
  if(!samples.length) return {received:0,ignored,message:'Nenhum dado acessível nos últimos 7 dias. Verifique as permissões e se o app do relógio envia dados para a plataforma.'};
  let revision=Number(c.revision),received=0;
  for(let i=0;i<samples.length;i+=500) {
    const {data:session}=await supabase.auth.getSession();
    if(session.session?.user.id!==uid) throw Error('Sessão alterada. A sincronização foi interrompida.');
    const payload={p_connection:c.id,p_batch:crypto.randomUUID(),p_expected_revision:revision,p_samples:samples.slice(i,i+500),p_deletions:[]};
    // Mesmo ID/conteúdo em retry: o servidor reconhece uma resposta perdida.
    let result=await (supabase as any).rpc('health_sync_batch',payload);
    if(result.error && (!result.error.code || result.status>=500)) result=await (supabase as any).rpc('health_sync_batch',payload);
    if(result.error) throw Error('Envio interrompido. Os lotes já confirmados estão salvos; tente novamente para completar.');
    revision=Number(result.data.revision);received+=result.data.received;
    onProgress(`${Math.min(i+500,samples.length)}/${samples.length} amostras conferidas`);
  }
  return {received,ignored,message:`${received} amostras conferidas e atualizadas; ${ignored} incompatíveis ignoradas. Período: últimos 7 dias.`};
}

let running:Promise<Awaited<ReturnType<typeof executarSincronizacao>>>|null=null;
export async function sincronizarNativo(uid:string,onProgress:(text:string)=>void) {
 if(running) throw Error("Já existe uma sincronização em andamento. Aguarde.");
 running=executarSincronizacao(uid,onProgress);
 try{return await running;}finally{running=null;}
}
