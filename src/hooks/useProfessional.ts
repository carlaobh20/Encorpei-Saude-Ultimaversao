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
import {
  agregarCarteira, agregadoDemo, classificarEstado, motivoDaFila, ultimaInformacao,
  AGREGADO_VAZIO, DIAS_ADESAO, DIAS_JANELA_MEDIDAS, DIAS_SEM_DADOS,
  type AgregadoPaciente, type EstadoFila,
} from "@/hooks/useCarteiraIndicadores";
import { idadeEmAnos } from "@/lib/clinical/scores";
import { classeDaRegra, rotuloDaRegra, type ClasseDeAlerta } from "@/lib/clinical/cardioAlertRules";

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

  // ── Acrescentado na correção da auditoria ──────────────────────────
  // Os campos acima continuam existindo com o mesmo significado porque
  // ProMensagensPage, ProAgendaPage, ProExamesPage, ProRelatoriosPage e
  // ProShell já os consomem. A diferença é que agora, fora do demo, eles vêm
  // preenchidos de verdade em vez de `null`.

  /** Estado explícito da fila — inclui `sem_dados_recentes`. */
  estado: EstadoFila;
  /** Uma frase respondendo "por que este paciente está aqui?". */
  motivo: string;
  /** "Pressão há 2 dias · digitado" — a última informação confiável. */
  ultimaInfo: string;
  /** Indicadores com valor, n, período e origem. */
  indicadores: AgregadoPaciente;
  /**
   * Tem pendência administrativa: convite não aceito ou alerta aberto sem
   * ninguém responsável. É filtro próprio porque é trabalho de secretaria, não
   * decisão clínica — e misturar os dois faz o médico perder tempo.
   */
  pendencia: boolean;
}

const ORDEM_RISCO: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2 };

/**
 * Ordem da fila.
 *
 * `sem_dados_recentes` entra em segundo lugar, à frente de "atenção": o
 * amarelo tem número por trás e pode esperar a tarde; o silêncio de uma semana
 * não tem nada por trás e é onde o médico está cego.
 */
const ORDEM_ESTADO: Record<EstadoFila, number> = {
  prioridade: 0,
  sem_dados_recentes: 1,
  atencao: 2,
  estavel: 3,
  convite_pendente: 4,
};

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
        // O demo passa pelas MESMAS funções de classificação e formatação do
        // caminho real (`agregadoDemo` só reconstrói a procedência que a linha
        // resumida do demo não guarda). Consequência desejada: Rita Camargo,
        // que em demoData.ts tem a última leitura há 11 dias, cai sozinha em
        // `sem_dados_recentes` — sem nenhuma marcação especial no arquivo de
        // demo. Se a regra dos 7 dias mudar, o demo muda junto.
        return (DEMO_PRO_PATIENTS as DemoPatientRow[]).map((p, i) => {
          const indicadores = agregadoDemo(p);
          const estado = classificarEstado({
            status: "active",
            risk: p.risk,
            ultimaMedidaEm: indicadores.ultimaMedidaEm,
          });
          return {
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
            estado,
            motivo: motivoDaFila({
              estado,
              headlineAlerta: p.headline,
              ultimaMedidaEm: indicadores.ultimaMedidaEm,
            }),
            ultimaInfo: ultimaInformacao(indicadores),
            indicadores,
            pendencia: p.openAlerts > 0,
          };
        });
      }

      const { data: links, error } = await (supabase as any)
        .from("professional_patient_links")
        .select("*")
        .eq("professional_id", profile!.id)
        .in("status", ["active", "pending"]);
      if (error) throw error;

      const ids = (links ?? []).map((l: any) => l.patient_user_id).filter(Boolean) as string[];
      if (ids.length === 0) {
        return (links ?? []).map((l: any): FilaItem => ({
          patient_user_id: l.patient_user_id ?? "",
          link_id: l.id,
          full_name: "Convite pendente",
          age: null, condition: "", risk: "green" as RiskLevel,
          headline: "Aguardando o paciente aceitar o convite.",
          lastReadingAt: null, bpAvg: null, restingHr: null, adherence: null,
          openAlerts: 0, nextAppointment: null,
          status: l.status as "active" | "pending", inviteCode: l.invite_code,
          estado: "convite_pendente",
          motivo: "Aguardando o paciente aceitar o convite.",
          ultimaInfo: "Nenhuma medida registrada.",
          indicadores: AGREGADO_VAZIO,
          pendencia: true,
        }));
      }

      // ── As consultas da carteira ─────────────────────────────────────
      //
      // REGRA INEGOCIÁVEL: nenhuma consulta dentro de `.map()`. Tudo o que a
      // fila mostra sai de um número FIXO de consultas — 8 — cada uma com
      // `.in('patient_user_id', ids)`, independente de a carteira ter 3 ou 300
      // pacientes. Cinco delas são as agregações de indicador acrescentadas
      // agora (bp, hr, peso, doses, prescrições); as outras três já existiam.
      //
      // Esta tela já foi derrubada por N+1: uma versão anterior disparava ~4
      // consultas por paciente e, com 60 pacientes, a tela que vende o produto
      // abria carregando milhares de linhas. O custo de fazer certo é agregar
      // em memória — O(linhas), em `agregarCarteira`, sem rede no meio.
      //
      // As janelas vão na cláusula `gte` e não no cliente: trazer 12 meses de
      // pressão de 300 pacientes para descartar 11 no navegador seria trocar
      // N+1 por transferência inútil.
      const desdeMedidas = new Date(Date.now() - DIAS_JANELA_MEDIDAS * 86_400_000).toISOString();
      const desdeAdesao = new Date(Date.now() - (DIAS_ADESAO - 1) * 86_400_000).toISOString().slice(0, 10);

      const [pacientes, alertas, consultas, pa, fc, peso, doses, prescricoes] = await Promise.all([
        (supabase as any).from("cardio_patients").select("*").in("user_id", ids),
        (supabase as any).from("cardio_alerts").select("patient_user_id, severity, is_read, is_dismissed, title, trigger_value, triggered_at, workflow_status, assigned_to").in("patient_user_id", ids).eq("is_dismissed", false),
        (supabase as any).from("appointments").select("patient_user_id, scheduled_at, status").in("patient_user_id", ids).eq("status", "scheduled"),
        // PA: trazemos também as não-validadas para poder DIZER quantas ficaram
        // de fora da média, em vez de filtrar no banco e o médico ver um "sem
        // medidas suficientes" inexplicável num paciente que mede todo dia.
        (supabase as any)
          .from("bp_readings")
          .select("patient_user_id, systolic, diastolic, recorded_at, cuff_validated, validation_status, source_type")
          .in("patient_user_id", ids)
          .gte("recorded_at", desdeMedidas),
        (supabase as any)
          .from("hr_readings")
          .select("patient_user_id, bpm, recorded_at, context, validation_status, source_type")
          .in("patient_user_id", ids)
          .eq("context", "resting")
          .gte("recorded_at", desdeMedidas),
        (supabase as any)
          .from("weight_readings")
          .select("patient_user_id, value, recorded_at, validation_status, source_type")
          .in("patient_user_id", ids)
          .gte("recorded_at", desdeMedidas),
        (supabase as any)
          .from("medication_intakes")
          .select("patient_user_id, taken, intake_date")
          .in("patient_user_id", ids)
          .gte("intake_date", desdeAdesao),
        // O denominador da adesão vem da PRESCRIÇÃO, não das linhas de tomada:
        // ver o comentário longo em `agregarCarteira`.
        (supabase as any)
          .from("cardio_medications")
          .select("patient_user_id, schedule, started_at, suspended_at, status")
          .in("patient_user_id", ids)
          .eq("status", "active"),
      ]);

      const indicadoresPorPaciente = agregarCarteira(ids, {
        bp: pa.data ?? [],
        hr: fc.data ?? [],
        weight: peso.data ?? [],
        intakes: doses.data ?? [],
        medications: prescricoes.data ?? [],
      });

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

        const ind = (l.patient_user_id ? indicadoresPorPaciente.get(l.patient_user_id) : null) ?? AGREGADO_VAZIO;
        const headline = maisRecente
          ? `${maisRecente.title} — ${maisRecente.trigger_value ?? ""}`.trim()
          : "";

        const estado = classificarEstado({
          status: l.status,
          risk,
          ultimaMedidaEm: ind.ultimaMedidaEm,
        });

        // Alerta aberto sem responsável é pendência de fila de trabalho. Um
        // alerta já em avaliação por alguém não é: aparece na tela de alertas,
        // não no filtro de pendências do painel.
        const semResponsavel = meus.filter(
          (a: any) => !a.assigned_to && (a.workflow_status ?? "open") === "open",
        ).length;

        return {
          patient_user_id: l.patient_user_id ?? "",
          link_id: l.id,
          full_name: p?.full_name ?? "Convite pendente",
          // Idade sai de `birth_date` — nunca de um campo `age` gravado, que
          // envelheceria errado e teria que ser recalculado por alguém.
          age: idadeEmAnos(p?.birth_date),
          condition: resumirCondicao(p),
          risk,
          headline: headline || "Sem alertas abertos.",
          lastReadingAt: ind.ultimaMedidaEm,
          // `bpAvg` / `restingHr` / `adherence` continuam no formato antigo
          // (string "132/81", bpm, fração 0..1) porque outras telas já leem
          // assim; o detalhe com n e origem vive em `indicadores`.
          bpAvg: ind.pa.valor,
          restingHr: ind.fcRepouso.valor ? parseInt(ind.fcRepouso.valor, 10) : null,
          adherence: ind.adesao.percentual,
          openAlerts: meus.filter((a) => !a.is_read).length,
          nextAppointment: l.patient_user_id ? proximaConsulta.get(l.patient_user_id) ?? null : null,
          status: l.status,
          inviteCode: l.invite_code,
          estado,
          motivo: motivoDaFila({ estado, headlineAlerta: headline || null, ultimaMedidaEm: ind.ultimaMedidaEm }),
          ultimaInfo: ultimaInformacao(ind),
          indicadores: ind,
          pendencia: l.status === "pending" || semResponsavel > 0,
        };
      });
    },
  });

  // Ordenação por ESTADO, não por risco puro: com o estado explícito, um
  // paciente em silêncio há 9 dias sobe acima de um amarelo com alerta de
  // ontem. `ORDEM_RISCO` continua como critério de desempate dentro do mesmo
  // estado (dois "prioridade" ainda se ordenam entre si).
  const fila = useMemo(
    () =>
      [...(query.data ?? [])].sort(
        (a, b) =>
          ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] ||
          ORDEM_RISCO[a.risk] - ORDEM_RISCO[b.risk] ||
          b.openAlerts - a.openAlerts,
      ),
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
      // As três primeiras contagens continuam por RISCO porque ProAccountPage
      // já as consome; as de estado são as que a fila usa agora.
      vermelho: fila.filter((p) => p.risk === "red").length,
      amarelo: fila.filter((p) => p.risk === "yellow").length,
      verde: fila.filter((p) => p.risk === "green").length,
      prioridade: fila.filter((p) => p.estado === "prioridade").length,
      atencao: fila.filter((p) => p.estado === "atencao").length,
      /** O número que a tela escondia: silêncio de mais de 7 dias. */
      semDadosRecentes: fila.filter((p) => p.estado === "sem_dados_recentes").length,
      estaveis: fila.filter((p) => p.estado === "estavel").length,
      comPendencia: fila.filter((p) => p.pendencia).length,
      diasSemDados: DIAS_SEM_DADOS,
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

/**
 * Fluxo de trabalho do alerta (migração 20260913000000_alertas_workflow).
 *
 * `is_read`/`is_dismissed` respondiam "alguém olhou?". Não respondiam "quem
 * assumiu?", "o paciente foi contatado?" e "por que foi encerrado?" — que são
 * as perguntas de qualquer revisão de evento adverso. O gatilho no banco mantém
 * as flags antigas coerentes com o fluxo, então nada que já lia `is_read`
 * quebra.
 */
export type AlertWorkflowStatus = "open" | "reviewing" | "contacted" | "resolved";

export const ORDEM_WORKFLOW: AlertWorkflowStatus[] = ["open", "reviewing", "contacted", "resolved"];

export const LABEL_WORKFLOW: Record<AlertWorkflowStatus, string> = {
  open: "Aberto",
  reviewing: "Em avaliação",
  contacted: "Contato realizado",
  resolved: "Resolvido",
};

/**
 * `CardioAlert` mora em `@/types/cardio` e ainda não conhece as colunas novas.
 * Estendemos aqui, com campos opcionais, em vez de alargar o tipo do domínio:
 * assim uma linha vinda de um banco ainda sem a migração aplicada continua
 * sendo um `CardioAlert` válido, e o código trata `undefined` como `"open"`.
 */
export interface AlertaComFluxo extends CardioAlert {
  workflow_status?: AlertWorkflowStatus | null;
  assigned_to?: string | null;
  resolution_note?: string | null;
  resolved_at?: string | null;
  resolved_by?: string | null;
  /** `rule_code` traduzido — ver `rotuloDaRegra` em cardioAlertRules. */
  rotulo?: string;
  /** Risco clínico ou atraso operacional. */
  classe?: ClasseDeAlerta;
}

export function fluxoDoAlerta(a: AlertaComFluxo): AlertWorkflowStatus {
  return (a.workflow_status as AlertWorkflowStatus) ?? (a.is_dismissed ? "resolved" : a.is_read ? "reviewing" : "open");
}

/**
 * Risco clínico × atraso operacional.
 *
 * Um alerta de adesão ou de silêncio não descreve o coração do paciente:
 * descreve a relação dele com o tratamento e com o app. Misturados aos alertas
 * de PA e de ritmo, eles inflam a fila crítica e treinam o médico a ignorar a
 * lista — que é o pior desfecho possível para uma tela de alerta. Separados,
 * viram trabalho de secretaria (ligar, reagendar, ensinar o app) e param de
 * competir com decisão clínica.
 *
 * AUDITORIA: o conjunto aqui era `{"adesao_baixa","sem_dados"}` — os códigos
 * do motor do CLIENTE, que nunca são gravados em `cardio_alerts`. O banco
 * emite `bp_*`, `hr_*`, `spo2_*`, `weight_*`, `no_data`, `adherence_low` e
 * `symptom_*`. Resultado: `ehOperacional` devolvia falso para toda linha real
 * e a aba "Atraso operacional" nunca teve conteúdo. A classificação passa a
 * sair da régua canônica em cardioAlertRules, que conhece as duas
 * nomenclaturas — se um gatilho novo nascer no banco, ele nasce lá e as duas
 * abas continuam corretas sem ninguém tocar neste arquivo.
 */
export function ehOperacional(a: CardioAlert): boolean {
  return classeDaRegra(a.rule_code) === "operacional";
}

export function useProfessionalAlerts() {
  const { profile } = useProfessionalProfile();
  const { user } = useAuth();
  const demo = getDevBypass()?.role === "medico";
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.alerts.doMedico,
    enabled: !!profile || demo,
    staleTime: 30_000,
    queryFn: async (): Promise<AlertaComFluxo[]> => {
      if (demo) {
        // O demo precisa mostrar o fluxo cheio, senão a demonstração ensina que
        // alerta só tem dois estados. Derivamos daqui — e não de campos novos
        // em demoData.ts — pela mesma razão da fila: uma verdade, um lugar.
        return DEMO_ALERTS.map((a, i): AlertaComFluxo => {
          const status: AlertWorkflowStatus = a.is_read ? (i % 2 === 0 ? "contacted" : "reviewing") : "open";
          return {
            ...a,
            workflow_status: status,
            assigned_to: status === "open" ? null : "demo-user-medico-001",
            resolution_note: null,
            resolved_at: null,
            resolved_by: null,
          };
        });
      }
      const { data, error } = await (supabase as any)
        .from("cardio_alerts")
        .select("*")
        .eq("professional_id", profile!.id)
        // Continuamos filtrando por `is_dismissed` e não por `workflow_status`:
        // o gatilho garante que resolvido ⇒ dispensado, e assim a consulta
        // segue usando o índice parcial que já existe no baseline.
        .eq("is_dismissed", false)
        .order("triggered_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AlertaComFluxo[];
    },
  });

  // Mesma regra do lado do paciente: `.update()` sem `.select()` devolve
  // sucesso com zero linhas quando a RLS barra. Aqui a política do médico
  // existe (`alerts_doctor`), mas um alerta de paciente já desvinculado cai
  // fora dela — e o médico via "marcado" sem nada ter sido marcado.
  const escreverAlerta = async (id: string, patch: Record<string, unknown>) => {
    const { data, error } = await (supabase as any)
      .from("cardio_alerts")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error("Nenhuma linha foi alterada — o alerta pode não pertencer mais à sua carteira.");
    }
  };

  const marcarLido = useMutation({
    mutationFn: async (id: string) => {
      if (demo) return;
      await escreverAlerta(id, { is_read: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
    onError: (e: unknown) => toastError(e, "Não consegui marcar o alerta como lido."),
  });

  const dispensar = useMutation({
    mutationFn: async (id: string) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      await escreverAlerta(id, { is_dismissed: true });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.alerts.all }),
    onError: (e: unknown) => toastError(e, "Não consegui dispensar o alerta."),
  });

  /**
   * Avançar o alerta no fluxo. Resolver EXIGE justificativa — a tela não
   * oferece botão sem nota, e aqui a exigência é repetida porque a mutation é
   * chamável de fora dela. Um "resolvido" sem por quê é indistinguível de um
   * alerta que alguém fechou para limpar a tela.
   */
  const mover = useMutation({
    mutationFn: async (input: { id: string; para: AlertWorkflowStatus; justificativa?: string }) => {
      if (input.para === "resolved" && !input.justificativa?.trim()) {
        throw new Error("Escreva o que foi verificado antes de resolver o alerta.");
      }
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const agora = new Date().toISOString();
      const patch: Record<string, unknown> = {
        workflow_status: input.para,
        // Quem move o alerta assume o alerta. Estado "em avaliação" sem
        // responsável é o mesmo buraco de antes, com nome novo.
        assigned_to: user?.id ?? null,
      };
      if (input.para === "resolved") {
        patch.resolution_note = input.justificativa!.trim();
        patch.resolved_at = agora;
        patch.resolved_by = user?.id ?? null;
      }
      await escreverAlerta(input.id, patch);
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: queryKeys.alerts.all });
      qc.invalidateQueries({ queryKey: queryKeys.professional.all });
      toast.success(`Alerta marcado como "${LABEL_WORKFLOW[v.para].toLowerCase()}".`);
    },
    onError: (e: unknown) => toastError(e, "Não consegui atualizar o alerta."),
  });

  // A tradução do `rule_code` sai daqui já pronta — mesma ponte usada no lado
  // do paciente (`useCardioAlerts`), para que o mesmo alerta tenha o mesmo
  // nome nas duas telas.
  const alerts = useMemo<AlertaComFluxo[]>(
    () =>
      (query.data ?? []).map((a) => ({
        ...a,
        rotulo: rotuloDaRegra(a.rule_code),
        classe: classeDaRegra(a.rule_code),
      })),
    [query.data]
  );
  const clinicos = alerts.filter((a) => !ehOperacional(a));
  const operacionais = alerts.filter(ehOperacional);

  return {
    alerts,
    /** Risco clínico: PA, ritmo, peso, sintoma, exame. */
    clinicos,
    /** Atraso operacional: adesão e ausência de registro. */
    operacionais,
    naoLidos: alerts.filter((a) => !a.is_read).length,
    criticos: alerts.filter((a) => a.severity === "critical" || a.severity === "emergency"),
    /** Sem ninguém responsável — a fila de trabalho de verdade. */
    semResponsavel: alerts.filter((a) => fluxoDoAlerta(a) === "open").length,
    isLoading: query.isLoading,
    marcarLido,
    dispensar,
    mover,
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

  /**
   * Marcar como lidas as mensagens do OUTRO lado.
   *
   * AUDITORIA — o que estava e o que não estava errado aqui:
   *
   *  · O gatilho `mensagem_imutavel` (20260912000000 §4) NÃO está invertido.
   *    Ele desfaz a mudança de `read_at` quando `old.sender_user_id =
   *    auth.uid()`, isto é, quando quem escreve é o REMETENTE. Quem recebeu
   *    passa. É a regra certa. Mesmo assim ele foi reescrito na migração
   *    20260917000000 para (a) comparar com `is distinct from`, que continua
   *    valendo se `sender_user_id` vier nulo, e (b) rejeitar em vez de
   *    silenciosamente desfazer — desfazer em silêncio foi metade do motivo
   *    de este bug ter durado tanto.
   *
   *  · O que estava errado é isto aqui: `.update()` sem `.select()`. O filtro
   *    `.eq("sender", outroLado)` mais o gatilho podem resultar em ZERO linhas
   *    com `error === null`; o `onSuccess` rodava, a thread era invalidada e o
   *    contador de não lidas voltava intacto no refetch. Agora a escrita
   *    devolve as linhas afetadas, e o contador de não lidas é atualizado no
   *    cache com o que o servidor DE FATO gravou — não com o que se esperava
   *    que gravasse.
   *
   * Zero linhas não é erro: quando não há nada por ler, zero é a resposta
   * correta. O que é erro é o servidor recusar — e isso vem em `error`.
   */
  const marcarLidas = useMutation({
    mutationFn: async (): Promise<number> => {
      if (demo || !patientUserId) return 0;
      const outroLado = sender === "doctor" ? "patient" : "doctor";
      const { data, error } = await (supabase as any)
        .from("patient_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("patient_user_id", patientUserId)
        .eq("sender", outroLado)
        .is("read_at", null)
        .select("id, read_at");
      if (error) throw error;
      return (data ?? []).length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: unknown) => toastError(e, "Não consegui marcar as mensagens como lidas."),
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
