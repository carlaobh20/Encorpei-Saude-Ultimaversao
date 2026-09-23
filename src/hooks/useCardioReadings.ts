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
import { limitesSono } from "@/lib/janelaSono";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ══════════════════════════════════════════════════════════════════════════
 * Intervalo, cobertura e truncamento
 * ══════════════════════════════════════════════════════════════════════════
 *
 * O problema que isto resolve
 * ---------------------------
 * A consulta genérica pegava as ~200 linhas mais recentes, sem filtro de
 * data. Com sinal de alta frequência — a FC vinda de pulseira grava várias
 * medidas por hora — 200 linhas cobrem POUCOS DIAS. Qualquer coisa que
 * calcule "os últimos 30 dias" ou "os últimos 90 dias" em cima disso (tempo
 * no alvo, idade do coração, conquistas, adesão) devolvia um número que
 * parecia certo e estava errado, sem nenhum aviso — nem na tela, nem no
 * console.
 *
 * A correção
 * ----------
 *   · a consulta passa a receber um INTERVALO (`desde`/`ate`) e a filtrar por
 *     data NO SERVIDOR — o recorte é do período pedido, não das N últimas;
 *   · quando o intervalo tem mais linhas que o teto, pagina com `range()`;
 *   · e toda série volta com `cobertura`: quantas linhas vieram, o período
 *     realmente coberto e `truncado: boolean`.
 *
 * O mínimo inegociável é o `truncado`. Uma média de 90 dias calculada sobre 6
 * dias de dado pode até ser aceitável para desenhar um gráfico; o que não é
 * aceitável é ela se apresentar como uma média de 90 dias.
 */

/** Janela padrão. Mantém o comportamento historicamente assumido pelas telas. */
export const JANELA_PADRAO_DIAS = 90;

/** Teto por consulta. Alto o suficiente para 90 dias de pulseira; não infinito. */
export const TETO_PADRAO_LINHAS = 5000;

/** Página do PostgREST: acima de 1000 linhas ele corta sozinho. */
const PAGINA = 1000;

export interface OpcoesSerie {
  /** Início do intervalo (ISO). Padrão: hoje − JANELA_PADRAO_DIAS. */
  desde?: string | Date;
  /** Fim do intervalo (ISO). Padrão: agora. */
  ate?: string | Date;
  /** Teto de linhas. Estourá-lo liga `truncado`, nunca corta em silêncio. */
  limite?: number;
}

export interface Cobertura {
  /** Quantas linhas realmente vieram. */
  linhas: number;
  /** Intervalo PEDIDO (ISO). */
  desde: string;
  ate: string;
  /** Intervalo EFETIVAMENTE coberto pelos dados (ISO), ou null se vazio. */
  cobreDe: string | null;
  cobreAte: string | null;
  /**
   * `true` quando o intervalo tinha mais linhas que o teto. Enquanto isso for
   * true, qualquer resumo do período está incompleto — e a tela pode dizer.
   */
  truncado: boolean;
  limite: number;
}

const COBERTURA_VAZIA = (desde: string, ate: string, limite: number): Cobertura => ({
  linhas: 0, desde, ate, cobreDe: null, cobreAte: null, truncado: false, limite,
});

/**
 * Colunas `date` (sleep_date, activity_date, dia) comparam com 'AAAA-MM-DD';
 * colunas `timestamptz` comparam com o ISO completo. Mandar o ISO cheio para
 * uma coluna `date` faz o Postgres truncar — e o limite deixa de ser o pedido.
 */
function limiteParaColuna(coluna: string, iso: string): string {
  const ehDate = coluna === "dia" || coluna.endsWith("_date");
  return ehDate ? iso.slice(0, 10) : iso;
}

function paraIso(v: string | Date | undefined, padrao: Date): string {
  if (!v) return padrao.toISOString();
  return typeof v === "string" ? v : v.toISOString();
}

/**
 * Normaliza as opções para um intervalo concreto.
 *
 * Os limites padrão são ARREDONDADOS PARA O DIA de propósito. A janela entra
 * na queryKey do react-query; se ela carregasse a hora exata, cada render
 * geraria uma chave nova e o hook refetcharia em laço infinito. Arredondado,
 * o padrão é estável ao longo do dia — e uma janela explícita passada por
 * quem chama já é estável por construção.
 */
export function resolverJanela(opcoes?: OpcoesSerie) {
  const agora = new Date();
  const fimDoDia = new Date(agora);
  fimDoDia.setUTCHours(23, 59, 59, 999);
  const inicioPadrao = new Date(fimDoDia.getTime() - JANELA_PADRAO_DIAS * 86_400_000);
  inicioPadrao.setUTCHours(0, 0, 0, 0);

  return {
    desde: paraIso(opcoes?.desde, inicioPadrao),
    ate: paraIso(opcoes?.ate, fimDoDia),
    limite: opcoes?.limite ?? TETO_PADRAO_LINHAS,
  };
}

/** Monta a cobertura a partir das linhas já ordenadas (mais recente primeiro). */
export function medirCobertura<T>(
  linhas: T[],
  coluna: string,
  janela: { desde: string; ate: string; limite: number },
  truncado: boolean,
): Cobertura {
  if (linhas.length === 0) return { ...COBERTURA_VAZIA(janela.desde, janela.ate, janela.limite), truncado };
  const valor = (x: T) => (x as any)?.[coluna] ?? null;
  return {
    linhas: linhas.length,
    desde: janela.desde,
    ate: janela.ate,
    cobreAte: valor(linhas[0]),
    cobreDe: valor(linhas[linhas.length - 1]),
    truncado,
    limite: janela.limite,
  };
}

/**
 * Busca uma série filtrada por intervalo, paginando com `range()`.
 *
 * Pede sempre UMA linha além do teto: se ela vier, sabemos que o intervalo
 * tem mais dado do que carregamos — é assim que `truncado` deixa de ser um
 * palpite. A linha extra é descartada antes de devolver.
 */
export async function buscarSerie<T>(
  tabela: string,
  coluna: string,
  uid: string,
  janela: { desde: string; ate: string; limite: number },
): Promise<{ linhas: T[]; truncado: boolean }> {
  const linhas: T[] = [];
  const teto = janela.limite;
  let inicio = 0;

  for (;;) {
    const restante = teto + 1 - linhas.length;
    if (restante <= 0) break;
    const tamanho = Math.min(PAGINA, restante);

    const { data, error } = await (supabase as any)
      .from(tabela)
      .select("*")
      .eq("patient_user_id", uid)
      .gte(coluna, limiteParaColuna(coluna, janela.desde))
      .lte(coluna, limiteParaColuna(coluna, janela.ate))
      .order(coluna, { ascending: false })
      .range(inicio, inicio + tamanho - 1);
    if (error) throw error;

    const lote = (data ?? []) as T[];
    linhas.push(...lote);
    if (lote.length < tamanho) break;
    inicio += tamanho;
  }

  const truncado = linhas.length > teto;
  return { linhas: truncado ? linhas.slice(0, teto) : linhas, truncado };
}

interface LeituraOpts<T> {
  tabela: string;
  chave: (uid: string) => readonly unknown[];
  demo: T[];
  ordenarPor?: string;
  limite?: number;
}

function useLeituras<T>(
  { tabela, chave, demo, ordenarPor = "recorded_at", limite }: LeituraOpts<T>,
  patientUserId?: string,
  opcoes?: OpcoesSerie
) {
  const { user } = useAuth();
  const uid = patientUserId ?? user?.id;
  const demoAtivo = !!getDevBypass();

  // O teto do call site (ex.: sono/atividade, que são diários) só vale como
  // padrão; quem chama o hook pode ampliar. `?? limite` em vez de espalhar
  // `opcoes` por cima: um `{ limite: undefined }` explícito não pode apagar o
  // padrão da tabela.
  const janela = resolverJanela({
    desde: opcoes?.desde,
    ate: opcoes?.ate,
    limite: opcoes?.limite ?? limite,
  });

  const query = useQuery({
    // A janela entra na chave: sem isso, uma tela pedindo 365 dias leria do
    // cache o resultado de 90 e nem perceberia.
    queryKey: [...chave(uid ?? "demo"), janela.desde, janela.ate, janela.limite],
    enabled: !!uid || demoAtivo,
    staleTime: 60_000,
    queryFn: async (): Promise<{ linhas: T[]; cobertura: Cobertura }> => {
      if (demoAtivo) {
        return { linhas: demo, cobertura: medirCobertura(demo, ordenarPor, janela, false) };
      }
      const { linhas, truncado } = await buscarSerie<T>(tabela, ordenarPor, uid!, janela);
      return { linhas, cobertura: medirCobertura(linhas, ordenarPor, janela, truncado) };
    },
  });

  const linhas = query.data?.linhas ?? [];
  const cobertura = query.data?.cobertura ?? COBERTURA_VAZIA(janela.desde, janela.ate, janela.limite);

  return {
    data: linhas,
    cobertura,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    uid,
    demoAtivo,
  };
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

export function useBloodPressure(patientUserId?: string, opcoes?: OpcoesSerie) {
  const r = useLeituras<BloodPressureReading>(
    { tabela: "bp_readings", chave: queryKeys.bp.de, demo: DEMO_BLOOD_PRESSURE },
    patientUserId,
    opcoes
  );
  const registrar = useRegistrar<NovaPressao>("bp_readings", [queryKeys.bp.all], "Pressão registrada.");

  const ultima = r.data[0] ?? null;
  // `cobertura` vem de `...r`: linhas, período coberto e `truncado`.
  return { ...r, readings: r.data, ultima, registrar };
}

// ── Frequência cardíaca ──────────────────────────────────────────────

export function useHeartRate(patientUserId?: string, opcoes?: OpcoesSerie) {
  // A FC é o caso mais grave do problema antigo: vinda de pulseira, são
  // dezenas de linhas por dia. Com o teto de 200, "os últimos 90 dias" eram
  // na prática os últimos dois ou três.
  const r = useLeituras<HeartRateReading>(
    { tabela: "hr_readings", chave: queryKeys.hr.de, demo: DEMO_HEART_RATE },
    patientUserId,
    opcoes
  );
  const registrar = useRegistrar<{ bpm: number; context?: string; recorded_at?: string }>(
    "hr_readings", [queryKeys.hr.all], "Frequência registrada."
  );
  const repouso = r.data.filter((x) => x.context === "resting");
  return { ...r, readings: r.data, repouso, ultima: r.data[0] ?? null, registrar };
}

// ── Peso ─────────────────────────────────────────────────────────────

export function useWeight(patientUserId?: string, opcoes?: OpcoesSerie) {
  const r = useLeituras<WeightReading>(
    { tabela: "weight_readings", chave: queryKeys.weight.de, demo: DEMO_WEIGHT },
    patientUserId,
    opcoes
  );
  const registrar = useRegistrar<{ value: number; notes?: string | null; recorded_at?: string }>(
    "weight_readings", [queryKeys.weight.all], "Peso registrado."
  );
  return { ...r, readings: r.data, ultimo: r.data[0] ?? null, registrar };
}

// ── Oxigenação ───────────────────────────────────────────────────────

export function useSpo2(patientUserId?: string, opcoes?: OpcoesSerie) {
  const r = useLeituras<Spo2Reading>(
    { tabela: "spo2_readings", chave: queryKeys.spo2.de, demo: DEMO_SPO2 },
    patientUserId,
    opcoes
  );
  const registrar = useRegistrar<{ value: number; context?: string }>(
    "spo2_readings", [queryKeys.spo2.all], "Oxigenação registrada."
  );
  return { ...r, readings: r.data, ultima: r.data[0] ?? null, registrar };
}

// ── Glicemia ─────────────────────────────────────────────────────────

export function useGlucose(patientUserId?: string, opcoes?: OpcoesSerie) {
  const r = useLeituras<GlucoseReading>(
    { tabela: "glucose_readings", chave: queryKeys.glucose.de, demo: [] },
    patientUserId,
    opcoes
  );
  const registrar = useRegistrar<{ value: number; context: string }>(
    "glucose_readings", [queryKeys.glucose.all], "Glicemia registrada."
  );
  return { ...r, readings: r.data, registrar };
}

// ── Sono ─────────────────────────────────────────────────────────────

export function useSleep(patientUserId?: string, opcoes?: OpcoesSerie) {
  // Uma linha por noite. A janela de 90 dias das outras séries escondia
  // noite antiga e a tela caía em "sem dados" com o registro já salvo.
  // O teto de 400 linhas continua; `cobertura.truncado` avisa se estourar.
  const sono = limitesSono();
  const r = useLeituras<SleepReading>(
    { tabela: "sleep_records", chave: queryKeys.sleep.de, demo: DEMO_SLEEP, ordenarPor: "sleep_date", limite: 400 },
    patientUserId,
    { ...opcoes, desde: opcoes?.desde ?? sono.desde, ate: opcoes?.ate ?? sono.ate },
  );
  const mediaMinutos =
    r.data.length > 0 ? Math.round(r.data.slice(0, 7).reduce((s, x) => s + x.total_minutes, 0) / Math.min(7, r.data.length)) : null;
  return { ...r, records: r.data, ultima: r.data[0] ?? null, mediaMinutos };
}

// ── Atividade ────────────────────────────────────────────────────────

export function useActivity(patientUserId?: string, opcoes?: OpcoesSerie) {
  // Idem sono: um registro por dia.
  const r = useLeituras<ActivityReading>(
    { tabela: "activity_records", chave: queryKeys.activity.de, demo: DEMO_ACTIVITY, ordenarPor: "activity_date", limite: 400 },
    patientUserId,
    opcoes
  );
  const ultimos7 = r.data.slice(0, 7);
  const passosMedia =
    ultimos7.length > 0 ? Math.round(ultimos7.reduce((s, x) => s + (x.steps ?? 0), 0) / ultimos7.length) : null;
  const mvpaSemana = ultimos7.reduce((s, x) => s + (x.moderate_minutes ?? 0) + (x.vigorous_minutes ?? 0), 0);
  return { ...r, records: r.data, hoje: r.data[0] ?? null, passosMedia, mvpaSemana };
}
