/**
 * Camada de dados do engajamento — docs/ENGAJAMENTO-CARDIO.md.
 *
 * Idade do Coração · Tempo no Alvo · Capacidade · Caminhada guiada ·
 * Como estou agora · Sódio · Qualidade de vida · Aprender · Conquistas.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { toastError } from "@/lib/errorHandler";
import {
  DEMO_CAPACITY_TESTS, DEMO_CHECKINS, DEMO_HEART_AGE, DEMO_QOL,
  DEMO_SODIUM, DEMO_WALK_SESSIONS,
} from "@/lib/demoData";
import {
  calcularIdadeDoCoracao, idadeCoracaoSeAplica, projetarIdadeDoCoracao,
  type ResultadoIdadeCoracao,
} from "@/lib/clinical/heartAge";
import { calcularTempoNoAlvo, serieTempoNoAlvo, responderMedida } from "@/lib/clinical/timeInRange";
import { evolucaoCapacidade, zonaDeTreino, type TesteCapacidade, type TipoTeste } from "@/lib/clinical/capacity";
import { licoesPara, type Licao } from "@/lib/clinical/educacao";
import { conquistasDe } from "@/lib/clinical/conquistas";
import {
  lerSodioDoDia, mediaSemanal, totalDoDia, SODIO_ALVO_PADRAO, type RegistroSodio,
} from "@/lib/clinical/sodio";
import { idadeEmAnos } from "@/lib/clinical/scores";
import { useCardioPatient, useTargets } from "./useCardioPatient";
import {
  buscarSerie, medirCobertura, resolverJanela,
  useActivity, useBloodPressure, useHeartRate, useSleep, useSpo2, useWeight,
  type Cobertura, type OpcoesSerie,
} from "./useCardioReadings";
import { useCardioMedications } from "./useCardioMedications";
import { useCardioExams, useLabResults } from "./useCardioClinical";
import type { HeartAgeSnapshot, QolResponse, WalkSession, WellbeingCheckin } from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

const chave = (nome: string, uid?: string) => [nome, uid ?? "demo"] as const;

/**
 * O mesmo problema de useCardioReadings valia aqui: `.limit(200)` sem filtro
 * de data. Caminhadas, check-ins e sódio são vários registros por dia — a
 * "média da semana" e o "total do dia" saíam de uma amostra que já tinha sido
 * cortada no servidor, sem aviso.
 *
 * A infraestrutura de janela/cobertura mora em useCardioReadings porque é a
 * mesma regra; duplicá-la aqui só criaria duas versões para divergirem.
 */
function useTabela<T>(
  tabela: string,
  nomeChave: string,
  demo: T[],
  ordem: string,
  patientUserId?: string,
  opcoes?: OpcoesSerie
) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demoAtivo = !!getDevBypass();

  const janela = resolverJanela(opcoes);

  const query = useQuery({
    // A janela entra na chave para que dois períodos diferentes não
    // compartilhem o mesmo cache.
    queryKey: [...chave(nomeChave, uid), janela.desde, janela.ate, janela.limite],
    enabled: !!uid || demoAtivo,
    staleTime: 60_000,
    queryFn: async (): Promise<{ linhas: T[]; cobertura: Cobertura }> => {
      if (demoAtivo) {
        return { linhas: demo, cobertura: medirCobertura(demo, ordem, janela, false) };
      }
      const { linhas, truncado } = await buscarSerie<T>(tabela, ordem, uid!, janela);
      return { linhas, cobertura: medirCobertura(linhas, ordem, janela, truncado) };
    },
  });

  const linhas = query.data?.linhas ?? [];
  const cobertura: Cobertura = query.data?.cobertura ?? {
    linhas: 0, desde: janela.desde, ate: janela.ate,
    cobreDe: null, cobreAte: null, truncado: false, limite: janela.limite,
  };

  return { data: linhas, cobertura, isLoading: query.isLoading, uid, demoAtivo };
}

// ── Idade do Coração ─────────────────────────────────────────────────

export interface DadosIdadeCoracao {
  resultado: ResultadoIdadeCoracao | null;
  aplicavel: boolean;
  motivo?: string;
  /** O que falta para calcular, quando faltar. */
  faltando: string[];
  historico: HeartAgeSnapshot[];
  /** Cenário: pressão no alvo (e sem cigarro, se for o caso). */
  projecao: number | null;
  isLoading: boolean;
  /** Quantas medidas de pressão entraram, que período cobrem e se truncou. */
  cobertura: Cobertura;
}

export function useIdadeDoCoracao(patientUserId?: string, opcoes?: OpcoesSerie): DadosIdadeCoracao {
  const { data: patient, isLoading: carregandoPaciente } = useCardioPatient(patientUserId);
  const { targets } = useTargets(patientUserId);
  const { ultimoPorMarcador } = useLabResults(patientUserId);
  const bp = useBloodPressure(patientUserId, opcoes);
  const historicoQuery = useTabela<HeartAgeSnapshot>(
    "heart_age_snapshots", "heartAge", DEMO_HEART_AGE, "calculado_em", patientUserId, opcoes
  );

  const elegibilidade = idadeCoracaoSeAplica(patient ?? null);

  const { resultado, faltando, projecao } = useMemo(() => {
    const faltas: string[] = [];
    if (!elegibilidade.aplicavel || !patient) return { resultado: null, faltando: faltas, projecao: null };

    const idade = idadeEmAnos(patient.birth_date);
    const ct = ultimoPorMarcador.get("total_cholesterol")?.value_num ?? null;
    const hdl = ultimoPorMarcador.get("hdl")?.value_num ?? null;

    // Pressão: usa a média recente de manguito validado, não uma medida solta.
    const validas = bp.readings.filter((r) => r.cuff_validated && r.validation_status === "validated");
    const sistolica = validas.length > 0
      ? Math.round(validas.slice(0, 10).reduce((s, r) => s + r.systolic, 0) / Math.min(10, validas.length))
      : null;

    if (ct == null) faltas.push("colesterol total");
    if (hdl == null) faltas.push("HDL");
    if (sistolica == null) faltas.push("uma medida de pressão com aparelho de braço");
    if (idade == null) faltas.push("data de nascimento");
    if (faltas.length > 0 || idade == null || ct == null || hdl == null || sistolica == null) {
      return { resultado: null, faltando: faltas, projecao: null };
    }

    const entrada = {
      idade,
      sexo: patient.sex as "male" | "female",
      colesterolTotal: ct,
      hdl,
      sistolica,
      emTratamentoPressao: true,
      fumante: patient.smoking_status === "current",
      diabetes: !!patient.comorbidities?.diabetes,
    };

    return {
      resultado: calcularIdadeDoCoracao(entrada),
      faltando: [],
      projecao: projetarIdadeDoCoracao(entrada, {
        sistolicaAlvo: targets.bp_systolic_max,
        pararDeFumar: entrada.fumante,
      }),
    };
  }, [patient, elegibilidade.aplicavel, ultimoPorMarcador, bp.readings, targets.bp_systolic_max]);

  return {
    resultado,
    aplicavel: elegibilidade.aplicavel,
    motivo: elegibilidade.motivo,
    faltando,
    historico: historicoQuery.data,
    projecao,
    isLoading: carregandoPaciente || bp.isLoading,
    /** Cobertura da série de pressão que alimentou o cálculo. */
    cobertura: bp.cobertura,
  };
}

// ── Tempo no Alvo ────────────────────────────────────────────────────

export function useTempoNoAlvo(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { targets } = useTargets(patientUserId);
  const bp = useBloodPressure(patientUserId, opcoes);

  return useMemo(() => {
    const mes = calcularTempoNoAlvo(bp.readings, targets, 30);
    const semana = calcularTempoNoAlvo(bp.readings, targets, 7);
    const serie = serieTempoNoAlvo(bp.readings, targets, 12);
    return {
      mes,
      semana,
      serie,
      isLoading: bp.isLoading,
      // Este era o cálculo mais exposto ao corte de 200 linhas: "tempo no
      // alvo dos últimos 30 dias" sobre uma amostra de poucos dias. Agora a
      // cobertura viaja junto e a tela pode qualificar o número.
      cobertura: bp.cobertura,
      /** Resposta imediata a uma medida nova (regra da reciprocidade). */
      responder: (nova: { systolic: number; diastolic: number }) => responderMedida(nova, bp.readings, targets),
    };
  }, [bp.readings, bp.isLoading, bp.cobertura, targets]);
}

// ── Capacidade ───────────────────────────────────────────────────────

export function useCapacidade(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const r = useTabela<TesteCapacidade>("capacity_tests", "capacity", DEMO_CAPACITY_TESTS, "realizado_em", patientUserId, opcoes);

  const registrar = useMutation({
    mutationFn: async (input: {
      tipo: TipoTeste; valor: number; borg?: number | null;
      fc_pico?: number | null; fc_final?: number | null;
      interrompido?: boolean; motivo_interrupcao?: string | null; observacao?: string | null;
    }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("capacity_tests")
        .insert({ patient_user_id: user!.id, ...input });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["capacity"] });
      toast.success("Teste registrado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar o teste."),
  });

  const evolucao = useMemo(
    () => ({
      caminhada: evolucaoCapacidade(r.data, "walk_6min"),
      sentarLevantar: evolucaoCapacidade(r.data, "sit_to_stand_30s"),
      recuperacao: evolucaoCapacidade(r.data, "hr_recovery"),
    }),
    [r.data]
  );

  return { testes: r.data, evolucao, cobertura: r.cobertura, isLoading: r.isLoading, registrar };
}

// ── Caminhada guiada ─────────────────────────────────────────────────

export function useCaminhadas(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const { targets } = useTargets(patientUserId);
  const r = useTabela<WalkSession>("walk_sessions", "walks", DEMO_WALK_SESSIONS, "iniciada_em", patientUserId, opcoes);

  const zona = useMemo(() => zonaDeTreino(targets), [targets]);

  const salvar = useMutation({
    mutationFn: async (input: Partial<WalkSession>) => {
      if (demo) { toast.info("Modo demo: a sessão não é salva."); return; }
      const { data, error } = await (supabase as any).from("walk_sessions").insert({
        patient_user_id: user!.id,
        zona_min: zona.min,
        zona_max: zona.max,
        ...input,
      }).select("id");
      if (error) throw error;
      // Mesma regra do resto do arquivo: zero linha sem erro é negativa de
      // RLS, e uma caminhada "registrada" que não existe é uma pendência que
      // volta amanhã sem explicação.
      if (!data || data.length === 0) throw new Error("A caminhada não foi gravada. Tente de novo.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["walks"] });
      toast.success("Caminhada registrada.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar a caminhada."),
  });

  const daSemana = r.data.filter((s) => Date.now() - +new Date(s.iniciada_em) <= 7 * 86_400_000);
  const minutosSemana = Math.round(daSemana.reduce((s, x) => s + x.duracao_segundos, 0) / 60);

  return { sessoes: r.data, zona, daSemana, minutosSemana, cobertura: r.cobertura, isLoading: r.isLoading, salvar };
}

// ── Como estou agora ─────────────────────────────────────────────────

export function useCheckins(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const r = useTabela<WellbeingCheckin>("wellbeing_checkins", "checkins", DEMO_CHECKINS, "ocorrido_em", patientUserId, opcoes);

  const registrar = useMutation({
    mutationFn: async (input: {
      desfecho: WellbeingCheckin["desfecho"];
      alarmes: string[];
      como_se_sente?: number | null;
      espelho?: Record<string, unknown>;
      observacao?: string | null;
    }) => {
      if (demo) return;
      const { error } = await (supabase as any)
        .from("wellbeing_checkins")
        .insert({ patient_user_id: user!.id, ...input, espelho: input.espelho ?? {} });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkins"] }),
    // Falha ao gravar não pode travar a tela: o conteúdo (inclusive a rota de
    // emergência) já foi mostrado ao paciente.
    onError: () => undefined,
  });

  return { checkins: r.data, cobertura: r.cobertura, isLoading: r.isLoading, registrar };
}

/** Contexto pronto para `avaliarComoEstou`. */
export function useContextoComoEstou(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { targets } = useTargets(patientUserId);
  const bp = useBloodPressure(patientUserId, opcoes);
  const hr = useHeartRate(patientUserId, opcoes);
  const weight = useWeight(patientUserId, opcoes);
  const spo2 = useSpo2(patientUserId, opcoes);
  const sleep = useSleep(patientUserId, opcoes);

  return useMemo(
    () => ({
      targets,
      bloodPressure: bp.readings,
      heartRate: hr.readings,
      weight: weight.readings,
      spo2: spo2.readings,
      sleep: sleep.records,
      agora: new Date(),
      /** Cobertura por série — `truncado` em qualquer uma qualifica o resto. */
      cobertura: {
        bloodPressure: bp.cobertura,
        heartRate: hr.cobertura,
        weight: weight.cobertura,
        spo2: spo2.cobertura,
        sleep: sleep.cobertura,
      },
    }),
    [
      targets, bp.readings, hr.readings, weight.readings, spo2.readings, sleep.records,
      bp.cobertura, hr.cobertura, weight.cobertura, spo2.cobertura, sleep.cobertura,
    ]
  );
}

// ── Sódio ────────────────────────────────────────────────────────────

export function useSodio(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const { targets } = useTargets(patientUserId);
  // `dia` é coluna `date` — o filtro de intervalo é recortado para AAAA-MM-DD
  // dentro de `buscarSerie`.
  const r = useTabela<RegistroSodio>("sodium_entries", "sodio", DEMO_SODIUM, "dia", patientUserId, opcoes);

  const hoje = new Date().toISOString().slice(0, 10);
  const alvo = targets.sodium_mg_day ?? SODIO_ALVO_PADRAO;

  const registrar = useMutation({
    mutationFn: async (input: { dia: string; refeicao: string; opcao: string; sodio_mg: number }) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { data, error } = await (supabase as any)
        .from("sodium_entries")
        .upsert({ patient_user_id: user!.id, ...input }, { onConflict: "patient_user_id,dia,refeicao" })
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("O registro de sal não foi gravado. Tente de novo.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sodio"] }),
    onError: (e: unknown) => toastError(e, "Não consegui salvar."),
  });

  const totalHoje = totalDoDia(r.data, hoje);

  return {
    registros: r.data,
    hoje,
    alvo,
    leitura: lerSodioDoDia(totalHoje, alvo),
    mediaSemana: mediaSemanal(r.data, 7),
    cobertura: r.cobertura,
    isLoading: r.isLoading,
    registrar,
  };
}

// ── Qualidade de vida ────────────────────────────────────────────────

/**
 * Questionário curto mensal, derivado do KCCQ e simplificado para leitura de
 * paciente. Score 0–100: quanto maior, melhor.
 */
export const PERGUNTAS_QOL = [
  { chave: "subir_escada", texto: "Nas últimas duas semanas, subir um lance de escada te deixou sem fôlego?" },
  { chave: "caminhar", texto: "Caminhar alguns quarteirões no plano te deixou sem fôlego?" },
  { chave: "tarefas_casa", texto: "Tarefas de casa (arrumar, varrer, carregar compras) ficaram difíceis?" },
  { chave: "inchaço", texto: "Você notou os pés ou as pernas inchados?" },
  { chave: "cansaco", texto: "Você se sentiu cansado sem ter feito muito esforço?" },
  { chave: "sono", texto: "Você precisou dormir sentado ou com mais travesseiros por causa da falta de ar?" },
  { chave: "animo", texto: "O problema do coração atrapalhou o que você gosta de fazer?" },
] as const;

/** Cada resposta vai de 0 (o tempo todo) a 4 (nunca). */
export const OPCOES_QOL = [
  { valor: 0, rotulo: "O tempo todo" },
  { valor: 1, rotulo: "Quase sempre" },
  { valor: 2, rotulo: "Às vezes" },
  { valor: 3, rotulo: "Raramente" },
  { valor: 4, rotulo: "Nunca" },
] as const;

export function calcularScoreQol(respostas: Record<string, number>): number {
  const valores = PERGUNTAS_QOL.map((p) => respostas[p.chave]).filter((v) => typeof v === "number");
  if (valores.length === 0) return 0;
  const soma = valores.reduce((a, b) => a + b, 0);
  return Math.round((soma / (valores.length * 4)) * 100);
}

export function useQualidadeDeVida(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const r = useTabela<QolResponse>("qol_responses", "qol", DEMO_QOL, "respondido_em", patientUserId, opcoes);

  const responder = useMutation({
    mutationFn: async (respostas: Record<string, number>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { data, error } = await (supabase as any).from("qol_responses").insert({
        patient_user_id: user!.id,
        score: calcularScoreQol(respostas),
        respostas,
      }).select("id");
      if (error) throw error;
      // Zero linha com `error: null` é o desfecho normal de uma negativa de
      // RLS. Sem o `.select()`, o app agradecia pelas respostas que o banco
      // tinha recusado — e o paciente só descobriria no mês seguinte, quando
      // fosse perguntado de novo.
      if (!data || data.length === 0) {
        throw new Error("As respostas não foram gravadas. Tente de novo daqui a pouco.");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qol"] });
      // A frase deixou de terminar no médico: o resultado volta para quem
      // respondeu, em "Meu mês".
      toast.success("Obrigado. Seu resultado aparece em Meu mês, e seu médico também vê.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar as respostas."),
  });

  const ultima = r.data[0] ?? null;
  const anterior = r.data[1] ?? null;
  const diasDesdeUltima = ultima ? Math.floor((Date.now() - +new Date(ultima.respondido_em)) / 86_400_000) : null;

  return {
    respostas: r.data,
    ultima,
    anterior,
    variacao: ultima && anterior ? ultima.score - anterior.score : null,
    /** Vale reperguntar depois de 30 dias. */
    devePerguntar: diasDesdeUltima == null || diasDesdeUltima >= 30,
    diasDesdeUltima,
    cobertura: r.cobertura,
    isLoading: r.isLoading,
    responder,
  };
}

// ── Aprender ─────────────────────────────────────────────────────────

export function useAprender(patientUserId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const { data: patient } = useCardioPatient(patientUserId);
  const { exams } = useCardioExams(patientUserId);
  const { labs } = useLabResults(patientUserId);
  const { medications } = useCardioMedications(patientUserId);

  const lidas = useQuery({
    queryKey: chave("educacao", user?.id),
    enabled: !!user || demo,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      if (demo) return ["licao-sal"];
      const { data, error } = await (supabase as any)
        .from("education_progress")
        .select("licao_id")
        .eq("patient_user_id", user!.id);
      if (error) throw error;
      return (data ?? []).map((d: { licao_id: string }) => d.licao_id);
    },
  });

  const licoes: Licao[] = useMemo(
    () => licoesPara({ patient: patient ?? null, exams, labs, medications }),
    [patient, exams, labs, medications]
  );

  const marcarLida = useMutation({
    mutationFn: async ({ licaoId, util }: { licaoId: string; util?: boolean }) => {
      if (demo) return;
      const { error } = await (supabase as any)
        .from("education_progress")
        .upsert({ patient_user_id: user!.id, licao_id: licaoId, util: util ?? null }, { onConflict: "patient_user_id,licao_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["educacao"] }),
    onError: () => undefined,
  });

  const jaLidas = new Set(lidas.data ?? []);
  const naoLidas = licoes.filter((l) => !jaLidas.has(l.id));

  return {
    licoes,
    naoLidas,
    /** A próxima lição a mostrar na home. */
    proxima: naoLidas[0] ?? null,
    jaLidas,
    isLoading: lidas.isLoading,
    marcarLida,
  };
}

// ── Conquistas ───────────────────────────────────────────────────────

export function useConquistas(patientUserId?: string, opcoes?: OpcoesSerie) {
  const { intakes } = useCardioMedications(patientUserId);
  const bp = useBloodPressure(patientUserId, opcoes);
  const activity = useActivity(patientUserId, opcoes);
  const weight = useWeight(patientUserId, opcoes);
  const { targets } = useTargets(patientUserId);
  const tempoNoAlvo = useTempoNoAlvo(patientUserId, opcoes);

  return useMemo(
    () =>
      conquistasDe({
        intakes,
        bloodPressure: bp.readings,
        activity: activity.records,
        weight: weight.readings,
        passosMeta: targets.steps_per_day,
        tempoNoAlvo: tempoNoAlvo.mes.percentual,
      }),
    [intakes, bp.readings, activity.records, weight.readings, targets.steps_per_day, tempoNoAlvo.mes.percentual]
  );
}
