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
import { queryKeys } from "@/lib/queryKeys";
import {
  useBloodPressure, useWeight, useHeartRate, useSpo2, useGlucose, useSleep, useActivity,
} from "@/hooks/useCardioReadings";
import { useCheckins, useSodio, useCaminhadas } from "@/hooks/useEngajamento";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useSymptoms } from "@/hooks/useCardioClinical";

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
    queryKey: queryKeys.monitoringPlan.ativos(alvo ?? "demo"),
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
  /**
   * Quantos dias a janela do item cobre. 1 = é cobrança de hoje; 7/15/30 =
   * a cobrança é do período. Quem exibe precisa disso para não escrever
   * "você fez isso hoje" em cima de um registro de cinco dias atrás.
   */
  janelaDias: number;
  frequency: Frequencia;
}

/** Chave de dia no fuso do PACIENTE (AAAA-MM-DD). */
function diaLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O dia a que um registro pertence.
 *
 * Duas formas chegam aqui e as duas quebram se tratadas igual:
 *   · coluna `date` (`sleep_date`, `activity_date`, `dia`) vem como
 *     "AAAA-MM-DD" — passar essa string por `new Date()` a interpreta como
 *     MEIA-NOITE EM UTC, e em UTC−3 o sono de hoje vira o de ontem;
 *   · coluna `timestamptz` precisa da conversão para o fuso local, senão o
 *     registro das 22h de ontem conta como hoje.
 * Por isso a data pura é devolvida como está e só o timestamp é convertido.
 */
function diaDoRegistro(v: unknown): string | null {
  if (typeof v !== "string" || v === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : diaLocal(d);
}

/**
 * Janela de verificação por frequência, EM DIAS.
 *
 * É esta tabela que faz "uma vez por semana" significar alguma coisa. Antes,
 * qualquer frequência maior que diária era marcada como concluída todo dia —
 * o item nunca aparecia, e ainda somava no numerador de `percentual`, que
 * assim media a prescrição em vez de medir o paciente.
 */
const JANELA_DIAS: Record<Frequencia, number> = {
  daily: 1,
  twice_daily: 1,
  weekly: 7,
  biweekly: 15,
  monthly: 30,
  as_needed: 0,
};

/** Primeiro dia (inclusive) da janela de `dias` que termina hoje. */
function inicioDaJanela(dias: number): string {
  return diaLocal(new Date(Date.now() - Math.max(0, dias - 1) * 86_400_000));
}

function contarNaJanela(lista: any, campo: string, dias: number): number {
  if (!Array.isArray(lista) || dias <= 0) return 0;
  const desde = inicioDaJanela(dias);
  // Comparação de string: "AAAA-MM-DD" é ordenável lexicograficamente.
  return lista.filter((r) => {
    const d = diaDoRegistro(r?.[campo]);
    return d !== null && d >= desde;
  }).length;
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
  // Sintoma é métrica PRESCRITÍVEL pelo médico (está no check do banco e na
  // lista do editor). Sem esta consulta, "symptoms" caía no `default` do
  // switch, ficava 0/1 para sempre e não havia ação no app capaz de fechá-la.
  // A consulta é feita AQUI, uma vez, junto das outras — nunca dentro do
  // `.map()` abaixo, que roda uma vez por item do plano.
  const sintomas = useSymptoms(patientUserId);

  const pendencias = useMemo<Pendencia[]>(() => {
    const doses: any[] = (meds as any).dosesDeHoje ?? [];
    const intakes: any[] = (meds as any).intakes ?? [];

    return itens
      .filter((i) => i.frequency !== "as_needed")
      .map((i): Pendencia | null => {
        const janelaDias = JANELA_DIAS[i.frequency] ?? 1;
        const diaria = janelaDias <= 1;

        // Quanto o combinado pede DENTRO da janela. Só a frequência diária
        // pede mais de um registro; semanal/quinzenal/mensal pedem um, e a
        // diferença entre elas está no tamanho da janela, não no alvo.
        let esperados = i.frequency === "twice_daily"
          ? Math.max(2, i.times_per_day)
          : i.frequency === "daily"
            ? Math.max(1, i.times_per_day)
            : 1;

        let feitos = 0;
        switch (i.metric) {
          case "bp":        feitos = contarNaJanela(bp.readings, "recorded_at", janelaDias); break;
          case "weight":    feitos = contarNaJanela(weight.readings, "recorded_at", janelaDias); break;
          case "hr":        feitos = contarNaJanela(hr.readings, "recorded_at", janelaDias); break;
          case "spo2":      feitos = contarNaJanela(spo2.readings, "recorded_at", janelaDias); break;
          case "glucose":   feitos = contarNaJanela((glucose as any).readings, "recorded_at", janelaDias); break;
          // `sleep_records` não tem `start_at`: a coluna é `sleep_date` (uma
          // linha por noite, `unique (patient_user_id, sleep_date)`). Lendo um
          // campo inexistente, `feitos` era 0 todo dia e o item de sono era
          // impossível de fechar — a pendência que a auditoria viu nunca sumir.
          case "sleep":     feitos = contarNaJanela((sleep as any).records, "sleep_date", janelaDias); break;
          // Mesmo erro, mais silencioso: `activity_records` TEM `recorded_at`,
          // mas ele é o instante da sincronização da pulseira, não o dia a que
          // os passos se referem. Sincronizar ontem-e-hoje de uma vez fechava
          // dois dias; sincronizar amanhã não fechava hoje. O dia é
          // `activity_date`, que é a chave única da linha.
          case "steps":     feitos = contarNaJanela((activity as any).records, "activity_date", janelaDias); break;
          case "wellbeing": feitos = contarNaJanela(checkins.checkins, "ocorrido_em", janelaDias); break;
          // `useSodio().hoje` é a STRING do dia ("2026-09-13"), não uma
          // contagem: `"2026-09-13" > 0` é `false` sempre, e o item de sal
          // também nunca fechava. O que conta é haver registro de sódio na
          // janela — a coluna é `dia`, tipo `date`.
          case "sodium":    feitos = contarNaJanela((sodio as any).registros, "dia", janelaDias); break;
          case "walk":      feitos = contarNaJanela((caminhadas as any).sessoes, "iniciada_em", janelaDias); break;
          case "symptoms":  feitos = contarNaJanela(sintomas.symptoms, "occurred_at", janelaDias); break;
          case "medication": {
            // Sem dose cadastrada não há o que cobrar NEM o que comemorar. O
            // código antigo devolvia `feitos = 1` nesse caso e o paciente sem
            // nenhuma prescrição via "Remédios: feito" — o app afirmando que
            // ele tomou um remédio que não existe. O item sai da lista.
            if (doses.length === 0) return null;
            if (diaria) {
              esperados = doses.length;
              feitos = doses.filter((d: any) => d.taken).length;
            } else {
              // Frequência não-diária em remédio é rara, mas possível: aí o
              // que vale é ter marcado alguma dose dentro da janela.
              esperados = 1;
              feitos = contarNaJanela(intakes.filter((x: any) => x.taken), "intake_date", janelaDias) > 0 ? 1 : 0;
            }
            break;
          }
          default: feitos = 0;
        }

        return {
          metric: i.metric,
          rotulo: ROTULO_METRICA[i.metric],
          feitos,
          esperados,
          // Regra única para toda frequência: cumpriu o esperado DENTRO da
          // janela. Item semanal só some da lista depois de cumprido nos
          // últimos 7 dias — e volta sozinho quando a janela passa.
          concluido: feitos >= esperados,
          instrucao: i.instructions,
          janelaDias,
          frequency: i.frequency,
        };
      })
      .filter((p): p is Pendencia => p !== null);
  }, [itens, bp.readings, weight.readings, hr.readings, spo2.readings, glucose, sleep, activity,
      checkins.checkins, sodio, caminhadas, meds, sintomas.symptoms]);

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

// ── A instrução do médico, onde a métrica aparece ─────────────────────
//
// `monitoring_plan.instructions` é escrito por métrica no editor do médico e
// era lido em UM lugar só: o item prioritário da tela inicial. Quem tinha
// instrução em "Sono" e "Peso" via a de "Peso" (ou nenhuma) e nunca a outra —
// o médico escrevia para o vazio. Este hook devolve o plano indexado por
// métrica para que qualquer tela pergunte "existe instrução para isto?" com
// UMA consulta compartilhada no cache do react-query, e não uma por item.

export function useInstrucoesDoPlano(patientUserId?: string) {
  const { itens, prescrito, isLoading } = usePlanoMonitoramento(patientUserId);

  const porMetrica = useMemo(() => {
    const mapa = new Map<MetricaPlano, ItemPlano>();
    for (const i of itens) if (i.is_active !== false) mapa.set(i.metric, i);
    return mapa;
  }, [itens]);

  return { porMetrica, itens, prescrito, isLoading };
}

export const ROTULO_HORARIO: Record<NonNullable<ItemPlano["preferred_time"]>, string> = {
  morning: "de manhã",
  afternoon: "à tarde",
  evening: "à noite",
  any: "em qualquer horário",
};
