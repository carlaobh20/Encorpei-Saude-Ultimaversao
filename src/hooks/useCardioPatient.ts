import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass, DEV_PATIENT } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import { DEMO_TARGETS } from "@/lib/demoData";
import { sugerirAlvos } from "@/lib/clinical/cardioTargets";
import type { CardioPatient, CardioTargets } from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Cadastro cardiológico do paciente (o próprio, ou um paciente do médico). */
export function useCardioPatient(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();

  return useQuery({
    queryKey: patientUserId ? queryKeys.patient.de(patientUserId) : queryKeys.patient.self,
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CardioPatient | null> => {
      if (demo) return DEV_PATIENT as unknown as CardioPatient;
      const { data, error } = await (supabase as any)
        .from("cardio_patients")
        .select("*")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as CardioPatient) ?? null;
    },
  });
}

/**
 * Nome dos pacientes de uma lista de vínculos — em UMA consulta.
 *
 * Existe para o seletor do cuidador, que renderiza um chip por paciente
 * acompanhado. Cada chip chamava `useCardioPatient` por conta própria: uma
 * consulta por item de lista, o padrão N+1. Devolve um mapa
 * `patient_user_id → full_name` e nada mais — é tudo o que o chip usa.
 */
export function useNomesDePacientes(patientUserIds: string[]) {
  const demo = !!getDevBypass();
  // Ordenado para a chave não mudar só porque a lista veio noutra ordem.
  const ids = [...new Set(patientUserIds.filter(Boolean))].sort();

  const { data } = useQuery({
    queryKey: [...queryKeys.patient.all, "nomes", ids.join(",")],
    enabled: ids.length > 0 || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string>> => {
      if (demo) {
        return { [DEV_PATIENT.user_id]: DEV_PATIENT.full_name };
      }
      const { data, error } = await (supabase as any)
        .from("cardio_patients")
        .select("user_id, full_name")
        .in("user_id", ids);
      if (error) throw error;
      const mapa: Record<string, string> = {};
      for (const linha of (data ?? []) as { user_id: string; full_name: string | null }[]) {
        if (linha.full_name) mapa[linha.user_id] = linha.full_name;
      }
      return mapa;
    },
  });

  return data ?? {};
}

export function useSalvarCardioPatient() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dados: Partial<CardioPatient>) => {
      if (getDevBypass()) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("cardio_patients")
        .upsert({ user_id: user!.id, ...dados }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patient.all });
      toast.success("Salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar seu cadastro."),
  });
}

/**
 * Metas terapêuticas. Se o paciente ainda não tem metas gravadas, devolve a
 * sugestão por estrato de risco — nunca `null`, para a tela nunca ficar sem
 * régua. O que o médico gravar sempre vence a sugestão.
 */
export function useTargets(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const { data: patient } = useCardioPatient(patientUserId);

  const query = useQuery({
    queryKey: queryKeys.targets.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CardioTargets | null> => {
      if (demo) return DEMO_TARGETS;
      const { data, error } = await (supabase as any)
        .from("cardio_targets")
        .select("*")
        .eq("patient_user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as CardioTargets) ?? null;
    },
  });

  const sugeridas: CardioTargets = {
    id: "sugerido",
    patient_user_id: uid ?? "",
    updated_at: new Date().toISOString(),
    ...sugerirAlvos({ risk_category: patient?.risk_category ?? null, history: patient?.history ?? null }),
  };

  return {
    targets: query.data ?? sugeridas,
    /** true quando são só sugestões — a tela mostra "aguardando seu médico". */
    ehSugestao: !query.data,
    /**
     * true só quando existe linha gravada E ela tem um profissional atrás.
     *
     * Distinção que `ehSugestao` sozinho não faz e que a tela do paciente
     * precisa fazer: desde a migração de segurança (§3), o próprio paciente
     * planta uma linha de referência ao entrar no app — com os valores PADRÃO,
     * forçados pelo gatilho `proteger_metas`, e `professional_id` nulo. Essa
     * linha EXISTE, portanto `ehSugestao` é false, mas ela não é prescrição de
     * ninguém. Chamá-la de "o que seu médico definiu" seria inventar um médico.
     */
    ehPrescricao: !!query.data && !!query.data.professional_id,
    /** Quando a prescrição foi definida — `null` enquanto for só referência. */
    definidoEm: query.data?.updated_at ?? null,
    isLoading: query.isLoading,
  };
}

export function useSalvarTargets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ patientUserId, ...dados }: Partial<CardioTargets> & { patientUserId: string }) => {
      if (getDevBypass()) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("cardio_targets")
        .upsert({ patient_user_id: patientUserId, ...dados }, { onConflict: "patient_user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.targets.all });
      toast.success("Metas atualizadas. O paciente será avisado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar as metas."),
  });
}
