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

export const MED_CLASS_LABEL: Record<MedClass, string> = {
  acei: "IECA",
  arb: "BRA",
  arni: "ARNI",
  beta_blocker: "Betabloqueador",
  ccb: "Bloqueador de cálcio",
  sglt2: "iSGLT2",
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

  const ativas = useMemo(
    () => (meds.data ?? []).filter((m) => m.status === "active"),
    [meds.data]
  );

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
      const { error } = await (supabase as any).from("medication_intakes").upsert(
        {
          patient_user_id: user!.id,
          medication_id: medicationId,
          intake_date: hoje,
          scheduled_time: hora,
          taken,
          taken_at: taken ? new Date().toISOString() : null,
        },
        { onConflict: "medication_id,intake_date,scheduled_time" }
      );
      if (error) throw error;
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
    }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error: e1 } = await (supabase as any)
        .from("cardio_medications")
        .update({ dose: input.newDose, titration_blocked_by: input.blockedBy ?? null })
        .eq("id", input.medicationId);
      if (e1) throw e1;
      const { error: e2 } = await (supabase as any).from("medication_titrations").insert({
        medication_id: input.medicationId,
        patient_user_id: input.patientUserId,
        previous_dose: input.previousDose,
        new_dose: input.newDose,
        reason: input.reason ?? null,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.medications.all });
      toast.success("Dose atualizada. O paciente foi avisado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui atualizar a dose."),
  });

  const salvarMedicacao = useMutation({
    mutationFn: async (med: Partial<CardioMedication> & { patient_user_id: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any).from("cardio_medications").upsert(med);
      if (error) throw error;
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
    isLoading: meds.isLoading,
    marcarDose,
    titular,
    salvarMedicacao,
  };
}
