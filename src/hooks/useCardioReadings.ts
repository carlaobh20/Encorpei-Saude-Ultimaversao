/**
 * Camada de dados das leituras clínicas.
 *
 * Um único arquivo porque todas as tabelas de leitura têm a mesma forma
 * (patient_user_id + recorded_at + proveniência) e o mesmo comportamento em
 * modo demo. Uma fábrica evita nove arquivos que só mudam o nome da tabela.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import {
  DEMO_ACTIVITY, DEMO_BLOOD_PRESSURE, DEMO_HEART_RATE, DEMO_SLEEP,
  DEMO_SPO2, DEMO_WEIGHT,
} from "@/lib/demoData";
import type {
  ActivityReading, BloodPressureReading, GlucoseReading, HeartRateReading,
  SleepReading, Spo2Reading, WeightReading,
} from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LeituraOpts<T> {
  tabela: string;
  chave: (uid: string) => readonly unknown[];
  demo: T[];
  ordenarPor?: string;
  limite?: number;
}

function useLeituras<T>(
  { tabela, chave, demo, ordenarPor = "recorded_at", limite = 200 }: LeituraOpts<T>,
  patientUserId?: string
) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demoAtivo = !!getDevBypass();

  const query = useQuery({
    queryKey: chave(uid ?? "demo"),
    enabled: !!uid || demoAtivo,
    staleTime: 60_000,
    queryFn: async (): Promise<T[]> => {
      if (demoAtivo) return demo;
      const { data, error } = await (supabase as any)
        .from(tabela)
        .select("*")
        .eq("patient_user_id", uid)
        .order(ordenarPor, { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });

  return { data: query.data ?? [], isLoading: query.isLoading, isError: query.isError, refetch: query.refetch, uid, demoAtivo };
}

function useRegistrar<TInput>(tabela: string, chaves: readonly (readonly unknown[])[], mensagem: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: TInput) => {
      if (getDevBypass()) {
        toast.info("Modo demo: nada é salvo.");
        return;
      }
      const { error } = await (supabase as any)
        .from(tabela)
        .insert({ patient_user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      chaves.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(mensagem);
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar agora."),
  });
}

// ── Pressão arterial ─────────────────────────────────────────────────

export interface NovaPressao {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  context: BloodPressureReading["context"];
  /** Aparelho de braço validado? Só `true` conta para MRPA e alerta. */
  cuff_validated: boolean;
  arm?: "left" | "right" | null;
  position?: "seated" | "lying" | "standing" | null;
  notes?: string | null;
  recorded_at?: string;
}

export function useBloodPressure(patientUserId?: string) {
  const r = useLeituras<BloodPressureReading>(
    { tabela: "bp_readings", chave: queryKeys.bp.de, demo: DEMO_BLOOD_PRESSURE },
    patientUserId
  );
  const registrar = useRegistrar<NovaPressao>("bp_readings", [queryKeys.bp.all], "Pressão registrada.");

  const ultima = r.data[0] ?? null;
  return { ...r, readings: r.data, ultima, registrar };
}

// ── Frequência cardíaca ──────────────────────────────────────────────

export function useHeartRate(patientUserId?: string) {
  const r = useLeituras<HeartRateReading>(
    { tabela: "hr_readings", chave: queryKeys.hr.de, demo: DEMO_HEART_RATE },
    patientUserId
  );
  const registrar = useRegistrar<{ bpm: number; context?: string; recorded_at?: string }>(
    "hr_readings", [queryKeys.hr.all], "Frequência registrada."
  );
  const repouso = r.data.filter((x) => x.context === "resting");
  return { ...r, readings: r.data, repouso, ultima: r.data[0] ?? null, registrar };
}

// ── Peso ─────────────────────────────────────────────────────────────

export function useWeight(patientUserId?: string) {
  const r = useLeituras<WeightReading>(
    { tabela: "weight_readings", chave: queryKeys.weight.de, demo: DEMO_WEIGHT },
    patientUserId
  );
  const registrar = useRegistrar<{ value: number; notes?: string | null; recorded_at?: string }>(
    "weight_readings", [queryKeys.weight.all], "Peso registrado."
  );
  return { ...r, readings: r.data, ultimo: r.data[0] ?? null, registrar };
}

// ── Oxigenação ───────────────────────────────────────────────────────

export function useSpo2(patientUserId?: string) {
  const r = useLeituras<Spo2Reading>(
    { tabela: "spo2_readings", chave: queryKeys.spo2.de, demo: DEMO_SPO2 },
    patientUserId
  );
  const registrar = useRegistrar<{ value: number; context?: string }>(
    "spo2_readings", [queryKeys.spo2.all], "Oxigenação registrada."
  );
  return { ...r, readings: r.data, ultima: r.data[0] ?? null, registrar };
}

// ── Glicemia ─────────────────────────────────────────────────────────

export function useGlucose(patientUserId?: string) {
  const r = useLeituras<GlucoseReading>(
    { tabela: "glucose_readings", chave: queryKeys.glucose.de, demo: [] },
    patientUserId
  );
  const registrar = useRegistrar<{ value: number; context: string }>(
    "glucose_readings", [queryKeys.glucose.all], "Glicemia registrada."
  );
  return { ...r, readings: r.data, registrar };
}

// ── Sono ─────────────────────────────────────────────────────────────

export function useSleep(patientUserId?: string) {
  const r = useLeituras<SleepReading>(
    { tabela: "sleep_records", chave: queryKeys.sleep.de, demo: DEMO_SLEEP, ordenarPor: "sleep_date", limite: 90 },
    patientUserId
  );
  const mediaMinutos =
    r.data.length > 0 ? Math.round(r.data.slice(0, 7).reduce((s, x) => s + x.total_minutes, 0) / Math.min(7, r.data.length)) : null;
  return { ...r, records: r.data, ultima: r.data[0] ?? null, mediaMinutos };
}

// ── Atividade ────────────────────────────────────────────────────────

export function useActivity(patientUserId?: string) {
  const r = useLeituras<ActivityReading>(
    { tabela: "activity_records", chave: queryKeys.activity.de, demo: DEMO_ACTIVITY, ordenarPor: "activity_date", limite: 90 },
    patientUserId
  );
  const ultimos7 = r.data.slice(0, 7);
  const passosMedia =
    ultimos7.length > 0 ? Math.round(ultimos7.reduce((s, x) => s + (x.steps ?? 0), 0) / ultimos7.length) : null;
  const mvpaSemana = ultimos7.reduce((s, x) => s + (x.moderate_minutes ?? 0) + (x.vigorous_minutes ?? 0), 0);
  return { ...r, records: r.data, hoje: r.data[0] ?? null, passosMedia, mvpaSemana };
}
