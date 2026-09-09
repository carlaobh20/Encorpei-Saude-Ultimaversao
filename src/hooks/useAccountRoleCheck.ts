import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auditoria de login cruzado (26/08/2026) — defesa em profundidade usada
 * pelos route guards (ProtectedRoute / ProProtectedRoute). O bloqueio
 * principal acontece na tela de login (ver src/lib/accountAccess.ts), mas
 * uma sessão já autenticada ANTES dessa correção pode ainda estar salva no
 * navegador de alguém. Estes hooks checam, direto no banco, se a sessão
 * atual pertence ao papel errado para o portal em que está — só disparam
 * quando `enabled` for true (o guard decide isso, pra não pesar a
 * navegação normal de quem já é do papel certo).
 *
 * Extraído em hooks próprios (em vez de `useQuery` direto dentro do guard)
 * para poderem ser mockados nos testes dos guards, no mesmo padrão já usado
 * para useProfile/usePatient/useProfessionalProfile.
 */
export function useHasProfessionalProfile(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["accountRole", "professionalCheck", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_profiles")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled,
  });
}

export function useHasPatientProfile(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["accountRole", "patientCheck", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cardio_patients")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled,
  });
}

/**
 * 04/09/2026 — sinal imediato do papel da conta, sem ir ao banco: o cadastro
 * do paciente grava `perfil: "paciente"` nos metadados do usuário (AuthPage.tsx)
 * e o do médico grava `perfil: "profissional"` (ProAuthPage.tsx). Cobre a
 * conta de paciente que criou login mas NÃO terminou o onboarding (ainda sem
 * linha em `patients`) — caso real que fazia o "Login do médico" abrir o
 * cadastro de médico com o nome dela preenchido.
 */
export function perfilDosMetadados(user: { user_metadata?: Record<string, unknown> | null } | null | undefined): "paciente" | "profissional" | null {
  const p = user?.user_metadata?.perfil;
  return p === "paciente" || p === "profissional" ? p : null;
}
