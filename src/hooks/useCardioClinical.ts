/**
 * Sintomas, exames, alertas, dispositivos e o cálculo de risco do paciente.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import {
  DEMO_ALERTS, DEMO_DEVICES, DEMO_EXAMS, DEMO_LABS, DEMO_SYMPTOMS,
} from "@/lib/demoData";
import { avaliarRisco, type RiskResult } from "@/lib/clinical/cardioRiskEngine";
import { useBloodPressure, useHeartRate, useSleep, useSpo2, useWeight } from "./useCardioReadings";
import { useCardioMedications } from "./useCardioMedications";
import { useCardioPatient, useTargets } from "./useCardioPatient";
import type {
  CardioAlert, CardioExam, LabResult, RegisteredDevice, SymptomReport,
} from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Sintomas ─────────────────────────────────────────────────────────

export function useSymptoms(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.symptoms.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<SymptomReport[]> => {
      if (demo) return DEMO_SYMPTOMS;
      const { data, error } = await (supabase as any)
        .from("symptom_reports")
        .select("*")
        .eq("patient_user_id", uid)
        .order("occurred_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as SymptomReport[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (input: Partial<SymptomReport>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("symptom_reports")
        .insert({ patient_user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.symptoms.all });
      toast.success("Registrado. Seu médico consegue ver.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui registrar o sintoma."),
  });

  return { symptoms: query.data ?? [], isLoading: query.isLoading, registrar };
}

// ── Exames ───────────────────────────────────────────────────────────

export function useLabResults(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.labs.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LabResult[]> => {
      if (demo) return DEMO_LABS;
      const { data, error } = await (supabase as any)
        .from("lab_results")
        .select("*")
        .eq("patient_user_id", uid)
        .order("collected_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LabResult[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: Partial<LabResult> & { patient_user_id?: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("lab_results")
        .insert({ patient_user_id: input.patient_user_id ?? user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.labs.all });
      toast.success("Resultado salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o resultado."),
  });

  /** Último valor de cada marcador — é o que a tela quase sempre quer. */
  const ultimoPorMarcador = useMemo(() => {
    const mapa = new Map<string, LabResult>();
    for (const r of query.data ?? []) if (!mapa.has(r.marker_key)) mapa.set(r.marker_key, r);
    return mapa;
  }, [query.data]);

  return { labs: query.data ?? [], ultimoPorMarcador, isLoading: query.isLoading, salvar };
}

export function useCardioExams(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.exams.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CardioExam[]> => {
      if (demo) return DEMO_EXAMS;
      const { data, error } = await (supabase as any)
        .from("cardio_exams")
        .select("*")
        .eq("patient_user_id", uid)
        .order("performed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as CardioExam[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: Partial<CardioExam> & { patient_user_id?: string }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("cardio_exams")
        .insert({ patient_user_id: input.patient_user_id ?? user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.exams.all });
      toast.success("Exame salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o exame."),
  });

  return { exams: query.data ?? [], isLoading: query.isLoading, salvar };
}

// ── Alertas ──────────────────────────────────────────────────────────

export function useCardioAlerts(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.alerts.doPaciente(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 30_000,
    queryFn: async (): Promise<CardioAlert[]> => {
      if (demo) return DEMO_ALERTS;
      const { data, error } = await (supabase as any)
        .from("cardio_alerts")
        .select("*")
        .eq("patient_user_id", uid)
        .eq("is_dismissed", false)
        .order("triggered_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CardioAlert[];
    },
  });

  const marcarLido = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return;
      const { error } = await (supabase as any).from("cardio_alerts").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
  });

  const dispensar = useMutation({
    mutationFn: async (id: string) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any).from("cardio_alerts").update({ is_dismissed: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
    onError: (e: unknown) => toastError(e, "Não consegui dispensar o alerta."),
  });

  const alerts = query.data ?? [];
  return {
    alerts,
    naoLidos: alerts.filter((a) => !a.is_read).length,
    isLoading: query.isLoading,
    marcarLido,
    dispensar,
  };
}

// ── Dispositivos ─────────────────────────────────────────────────────

export function useDevices(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.devices.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RegisteredDevice[]> => {
      if (demo) return DEMO_DEVICES as unknown as RegisteredDevice[];
      const { data, error } = await (supabase as any)
        .from("registered_devices")
        .select("*")
        .eq("patient_user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RegisteredDevice[];
    },
  });

  const registrar = useMutation({
    mutationFn: async (device: Partial<RegisteredDevice>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("registered_devices")
        .insert({ patient_user_id: user!.id, ...device });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.devices.all });
      toast.success("Dispositivo registrado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui registrar o dispositivo."),
  });

  return { devices: query.data ?? [], isLoading: query.isLoading, registrar };
}

// ── Risco consolidado ────────────────────────────────────────────────

/**
 * Junta tudo e roda o motor. É o que alimenta o semáforo na fila do médico
 * e o cartão de situação na home do paciente.
 */
export function useRiskAssessment(patientUserId?: string): { risk: RiskResult; isLoading: boolean } {
  const { data: patient } = useCardioPatient(patientUserId);
  const { targets } = useTargets(patientUserId);
  const bp = useBloodPressure(patientUserId);
  const hr = useHeartRate(patientUserId);
  const weight = useWeight(patientUserId);
  const spo2 = useSpo2(patientUserId);
  const sleep = useSleep(patientUserId);
  const { symptoms } = useSymptoms(patientUserId);
  const { adesao } = useCardioMedications(patientUserId);

  const isLoading = bp.isLoading || hr.isLoading || weight.isLoading;

  const risk = useMemo(
    () =>
      avaliarRisco({
        targets,
        bloodPressure: bp.readings,
        heartRate: hr.readings,
        weight: weight.readings,
        spo2: spo2.readings,
        sleep: sleep.records,
        symptoms,
        adherence14d: adesao?.d14 ?? null,
        heartFailure: !!patient?.history?.heart_failure,
        now: new Date(),
      }),
    [targets, bp.readings, hr.readings, weight.readings, spo2.readings, sleep.records, symptoms, adesao, patient]
  );

  return { risk, isLoading };
}
