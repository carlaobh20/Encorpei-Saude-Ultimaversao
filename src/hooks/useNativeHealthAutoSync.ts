import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getDevBypass } from '@/contexts/DevBypass';
import { supabase } from '@/integrations/supabase/client';
import { plataformaNativa, sincronizarNativo } from '@/lib/health/nativeSync';
/** Somente em primeiro plano. Não confundir timer JavaScript com serviço background. */
export function useNativeHealthAutoSync() {
 const {user}=useAuth();const qc=useQueryClient();
 useEffect(()=>{
  const platform=plataformaNativa();if(!platform||!user||getDevBypass())return;
  let stopped=false,running=false,lastAttempt=0;
  async function sync() {
   if(stopped||running||document.visibilityState!=='visible'||!navigator.onLine||Date.now()-lastAttempt<15*60000)return;
   running=true;lastAttempt=Date.now();
   try {
    const {data,error}=await (supabase as any).from('health_connections').select('status,last_sync_at').eq('patient_user_id',user!.id).eq('platform',platform).maybeSingle();
    if(stopped||error||data?.status!=='active'||(data.last_sync_at&&Date.now()-Date.parse(data.last_sync_at)<15*60000))return;
    await sincronizarNativo(user!.id,()=>{});
    if(!stopped) await qc.invalidateQueries({queryKey:['health-platforms',user!.id]});
   } catch { /* Sem dado inventado: painel mantém a data do último lote confirmado. */ }
   finally{running=false;}
  }
  void sync();const timer=setInterval(()=>void sync(),60000);
  const resume=()=>void sync();document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);};
 },[user?.id,qc]);
}
