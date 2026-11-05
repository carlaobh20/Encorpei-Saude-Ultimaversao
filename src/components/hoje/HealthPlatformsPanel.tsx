import { useState } from 'react';
import { SurfaceCard } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { useHealthConnections } from '@/hooks/useHealthConnections';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { conectarNativo, plataformaNativa, sincronizarNativo } from '@/lib/health/nativeSync';
const names:Record<string,string>={heart_rate:'Batimentos',spo2:'Oxigenação',steps:'Passos (intervalo)',active_calories:'Calorias ativas (intervalo)',sleep:'Sono (intervalo)'};
const format=(date:string)=>new Date(date).toLocaleString('pt-BR');
export function HealthPlatformsPanel({patientId}:{patientId?:string}) {
 const {user}=useAuth();const query=useHealthConnections(patientId);const native=plataformaNativa();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[consent,setConsent]=useState(false),[source,setSource]=useState('');
 const data=query.data;const own=!patientId;const connections=data?.connections??[];
 const active=connections.find(c=>c.platform===native&&c.status==='active');
 async function action(fn:()=>Promise<void>) {setBusy(true);setMessage('');try{await fn();}catch(e){setMessage(e instanceof Error?e.message:'Não foi possível concluir.');}finally{await query.refetch();setBusy(false);}}
 const sources=[...new Set((data?.records??[]).map(r=>r.source_name))];
 const records=(data?.records??[]).filter(r=>!source||r.source_name===source);
 return <SurfaceCard className="p-5 mt-5 space-y-4">
  <h2 className="text-lg font-semibold">Dados das plataformas de saúde</h2>
  {query.isLoading?<p className="text-sm">Verificando integrações…</p>:query.isError?<p role="alert" className="text-sm">Não foi possível consultar as integrações. <button className="underline" onClick={()=>void query.refetch()}>Tentar novamente</button></p>:data?.available===false?<p className="text-sm text-muted-foreground">Recebimento nativo aguardando ativação no servidor. A importação de arquivos continua disponível.</p>:null}
  {connections.map(c=><div key={c.id} className="rounded-xl border border-border p-3 text-sm"><p className="font-semibold">{c.platform==='apple_health'?'Apple Saúde':'Health Connect'} · {c.status==='active'?'Compartilhamento autorizado':'Compartilhamento pausado'}</p><p className="text-muted-foreground">Último lote recebido: {c.last_sync_at?format(c.last_sync_at):'nenhum'}</p>{c.last_sync_at&&Date.now()-Date.parse(c.last_sync_at)>86400000&&<p className="text-warning mt-1">Sem lote novo há mais de 24 horas. Confira o aparelho, as permissões e a conexão.</p>}{own&&c.status==='active'&&<Button variant="outline" size="sm" className="mt-2" disabled={busy} onClick={()=>void action(async()=>{const {error}=await (supabase as any).from('health_connections').update({status:'revoked',revoked_at:new Date().toISOString()}).eq('id',c.id).eq('patient_user_id',user!.id);if(error)throw Error('Não foi possível pausar.');setMessage('Novos envios pausados. O histórico permanece. Para revogar a leitura no celular, remova a permissão nas configurações de saúde.');})}>Pausar novos envios</Button>}</div>)}
  {own&&<>
   <p className="text-sm text-muted-foreground">{native?'Após autorizar, a versão nativa tenta atualizar os últimos 7 dias a cada 15 minutos enquanto estiver aberta. O envio com o app fechado ainda não está disponível.':'A leitura direta exige a versão nativa instalada. O site e o atalho na tela inicial não têm acesso ao Apple Saúde ou Health Connect.'}</p>
   {native&&data?.available&&<><label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>Autorizo compartilhar batimentos, oxigenação, passos, calorias e sono com meu médico vinculado.</label><div className="flex gap-2 flex-wrap"><Button disabled={busy||!consent||!user} onClick={()=>void action(async()=>{await conectarNativo(user!.id);setMessage('Autorização solicitada. Sincronize para verificar os dados acessíveis.');})}>Autorizar leitura</Button><Button variant="outline" disabled={busy||!active||!user} onClick={()=>void action(async()=>{const r=await sincronizarNativo(user!.id,setMessage);setMessage(r.message);})}>Sincronizar agora</Button></div></>}
  </>}
  <p role="status" aria-live="polite" className="text-sm">{message}</p>
  {!!records.length&&<><label className="block text-sm">Filtrar origem<select className="block mt-1 p-2 rounded-xl border border-input bg-background w-full" value={source} onChange={e=>setSource(e.target.value)}><option value="">Todas as origens</option>{sources.map(s=><option key={s}>{s}</option>)}</select></label><div className="max-h-80 overflow-auto space-y-2">{records.map(r=><div key={JSON.stringify([r.connection_id,r.source_id,r.external_id])} className="border-b border-border py-2 text-sm"><p className="font-medium">{names[r.metric]??r.metric}: {r.metric==='sleep'?`${Math.round((Date.parse(r.end_at)-Date.parse(r.start_at))/60000)} min`:`${Number(r.value).toLocaleString('pt-BR')} ${r.unit}`}</p><p className="text-muted-foreground break-words">{r.source_name} · {format(r.start_at)}</p></div>)}</div><p className="text-xs text-muted-foreground">{data?.truncated?'Exibindo apenas as 100 amostras mais recentes. ':''}Valores por intervalo, sem somar origens. Não equivalem a totais diários ou medidas clinicamente validadas. Não alimentam alertas clínicos automáticos.</p></>}
  {data?.available&&!data.records.length&&<p className="text-sm text-muted-foreground">Nenhuma amostra nativa recebida. Ausência de dados não significa ausência de alteração de saúde.</p>}
 </SurfaceCard>;
}
