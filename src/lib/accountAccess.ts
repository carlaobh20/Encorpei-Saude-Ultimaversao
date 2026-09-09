import { supabase } from "@/integrations/supabase/client";

export interface AccountRoleFlags {
  isPatient: boolean;
  isProfessional: boolean;
}

/**
 * Auditoria de login cruzado (26/08/2026).
 *
 * O Supabase Auth só prova e-mail+senha — ele não sabe (nem deveria saber)
 * se a conta é de uma mamãe ou de um médico. Antes desta função, cada
 * portal confiava soh no `signInWithPassword` ter dado certo e decidia pra
 * onde mandar o usuário com base em estado local de UI (ex.: um toggle que
 * só existe na tela de cadastro) — nunca checando o banco. Resultado: uma
 * credencial de médico logava normalmente na tela da mamãe (e vice-versa),
 * e o guard de rota, ao não achar o cadastro esperado, mandava a sessão
 * pro onboarding do papel errado em vez de bloquear.
 *
 * Esta função é a fonte de verdade real: consulta direto `patients` e
 * `professional_profiles` pelo `user_id` da sessão autenticada. É usada
 * tanto nas telas de login (bloqueia login cruzado na hora) quanto nos
 * route guards (defesa em profundidade, caso uma sessão antiga/vazada de
 * antes da correção ainda esteja salva no navegador de alguém).
 */
export async function fetchAccountRoleFlags(userId: string): Promise<AccountRoleFlags> {
  const [patientRes, proRes] = await Promise.all([
    supabase.from("cardio_patients").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("professional_profiles").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (patientRes.error) throw patientRes.error;
  if (proRes.error) throw proRes.error;
  return { isPatient: !!patientRes.data, isProfessional: !!proRes.data };
}
