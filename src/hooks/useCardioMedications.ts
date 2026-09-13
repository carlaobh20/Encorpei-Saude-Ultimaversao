import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import { DEMO_INTAKES, DEMO_MEDICATIONS } from "@/lib/demoData";
import type { CardioMedication, MedicationIntake, MedClass } from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Uma linha de `medication_titrations` já resolvida para exibição.
 *
 * `medico` vem de um embed em `professional_profiles`. O paciente enxerga o
 * perfil do médico ao qual está vinculado (política `pro_visible_to_linked_patient`),
 * e o médico enxerga o próprio — quando a política nega, o embed devolve null
 * e a tela diz "seu médico" em vez de inventar um nome.
 */
export interface Titulacao {
  id: string;
  medication_id: string;
  previous_dose: string | null;
  new_dose: string;
  reason: string | null;
  created_at: string;
  medico: string | null;
  /** Nome do remédio no momento da leitura (resolvido fora de qualquer `.map()` de lista). */
  medicamento: string | null;
}

/** Janela de histórico de titulação que as duas telas mostram. */
const DIAS_TITULACAO = 365;

/**
 * Demo precisa mostrar a funcionalidade, não um vazio — mas sem tocar o banco.
 * Fica aqui e não em `demoData.ts` porque é dado derivado das doses demo.
 */
const DEMO_TITULACOES: Omit<Titulacao, "medicamento">[] = [
  {
    id: "demo-tit-1",
    medication_id: DEMO_MEDICATIONS[0]?.id ?? "demo-med-1",
    previous_dose: "50 mg",
    new_dose: "100 mg",
    reason: "Pressão acima do alvo em três medidas seguidas",
    created_at: new Date(Date.now() - 32 * 86_400_000).toISOString(),
    medico: "Dr. Marcelo Puzzi (Demo)",
  },
];

export const MED_CLASS_LABEL: Record<MedClass, string> = {
  // As quatro classes que só tinham sigla eram justamente as mais
  // prescritas em cardiologia — o paciente lia "Losartana 50 mg · BRA" e
  // não sabia se "BRA" era a marca, a dose ou um aviso. A sigla fica entre
  // parênteses porque é a palavra que ele vai OUVIR na consulta.
  acei: "Inibidor da ECA (IECA)",
  arb: "Bloqueador do receptor de angiotensina (BRA)",
  arni: "Sacubitril-valsartana (ARNI)",
  beta_blocker: "Betabloqueador",
  ccb: "Bloqueador de cálcio",
  sglt2: "Protetor do rim e do coração (iSGLT2)",
  mra: "Antagonista mineralocorticoide",
  loop_diuretic: "Diurético de alça",
  thiazide: "Tiazídico",
  statin: "Estatina",
  ezetimibe: "Ezetimiba",
  pcsk9: "Inibidor de PCSK9",
  antiplatelet: "Antiagregante",
  anticoagulant: "Anticoagulante",
  antiarrhythmic: "Antiarrítmico",
  nitrate: "Nitrato",
  other: "Outro",
};

/**
 * O que monitorar depois de mexer na dose. Não é conduta: é lembrete do que
 * o próprio médico já sabe, no momento em que ele está titulando.
 */
export const MED_CLASS_MONITORAR: Partial<Record<MedClass, string>> = {
  acei: "K⁺, creatinina, PA, tosse",
  arb: "K⁺, creatinina, PA",
  arni: "PA, K⁺, creatinina",
  beta_blocker: "FC, PA, fadiga, broncoespasmo",
  ccb: "Edema de MMII, PA",
  sglt2: "Volemia, ITU/candidíase, glicemia",
  mra: "K⁺, creatinina, ginecomastia",
  loop_diuretic: "Peso, K⁺, Na⁺, creatinina",
  thiazide: "Na⁺, K⁺, ácido úrico",
  statin: "LDL, mialgia, TGO/TGP, CK",
  ezetimibe: "LDL",
  pcsk9: "LDL",
  antiplatelet: "Sangramento, dispepsia",
  anticoagulant: "Sangramento (INR na varfarina)",
  antiarrhythmic: "FC, QT, TSH e função hepática (amiodarona)",
  nitrate: "Cefaleia, hipotensão",
};

export function useCardioMedications(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const meds = useQuery({
    queryKey: queryKeys.medications.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<CardioMedication[]> => {
      if (demo) return DEMO_MEDICATIONS;
      const { data, error } = await (supabase as any)
        .from("cardio_medications")
        .select("*")
        .eq("patient_user_id", uid)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CardioMedication[];
    },
  });

  const intakes = useQuery({
    queryKey: queryKeys.medications.intakes(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 30_000,
    queryFn: async (): Promise<MedicationIntake[]> => {
      if (demo) return DEMO_INTAKES;
      const desde = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const { data, error } = await (supabase as any)
        .from("medication_intakes")
        .select("*")
        .eq("patient_user_id", uid)
        .gte("intake_date", desde);
      if (error) throw error;
      return (data ?? []) as MedicationIntake[];
    },
  });

  /**
   * Histórico de titulação — a consulta que NÃO EXISTIA.
   *
   * A tabela era escrita desde o primeiro dia e não tinha um único SELECT no
   * projeto: o comentário da migração diz que "a mudança de dose é o ato
   * clínico central", e ela era gravada num lugar que ninguém abria. Uma
   * consulta por paciente, no topo do hook — o nome do remédio é cruzado em
   * memória com `meds.data` logo abaixo, e não com uma consulta por linha.
   */
  const titulacoesQuery = useQuery({
    // Sob o prefixo `medications` de propósito: invalidar o domínio depois de
    // titular atualiza a dose atual E o histórico na mesma passada.
    queryKey: [...queryKeys.medications.all, "titrations", uid ?? "demo"] as const,
    enabled: !!uid || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<Omit<Titulacao, "medicamento">[]> => {
      if (demo) return DEMO_TITULACOES;
      const desde = new Date(Date.now() - DIAS_TITULACAO * 86_400_000).toISOString();
      const { data, error } = await (supabase as any)
        .from("medication_titrations")
        .select("id, medication_id, previous_dose, new_dose, reason, created_at, professional_profiles(display_name)")
        .eq("patient_user_id", uid)
        .gte("created_at", desde)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        medication_id: r.medication_id,
        previous_dose: r.previous_dose,
        new_dose: r.new_dose,
        reason: r.reason,
        created_at: r.created_at,
        medico: r.professional_profiles?.display_name ?? null,
      }));
    },
  });

  const ativas = useMemo(
    () => (meds.data ?? []).filter((m) => m.status === "active"),
    [meds.data]
  );

  /** Histórico com o nome do remédio já resolvido — um índice, não um N+1. */
  const titulacoes = useMemo<Titulacao[]>(() => {
    const nomePorId = new Map((meds.data ?? []).map((m) => [m.id, m.name]));
    return (titulacoesQuery.data ?? []).map((t) => ({
      ...t,
      medicamento: nomePorId.get(t.medication_id) ?? null,
    }));
  }, [titulacoesQuery.data, meds.data]);

  /** Proporção de doses marcadas nos últimos N dias. */
  const adesao = useMemo(() => {
    const lista = intakes.data ?? [];
    if (lista.length === 0) return null;
    const calc = (dias: number) => {
      const corte = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
      const janela = lista.filter((x) => x.intake_date >= corte);
      if (janela.length === 0) return null;
      return janela.filter((x) => x.taken).length / janela.length;
    };
    return { d7: calc(7), d14: calc(14), d30: calc(30) };
  }, [intakes.data]);

  const hoje = new Date().toISOString().slice(0, 10);
  const dosesDeHoje = useMemo(() => {
    const doDia = (intakes.data ?? []).filter((x) => x.intake_date === hoje);
    return ativas.flatMap((med) =>
      med.schedule.map((hora) => {
        const marcada = doDia.find((x) => x.medication_id === med.id && x.scheduled_time === hora);
        return { med, hora, taken: marcada?.taken ?? false, intakeId: marcada?.id ?? null };
      })
    ).sort((a, b) => a.hora.localeCompare(b.hora));
  }, [ativas, intakes.data, hoje]);

  const marcarDose = useMutation({
    mutationFn: async ({ medicationId, hora, taken }: { medicationId: string; hora: string; taken: boolean }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { data, error } = await (supabase as any).from("medication_intakes").upsert(
        {
          patient_user_id: user!.id,
          medication_id: medicationId,
          intake_date: hoje,
          scheduled_time: hora,
          taken,
          taken_at: taken ? new Date().toISOString() : null,
        },
        { onConflict: "medication_id,intake_date,scheduled_time" }
      ).select("id");
      if (error) throw error;
      // Sem `.select()`, a RLS que nega a escrita devolve `error: null` e zero
      // linhas afetadas: o app mostrava "tomei" marcado em cima de nada. Zero
      // linha aqui é falha, e falha tem que chegar ao paciente.
      if (!data || data.length === 0) throw new Error("A dose não foi gravada (permissão negada ou vínculo inativo).");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.medications.all }),
    onError: (e: unknown) => toastError(e, "Não consegui registrar a dose."),
  });

  /** Titulação: muda a dose E grava por quê. O histórico é o valor clínico. */
  const titular = useMutation({
    mutationFn: async (input: {
      medicationId: string;
      patientUserId: string;
      previousDose: string | null;
      newDose: string;
      reason?: string;
      blockedBy?: string | null;
      /** Perfil profissional de quem está titulando. Ver abaixo por que importa. */
      professionalId?: string | null;
    }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }

      const { data: linhas, error: e1 } = await (supabase as any)
        .from("cardio_medications")
        .update({ dose: input.newDose, titration_blocked_by: input.blockedBy ?? null })
        .eq("id", input.medicationId)
        .select("id");
      if (e1) throw e1;
      if (!linhas || linhas.length === 0) {
        throw new Error("A dose não foi alterada (permissão negada ou vínculo inativo com a paciente).");
      }

      /**
       * `professional_id` ficava NULL em 100% das titulações: a coluna existe,
       * tem índice próprio, e o insert simplesmente não a preenchia. Sem ela o
       * histórico responde "a dose mudou" mas não "quem mudou" — que é metade
       * do valor clínico de um histórico de titulação, e a metade que importa
       * em serviço com mais de um médico.
       *
       * Quem chama passa o id que já tem em mão. O `select` de reserva roda
       * uma vez, no momento da escrita — nunca num render, nunca num `.map()`.
       */
      let professionalId = input.professionalId ?? null;
      if (!professionalId && user?.id) {
        const { data: perfil } = await (supabase as any)
          .from("professional_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        professionalId = perfil?.id ?? null;
      }

      const { data: gravadas, error: e2 } = await (supabase as any)
        .from("medication_titrations")
        .insert({
          medication_id: input.medicationId,
          patient_user_id: input.patientUserId,
          professional_id: professionalId,
          previous_dose: input.previousDose,
          new_dose: input.newDose,
          reason: input.reason ?? null,
        })
        .select("id");
      if (e2) throw e2;
      if (!gravadas || gravadas.length === 0) {
        throw new Error("A dose mudou, mas o histórico não foi gravado. Registre a mudança na anotação do paciente.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.medications.all });
      // O texto anterior — "O paciente foi avisado" — era falso: não há push
      // nem e-mail neste app. Em vez de suavizar a frase, a correção deu ao
      // paciente o registro que ela prometia: a mudança aparece em Remédios,
      // com dose anterior, nova dose, data e motivo. A frase agora descreve
      // exatamente o que aconteceu, e nada além disso.
      toast.success("Dose atualizada. O paciente vê a mudança em Remédios.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui atualizar a dose."),
  });

  const salvarMedicacao = useMutation({
    mutationFn: async (med: Partial<CardioMedication> & { patient_user_id: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { data, error } = await (supabase as any).from("cardio_medications").upsert(med).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("A prescrição não foi gravada (permissão negada ou vínculo inativo).");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.medications.all });
      toast.success("Prescrição atualizada.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar a prescrição."),
  });

  return {
    medications: meds.data ?? [],
    ativas,
    intakes: intakes.data ?? [],
    dosesDeHoje,
    adesao,
    titulacoes,
    isLoadingTitulacoes: titulacoesQuery.isLoading,
    isLoading: meds.isLoading,
    marcarDose,
    titular,
    salvarMedicacao,
  };
}
