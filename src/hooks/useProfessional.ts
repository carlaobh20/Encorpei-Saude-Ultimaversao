/**
 * Lado do MÉDICO: perfil, fila de pacientes, alertas, mensagens e consultas.
 *
 * A "fila de risco" é o coração comercial do produto (docs §2.7): a lista
 * chega ordenada por quem precisa de atenção, não em ordem alfabética.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass, DEV_PRO_PROFILE } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toastError } from "@/lib/errorHandler";
import { DEMO_ALERTS, DEMO_APPOINTMENTS, DEMO_CAREGIVERS, DEMO_MESSAGES, DEMO_PRO_PATIENTS, type DemoPatientRow } from "@/lib/demoData";
import type { CardioAlert, CaregiverLink, RiskLevel } from "@/types/cardio";
import type { ProfessionalProfileRow } from "@/integrations/supabase/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ProfessionalProfile = ProfessionalProfileRow;

export function useProfessionalProfile() {
  const { user } = useAuth();
  const bypass = getDevBypass();
  const demoMedico = bypass?.role === "medico";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.professional.profile,
    enabled: !!user || demoMedico,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: async (): Promise<ProfessionalProfile | null> => {
      if (demoMedico) return DEV_PRO_PROFILE as unknown as ProfessionalProfile;
      const { data, error } = await (supabase as any)
        .from("professional_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as ProfessionalProfile) ?? null;
    },
  });

  const salvar = useMutation({
    mutationFn: async (dados: Partial<ProfessionalProfile>) => {
      if (demoMedico) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("professional_profiles")
        .upsert({ user_id: user!.id, ...dados }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.professional.all });
      toast.success("Perfil salvo.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o perfil."),
  });

  return {
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    salvar,
  };
}

// ── Fila de pacientes ────────────────────────────────────────────────

export interface FilaItem {
  patient_user_id: string;
  link_id: string;
  full_name: string;
  age: number | null;
  condition: string;
  risk: RiskLevel;
  headline: string;
  lastReadingAt: string | null;
  bpAvg: string | null;
  restingHr: number | null;
  adherence: number | null;
  openAlerts: number;
  nextAppointment: string | null;
  status: "active" | "pending";
  inviteCode: string | null;
}

const ORDEM_RISCO: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2 };

export function useProfessionalPatients() {
  const { profile } = useProfessionalProfile();
  const demo = getDevBypass()?.role === "medico";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.professional.fila,
    enabled: !!profile || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<FilaItem[]> => {
      if (demo) {
        return (DEMO_PRO_PATIENTS as DemoPatientRow[]).map((p, i) => ({
          patient_user_id: p.patient_user_id,
          link_id: `demo-link-${i}`,
          full_name: p.full_name,
          age: p.age,
          condition: p.condition,
          risk: p.risk,
          headline: p.headline,
          lastReadingAt: p.lastReadingAt,
          bpAvg: p.bpAvg,
          restingHr: p.restingHr,
          adherence: p.adherence,
          openAlerts: p.openAlerts,
          nextAppointment: p.nextAppointment,
          status: "active" as const,
          inviteCode: null,
        }));
      }

      const { data: links, error } = await (supabase as any)
        .from("professional_patient_links")
        .select("*")
        .eq("professional_id", profile!.id)
        .in("status", ["active", "pending"]);
      if (error) throw error;

      const ids = (links ?? []).map((l: any) => l.patient_user_id).filter(Boolean) as string[];
      if (ids.length === 0) {
        return (links ?? []).map((l: any) => ({
          patient_user_id: l.patient_user_id ?? "",
          link_id: l.id,
          full_name: "Convite pendente",
          age: null, condition: "", risk: "green" as RiskLevel,
          headline: "Aguardando o paciente aceitar o convite.",
          lastReadingAt: null, bpAvg: null, restingHr: null, adherence: null,
          openAlerts: 0, nextAppointment: null,
          status: l.status as "active" | "pending", inviteCode: l.invite_code,
        }));
      }

      // Uma consulta por domínio, não uma por paciente: com 60 pacientes,
      // N+1 aqui derruba o tempo de abertura do painel.
      const [pacientes, alertas, consultas] = await Promise.all([
        (supabase as any).from("cardio_patients").select("*").in("user_id", ids),
        (supabase as any).from("cardio_alerts").select("patient_user_id, severity, is_read, is_dismissed, title, trigger_value, triggered_at").in("patient_user_id", ids).eq("is_dismissed", false),
        (supabase as any).from("appointments").select("patient_user_id, scheduled_at, status").in("patient_user_id", ids).eq("status", "scheduled"),
      ]);

      const porPaciente = new Map<string, any>();
      for (const p of pacientes.data ?? []) porPaciente.set(p.user_id, p);

      const alertasPorPaciente = new Map<string, CardioAlert[]>();
      for (const a of (alertas.data ?? []) as CardioAlert[]) {
        const lista = alertasPorPaciente.get(a.patient_user_id) ?? [];
        lista.push(a);
        alertasPorPaciente.set(a.patient_user_id, lista);
      }

      const proximaConsulta = new Map<string, string>();
      for (const c of consultas.data ?? []) {
        const atual = proximaConsulta.get(c.patient_user_id);
        if (!atual || c.scheduled_at < atual) proximaConsulta.set(c.patient_user_id, c.scheduled_at);
      }

      return (links ?? []).map((l: any): FilaItem => {
        const p = l.patient_user_id ? porPaciente.get(l.patient_user_id) : null;
        const meus = l.patient_user_id ? alertasPorPaciente.get(l.patient_user_id) ?? [] : [];
        const critico = meus.some((a) => a.severity === "critical" || a.severity === "emergency");
        const atencao = meus.some((a) => a.severity === "warning");
        const risk: RiskLevel = critico ? "red" : atencao ? "yellow" : "green";
        const maisRecente = [...meus].sort((a, b) => (a.triggered_at < b.triggered_at ? 1 : -1))[0];

        return {
          patient_user_id: l.patient_user_id ?? "",
          link_id: l.id,
          full_name: p?.full_name ?? "Convite pendente",
          age: null,
          condition: resumirCondicao(p),
          risk,
          headline: maisRecente ? `${maisRecente.title} — ${maisRecente.trigger_value ?? ""}`.trim() : "Sem alertas abertos.",
          lastReadingAt: null,
          bpAvg: null,
          restingHr: null,
          adherence: null,
          openAlerts: meus.filter((a) => !a.is_read).length,
          nextAppointment: l.patient_user_id ? proximaConsulta.get(l.patient_user_id) ?? null : null,
          status: l.status,
          inviteCode: l.invite_code,
        };
      });
    },
  });

  const fila = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => ORDEM_RISCO[a.risk] - ORDEM_RISCO[b.risk] || b.openAlerts - a.openAlerts),
    [query.data]
  );

  const desvincular = useMutation({
    mutationFn: async (linkId: string) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("professional_patient_links")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.professional.all });
      toast.success("Vínculo encerrado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui encerrar o vínculo."),
  });

  return {
    patients: fila,
    ativos: fila.filter((p) => p.status === "active"),
    pendentes: fila.filter((p) => p.status === "pending"),
    contagem: {
      total: fila.length,
      vermelho: fila.filter((p) => p.risk === "red").length,
      amarelo: fila.filter((p) => p.risk === "yellow").length,
      verde: fila.filter((p) => p.risk === "green").length,
    },
    isLoading: query.isLoading,
    refetch: query.refetch,
    desvincular,
  };
}

function resumirCondicao(p: any): string {
  if (!p) return "";
  const partes: string[] = [];
  const h = p.history ?? {};
  const c = p.comorbidities ?? {};
  if (h.heart_failure) partes.push(h.lvef ? `IC FEVE ${h.lvef}%` : "IC");
  if (h.atrial_fibrillation) partes.push("FA");
  if (h.previous_mi) partes.push("Pós-IAM");
  if (c.hypertension) partes.push("HAS");
  if (c.diabetes) partes.push("DM2");
  if (c.dyslipidemia) partes.push("dislipidemia");
  return partes.join(" · ");
}

// ── Alertas do médico ────────────────────────────────────────────────

export function useProfessionalAlerts() {
  const { profile } = useProfessionalProfile();
  const demo = getDevBypass()?.role === "medico";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.alerts.doMedico,
    enabled: !!profile || demo,
    staleTime: 30_000,
    queryFn: async (): Promise<CardioAlert[]> => {
      if (demo) return DEMO_ALERTS;
      const { data, error } = await (supabase as any)
        .from("cardio_alerts")
        .select("*")
        .eq("professional_id", profile!.id)
        .eq("is_dismissed", false)
        .order("triggered_at", { ascending: false })
        .limit(100);
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
    criticos: alerts.filter((a) => a.severity === "critical" || a.severity === "emergency"),
    isLoading: query.isLoading,
    marcarLido,
    dispensar,
  };
}

// ── Mensagens ────────────────────────────────────────────────────────

export interface PatientMessage {
  id: string;
  patient_user_id: string;
  sender: "patient" | "doctor";
  sender_user_id: string;
  body: string;
  attachment_url: string | null;
  read_at: string | null;
  created_at: string;
}

export function usePatientMessages(
  patientUserId: string | undefined,
  sender: "patient" | "doctor",
  senderUserId: string | undefined
) {
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const key = queryKeys.messages.thread(patientUserId ?? "demo");

  const query = useQuery({
    queryKey: key,
    enabled: !!patientUserId || demo,
    staleTime: 15_000,
    refetchInterval: demo ? false : 30_000,
    queryFn: async (): Promise<PatientMessage[]> => {
      if (demo) return DEMO_MESSAGES as PatientMessage[];
      const { data, error } = await (supabase as any)
        .from("patient_messages")
        .select("*")
        .eq("patient_user_id", patientUserId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as PatientMessage[];
    },
  });

  const enviar = useMutation({
    mutationFn: async (body: string) => {
      if (demo) { toast.info("Modo demo: a mensagem não é enviada."); return; }
      const { error } = await (supabase as any).from("patient_messages").insert({
        patient_user_id: patientUserId,
        sender_user_id: senderUserId,
        sender,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toastError(e, "Não consegui enviar a mensagem."),
  });

  const marcarLidas = useMutation({
    mutationFn: async () => {
      if (demo || !patientUserId) return;
      const outroLado = sender === "doctor" ? "patient" : "doctor";
      const { error } = await (supabase as any)
        .from("patient_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("patient_user_id", patientUserId)
        .eq("sender", outroLado)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const messages = query.data ?? [];
  const naoLidas = messages.filter((m) => m.sender !== sender && !m.read_at).length;

  return { messages, naoLidas, isLoading: query.isLoading, enviar, marcarLidas };
}

// ── Cuidador (visão do médico) ──────────────────────────────────────

/**
 * Lado do MÉDICO: só leitura de quem acompanha este paciente em casa.
 * O médico não convida nem revoga — isso é do paciente (useCuidadores.ts).
 * Aqui só respondemos "existe cuidador ativo, e quem é".
 */
export function useCuidadoresDoPaciente(patientUserId: string | undefined) {
  const demo = !!getDevBypass();

  const query = useQuery({
    queryKey: ["cuidadoresDoPaciente", patientUserId ?? "demo"],
    enabled: !!patientUserId || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<CaregiverLink[]> => {
      if (demo) return DEMO_CAREGIVERS;
      const { data, error } = await (supabase as any)
        .from("caregiver_links")
        .select("*")
        .eq("patient_user_id", patientUserId)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as CaregiverLink[];
    },
  });

  const cuidadores = query.data ?? [];
  return { cuidadores, temCuidador: cuidadores.length > 0, isLoading: query.isLoading };
}

// ── Consultas ────────────────────────────────────────────────────────

export interface Appointment {
  id: string;
  patient_user_id: string;
  professional_id: string | null;
  scheduled_at: string;
  kind: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location: string | null;
  notes: string | null;
  created_at: string;
}

export function useAppointments(patientUserId?: string) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.appointments.de(uid ?? "demo"),
    enabled: !!uid || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<Appointment[]> => {
      if (demo) return DEMO_APPOINTMENTS as Appointment[];
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select("*")
        .eq("patient_user_id", uid)
        .order("scheduled_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Appointment[];
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: Partial<Appointment>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("appointments")
        .upsert({ patient_user_id: uid, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
      toast.success("Consulta salva.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar a consulta."),
  });

  const agora = Date.now();
  const appointments = query.data ?? [];
  const proxima = appointments
    .filter((a) => a.status === "scheduled" && +new Date(a.scheduled_at) > agora)
    .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))[0] ?? null;

  return { appointments, proxima, isLoading: query.isLoading, salvar };
}

// ── Indicadores da carteira ──────────────────────────────────────────

export interface IndicadoresCarteira {
  /** Média do Tempo no Alvo (30 dias) entre os pacientes com medida suficiente. */
  tempoNoAlvoMedio: number | null;
  /** Quantos pacientes entraram na média (nem todos têm medida). */
  pacientesComMedida: number;
  comCuidador: number;
  semRegistro10Dias: number;
  isLoading: boolean;
}

/**
 * Indicadores agregados do painel.
 *
 * TRÊS consultas para a carteira inteira, não três por paciente. A primeira
 * versão disto montava um componente-sonda por paciente e disparava ~4
 * consultas cada um: com 60 pacientes, a tela de abertura do médico — a que
 * vende o produto — abriria carregando milhares de linhas. Mesmo princípio
 * já aplicado em `useProfessionalPatients`.
 */
export function useIndicadoresDaCarteira(patientUserIds: string[]): IndicadoresCarteira {
  const demo = getDevBypass()?.role === "medico";
  const ids = useMemo(() => [...patientUserIds].filter(Boolean).sort(), [patientUserIds]);

  const query = useQuery({
    queryKey: [...queryKeys.professional.all, "indicadores", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (demo) {
        return {
          tempoNoAlvoMedio: 68,
          pacientesComMedida: DEMO_PRO_PATIENTS.length,
          comCuidador: 1,
          semRegistro10Dias: 1,
        };
      }

      const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [leituras, alvos, cuidadores] = await Promise.all([
        (supabase as any)
          .from("bp_readings")
          .select("patient_user_id, systolic, diastolic, recorded_at, cuff_validated, validation_status")
          .in("patient_user_id", ids)
          .gte("recorded_at", desde),
        (supabase as any)
          .from("cardio_targets")
          .select("patient_user_id, bp_systolic_max, bp_diastolic_max")
          .in("patient_user_id", ids),
        (supabase as any)
          .from("caregiver_links")
          .select("patient_user_id")
          .in("patient_user_id", ids)
          .eq("status", "active"),
      ]);

      const alvoPorPaciente = new Map<string, { s: number; d: number }>();
      for (const t of alvos.data ?? []) {
        alvoPorPaciente.set(t.patient_user_id, { s: t.bp_systolic_max, d: t.bp_diastolic_max });
      }

      const porPaciente = new Map<string, { dentro: number; total: number; ultima: number }>();
      for (const r of (leituras.data ?? []) as any[]) {
        // Mesma regra do motor: estimativa de pulseira não entra (docs §4).
        if (!r.cuff_validated || r.validation_status !== "validated") continue;
        const alvo = alvoPorPaciente.get(r.patient_user_id) ?? { s: 130, d: 80 };
        const atual = porPaciente.get(r.patient_user_id) ?? { dentro: 0, total: 0, ultima: 0 };
        atual.total += 1;
        if (r.systolic <= alvo.s && r.diastolic <= alvo.d) atual.dentro += 1;
        atual.ultima = Math.max(atual.ultima, +new Date(r.recorded_at));
        porPaciente.set(r.patient_user_id, atual);
      }

      const percentuais = [...porPaciente.values()]
        .filter((p) => p.total >= 3)
        .map((p) => (p.dentro / p.total) * 100);

      const limite = Date.now() - 10 * 86_400_000;
      const semRegistro = ids.filter((id) => {
        const p = porPaciente.get(id);
        return !p || p.ultima < limite;
      }).length;

      return {
        tempoNoAlvoMedio:
          percentuais.length > 0
            ? Math.round(percentuais.reduce((a, b) => a + b, 0) / percentuais.length)
            : null,
        pacientesComMedida: percentuais.length,
        comCuidador: new Set((cuidadores.data ?? []).map((c: any) => c.patient_user_id)).size,
        semRegistro10Dias: semRegistro,
      };
    },
  });

  return {
    tempoNoAlvoMedio: query.data?.tempoNoAlvoMedio ?? null,
    pacientesComMedida: query.data?.pacientesComMedida ?? 0,
    comCuidador: query.data?.comCuidador ?? 0,
    semRegistro10Dias: query.data?.semRegistro10Dias ?? 0,
    isLoading: query.isLoading,
  };
}
