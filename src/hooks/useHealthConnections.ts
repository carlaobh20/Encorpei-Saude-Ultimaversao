import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getDevBypass } from '@/contexts/DevBypass';
import { supabase } from '@/integrations/supabase/client';
export interface HealthConnection {id:string;platform:string;status:string;last_sync_at:string|null;consent_at:string;revision:number}
export interface HealthRecord {connection_id:string;source_id:string;source_name:string;external_id:string;metric:string;value:number;unit:string;start_at:string;end_at:string}
export function useHealthConnections(patientId?:string) {
 const {user}=useAuth();const uid=patientId??user?.id;const demo=!!getDevBypass();
 return useQuery({queryKey:['health-platforms',uid],enabled:!!uid&&!demo,retry:false,refetchInterval:60000,
 queryFn:async()=>{
  const c=await (supabase as any).from('health_connections').select('*').eq('patient_user_id',uid).order('platform');
  if(c.error) {if(['42P01','PGRST205'].includes(c.error.code)) return {available:false,connections:[] as HealthConnection[],records:[] as HealthRecord[],truncated:false};throw c.error;}
  const r=await (supabase as any).from('health_samples').select('*').eq('patient_user_id',uid).order('start_at',{ascending:false}).limit(101);
  if(r.error) throw r.error;
  return {available:true,connections:c.data as HealthConnection[],records:r.data.slice(0,100) as HealthRecord[],truncated:r.data.length>100};
 }});
}
