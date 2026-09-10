/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * PLANO DE MONITORAMENTO — o que o médico pediu, e o que falta hoje
 * ══════════════════════════════════════════════════════════════════════
 *
 * Antes disso, o app tinha ALVO ("pressão até 130/80") mas não tinha
 * FREQUÊNCIA. Sem frequência, "registre o que o médico pede" era uma frase
 * sem lastro: a tela inicial não sabia o que cobrar nem quando parar de cobrar.
 *
 * Este hook responde uma pergunta só, e responde bem:
 *   "O que ainda falta o paciente registrar hoje?"
 *
 * Regra de honestidade: item sem prescrição do médico NÃO vira cobrança.
 * Se não há plano, o app cai num conjunto mínimo (pressão, peso, remédio,
 * como me sinto) e diz na tela que é sugestão, não prescrição.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import {
  useBloodPressure, useWeight, useHeartRate, useSpo2, useGlucose, useSleep, useActivity,
} from "@/hooks/useCardioReadings";
import { useCheckins, useSodio, useCaminhadas } from "@/hooks/useEngajamento";
import { useCardioMedications } from "@/hooks/useCardioMedications";

export type MetricaPlano =
  | "bp" | "weight" | "hr" | "spo2" | "glucose" | "steps"
  | "sleep" | "symptoms" | "medication" | "sodium" | "wellbeing" | "walk";

export type Frequencia = "daily" | "twice_daily" | "weekly" | "biweekly" | "monthly" | "as_needed";

export interface ItemPlano {
  id: string;
  metric: MetricaPlano;
  frequency: Frequencia;
  times_per_day: number;
  preferred_time: "morning" | "afternoon" | "evening" | "any" | null;
  is_active: boolean;
  instructions: string | null;
}

/** Plano mínimo quando o médico ainda não prescreveu nada. */
const PLANO_SUGERIDO: ItemPlano[] = [
  { id: "sug-bp", metric: "bp", frequency: "daily", times_per_day: 2, preferred_time: "any", is_active: true, instructions: null },
  { id: "sug-weight", metric: "weight", frequency: "daily", times_per_day: 1, preferred_time: "morning", is_active: true, instructions: null },
  { id: "sug-medication", metric: "medication", frequency: "daily", times_per_day: 1, preferred_time: "any", is_active: true, instructions: null },
  { id: "sug-wellbeing", metric: "wellbeing", frequency: "daily", times_per_day: 1, preferred_time: "evening", is_active: true, instructions: null },
];

export const ROTULO_METRICA: Record<MetricaPlano, string> = {
  bp: "Pressão",
  weight: "Peso",
  hr: "Batimentos",
  spo2: "Oxigenação",
  glucose: "Glicemia",
  steps: "Passos",
  sleep: "Sono",
  symptoms: "Sintomas",
  medication: "Remédios",
  sodium: "Sal do dia",
  wellbeing: "Como me sinto",
  walk: "Caminhada",
};

export const ROTULO_FREQUENCIA: Record<Frequencia, string> = {
  daily: "todo dia",
  twice_daily: "duas vezes por dia",
  weekly: "uma vez por semana",
  biweekly: "a cada 15 dias",
  monthly: "uma vez por mês",
  as_needed: "quando precisar",
};

export function usePlanoMonitoramento(patientUserId?: string) {
  const { user } = useAuth();
  const demo = !!getDevBypass();
  const alvo = patientUserId ?? user?.id;

  const { data: plano = [], isLoading } = useQuery({
    queryKey: ["monitoring_plan", alvo],
    queryFn: async (): Promise<ItemPlano[]> => {
      if (demo) return PLANO_SUGERIDO;
      const { data, error } = await (supabase as any)
        .from("monitoring_plan")
        .select("*")
        .eq("patient_user_id", alvo)
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ItemPlano[];
    },
    enabled: !!alvo || demo,
    staleTime: 5 * 60 * 1000,
  });

  const prescrito = plano.length > 0 && !demo;
  const itens = plano.length > 0 ? plano : PLANO_SUGERIDO;

  return { itens, prescrito, isLoading };
}

// ── O que falta hoje ─────────────────────────────────────────────────

export interface Pendencia {
  metric: MetricaPlano;
  rotulo: string;
  feitos: number;
  esperados: number;
  concluido: boolean;
  instrucao: string | null;
}

function hoje(d?: string | null): boolean {
  if (!d) return false;
  const x = new Date(d);
  const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
}

function contarHoje(lista: any[], campo: string): number {
  return lista.filter((r) => hoje(r?.[campo])).length;
}

/**
 * Cruza o plano com o que já foi registrado hoje.
 *
 * Só conta métrica que o app sabe registrar sozinho. Métrica que depende de
 * dispositivo (oxigenação, passos) conta a leitura vinda da pulseira também —
 * o paciente não precisa digitar o que a pulseira já mandou.
 */
export function usePendenciasDeHoje(patientUserId?: string) {
  const { itens, prescrito, isLoading } = usePlanoMonitoramento(patientUserId);

  const bp = useBloodPressure(patientUserId);
  const weight = useWeight(patientUserId);
  const hr = useHeartRate(patientUserId);
  const spo2 = useSpo2(patientUserId);
  const glucose = useGlucose(patientUserId);
  const sleep = useSleep(patientUserId);
  const activity = useActivity(patientUserId);
  const checkins = useCheckins(patientUserId);
  const sodio = useSodio(patientUserId);
  const caminhadas = useCaminhadas(patientUserId);
  const meds = useCardioMedications(patientUserId);

  const pendencias = useMemo<Pendencia[]>(() => {
    return itens
      .filter((i) => i.frequency !== "as_needed")
      .map((i) => {
        let feitos = 0;
        switch (i.metric) {
          case "bp":         feitos = contarHoje(bp.readings ?? [], "recorded_at"); break;
          case "weight":     feitos = contarHoje(weight.readings ?? [], "recorded_at"); break;
          case "hr":         feitos = contarHoje(hr.readings ?? [], "recorded_at"); break;
          case "spo2":       feitos = contarHoje(spo2.readings ?? [], "recorded_at"); break;
          case "glucose":    feitos = contarHoje((glucose as any).readings ?? [], "recorded_at"); break;
          case "sleep":      feitos = contarHoje((sleep as any).records ?? [], "start_at"); break;
          case "steps":      feitos = contarHoje((activity as any).records ?? [], "recorded_at"); break;
          case "wellbeing":  feitos = contarHoje(checkins.checkins ?? [], "ocorrido_em"); break;
          case "sodium":     feitos = ((sodio as any).hoje ?? 0) > 0 ? 1 : 0; break;
          case "walk":       feitos = contarHoje((caminhadas as any).sessoes ?? [], "iniciada_em"); break;
          case "medication": {
            const doses = (meds as any).dosesDeHoje ?? [];
            feitos = doses.length === 0 ? 1 : doses.filter((d: any) => d.taken).length;
            break;
          }
          default:           feitos = 0;
        }

        let esperados = i.frequency === "twice_daily" ? Math.max(2, i.times_per_day)
          : i.frequency === "daily" ? Math.max(1, i.times_per_day)
          : 1;

        // Remédio: o esperado é o número de doses do dia, não o times_per_day.
        if (i.metric === "medication") {
          esperados = Math.max(1, ((meds as any).dosesDeHoje ?? []).length);
        }

        // Frequência semanal ou maior: um registro na janela já conclui o dia.

        const esperadosSemanal = i.frequency === "weekly" || i.frequency === "biweekly" || i.frequency === "monthly";

        return {
          metric: i.metric,
          rotulo: ROTULO_METRICA[i.metric],
          feitos,
          esperados,
          // Item não-diário não vira cobrança diária: aparece como já resolvido
          // no dia, para não encher a tela inicial de dívida falsa.
          concluido: esperadosSemanal ? true : feitos >= esperados,
          instrucao: i.instructions,
        };
      });
  }, [itens, bp.readings, weight.readings, hr.readings, spo2.readings, glucose, sleep, activity,
      checkins.checkins, sodio, caminhadas, meds]);

  const abertas = pendencias.filter((p) => !p.concluido);
  const total = pendencias.length;
  const concluidas = total - abertas.length;

  return {
    pendencias,
    abertas,
    total,
    concluidas,
    /** 0 a 100 — o quanto do combinado de hoje já foi cumprido. */
    percentual: total === 0 ? 100 : Math.round((concluidas / total) * 100),
    prescrito,
    isLoading,
  };
}
