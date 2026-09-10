/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * METAS DO PACIENTE — o que é dele, e só dele
 * ══════════════════════════════════════════════════════════════════════
 *
 * A migração 20260912000000_seguranca.sql §3 tirou do paciente o direito de
 * escrever em `cardio_targets`. O motivo não é desconfiança: aquela tabela
 * guarda a PRESCRIÇÃO (limiar de pressão, LDL, faixa de FC, peso seco) e os
 * mesmos números disparam alerta. Paciente reescrevendo o limiar é paciente
 * desligando o próprio alarme — normalmente sem perceber que foi isso que fez.
 *
 * Só que tirar a escrita e não colocar nada no lugar deixou a tela /metas
 * somente leitura, o que é pior do que parece: some do produto a única parte
 * em que o paciente tem AGÊNCIA. Adesão em cardiologia crônica não vive de
 * obediência; vive de compromisso. Daí `patient_goals`: passos por dia,
 * minutos de exercício por semana, horas de sono, sal por dia e uma
 * observação livre. Comportamento, não conduta.
 *
 * A separação é de propósito, e vale a pena repetir porque é a regra que
 * organiza este arquivo inteiro:
 *
 *   cardio_targets  → prescrição. Médico escreve, paciente lê.
 *   patient_goals   → combinado. Paciente escreve, médico lê.
 *
 * O RLS já garante isso do lado do servidor (política `patient_goals_own`
 * para o dono, `patient_goals_doctor` para o médico vinculado, leitura só).
 * Este hook nunca é a barreira — é apenas a porta que respeita a barreira.
 *
 * REGRA CLÍNICA: nada aqui vira alerta, cobrança ou titulação. Meta de
 * comportamento é autorrelato de intenção. Se virasse gatilho de conduta,
 * teríamos recriado o buraco que a migração fechou, só que por fora.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";

/** Espelho fiel de `public.patient_goals`. Todo campo é opcional: o paciente
 *  combina o que quiser combinar, e não combinar nada é uma resposta válida. */
export interface MetasPaciente {
  patient_user_id: string;
  /** passos/dia */
  steps_per_day: number | null;
  /** minutos de exercício moderado a vigoroso por semana */
  mvpa_minutes_week: number | null;
  /** horas de sono por noite */
  sleep_hours: number | null;
  /** mg de sódio por dia */
  sodium_mg_day: number | null;
  /** campo livre — "o que eu combinei comigo", nas palavras dele */
  observacao: string | null;
  updated_at: string;
}

/** Só os campos que o paciente edita. `updated_at` é do gatilho do banco. */
export type MetasPacienteEdit = Omit<MetasPaciente, "patient_user_id" | "updated_at">;

/**
 * Metas do demo.
 *
 * Ficam aqui e não em `demoData.ts` porque são o retrato de UM paciente
 * fictício desta tela, e o demo existe para mostrar a tela funcionando —
 * inclusive a diferença visual entre "número do médico" e "meu combinado".
 * Valores deliberadamente DIFERENTES dos de `DEMO_TARGETS`: é assim que se
 * enxerga, em 5 segundos, que são duas coisas distintas.
 */
const METAS_DEMO: MetasPaciente = {
  patient_user_id: "demo-user-paciente-001",
  steps_per_day: 5000,
  mvpa_minutes_week: 120,
  sleep_hours: 7.5,
  sodium_mg_day: 2300,
  observacao: "Caminhar até a padaria de manhã, sem o carro.",
  updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
};

/**
 * Lê as metas de comportamento.
 *
 * Sem argumento: as do próprio paciente logado. Com `patientUserId`: as do
 * paciente que o médico está olhando — a leitura do médico é permitida pelo
 * RLS e é UMA consulta, nunca uma por linha de lista. O detalhe importa: o
 * padrão N+1 dentro de `.map()` já derrubou as telas do médico antes.
 *
 * Devolve `null` (e não um objeto com zeros) quando não há linha. "Ainda não
 * combinei nada" é um estado real e a tela precisa poder dizer isso em vez de
 * mostrar metas que ninguém escolheu.
 */
export function useMetasPaciente(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();

  const query = useQuery({
    queryKey: queryKeys.patientGoals.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MetasPaciente | null> => {
      if (demo) return METAS_DEMO;
      const { data, error } = await (supabase as any)
        .from("patient_goals")
        .select("*")
        .eq("patient_user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return (data as MetasPaciente) ?? null;
    },
  });

  return {
    metas: query.data ?? null,
    /** true quando o paciente ainda não combinou nada — a tela convida, não cobra. */
    vazio: !query.data,
    isLoading: query.isLoading,
  };
}

/**
 * Grava as metas de comportamento do PRÓPRIO paciente.
 *
 * Não aceita `patientUserId` de fora de propósito. O RLS já recusaria uma
 * escrita em linha alheia, mas uma assinatura que nem oferece o parâmetro
 * evita que a tela do médico ganhe, por descuido de refatoração, um botão
 * "salvar as metas dele" — que é exatamente a inversão de papéis que a
 * migração de segurança veio desfazer.
 */
export function useSalvarMetasPaciente() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (dados: Partial<MetasPacienteEdit>) => {
      // Demo nunca grava — é a regra do modo demonstração (DevBypass), que
      // roda em produção de propósito.
      if (getDevBypass()) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("patient_goals")
        .upsert({ patient_user_id: user!.id, ...dados }, { onConflict: "patient_user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.patientGoals.all });
      toast.success("Combinado guardado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui guardar seu combinado."),
  });
}
