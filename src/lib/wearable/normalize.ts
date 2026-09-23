/**
 * Converte o que vem do dispositivo (BLE ou importação) em leituras clínicas
 * com proveniência completa.
 *
 * Este é o único lugar onde um dado de pulseira vira registro clínico — e é
 * por isso que a marcação de "estimativa" é aplicada aqui, uma vez, em vez de
 * ficar espalhada por telas.
 *
 * ── A regra de validação, corrigida ────────────────────────────────────
 *
 * A coluna `validation_status` tem DEFAULT 'validated' no banco (ver
 * `supabase/migrations/…_cardio_baseline.sql`). Isso significa que omitir o
 * campo não é neutro: é afirmar que o dado foi validado. E até aqui o
 * normalizador estava carimbando `'validated'` em FC, SpO₂, sono e passos sem
 * nenhuma comprovação do aparelho.
 *
 * O aparelho tem exatamente dois sensores — um PPG óptico e um acelerômetro
 * (docs §4.1). Nada que sai deles tem validação clínica. Então a regra passa a
 * ser, sem exceção:
 *
 *   PPG ou acelerômetro           → 'estimated'
 *   digitado pelo paciente/médico → 'validated'  (fora deste arquivo)
 *   manguito validado             → 'validated'  (fora deste arquivo)
 *
 * `'estimated'` não é um detalhe cosmético: `podeDispararAlerta()` e a média de
 * MRPA olham para ele. Marcar errado para baixo custa um alerta perdido;
 * marcar errado para cima faz o motor clínico decidir em cima de PPG — que é o
 * risco regulatório do §6. Preferimos o primeiro erro.
 */

import type {
  BloodPressureReading,
  HeartRateReading,
  Spo2Reading,
  ActivityReading,
  SleepReading,
} from "@/types/cardio";
import type { WearableSample } from "./bleClient";
import type { LinhaImportada } from "./importer";

export interface DeviceContext {
  patientUserId: string;
  deviceId?: string | null;
  deviceName: string;
}

type Novo<T> = Omit<T, "id" | "created_at">;

/**
 * Linha de `hr_readings`. A tabela guarda rmssd/sdnn nas MESMAS colunas da
 * frequência — não existe tabela `hrv_readings`. Por isso a HRV viaja junto da
 * batida em vez de virar um registro separado que nunca teria onde ser gravado.
 */
export type NovaLeituraFc = Novo<HeartRateReading> & {
  rmssd: number | null;
  sdnn: number | null;
};

const base = (ctx: DeviceContext, at: string, sourceType: "device" | "import") => ({
  patient_user_id: ctx.patientUserId,
  recorded_at: at,
  source_type: sourceType,
  source_device_id: ctx.deviceId ?? null,
  source_device_name: ctx.deviceName,
  entered_by: "device" as const,
  entered_by_user_id: null,
});

/** Nota que acompanha toda PA de pulseira. Texto de médico, não de paciente. */
export const NOTA_PA_ESTIMADA =
  "Estimativa por sensor óptico de pulso — sem manguito, sem validação clínica. Não usar para decisão terapêutica nem para média de MRPA.";

/**
 * Amostra ao vivo do Bluetooth → linha de `hr_readings`.
 *
 * `contactDetected === false` significa que o próprio sensor avisou que o pulso
 * saiu da pele: aí a leitura é 'suspect', que é pior que 'estimated' e some das
 * médias. Com contato, continua sendo PPG: 'estimated'.
 */
export function amostraParaLeituras(
  s: WearableSample,
  ctx: DeviceContext
): { heartRate: NovaLeituraFc } {
  const heartRate: NovaLeituraFc = {
    ...base(ctx, s.at, "device"),
    vital_type: "heart_rate",
    bpm: Math.round(s.bpm),
    context: "resting",
    irregular_flag: null,
    rmssd: s.rmssd,
    sdnn: s.sdnn,
    validation_status: s.contactDetected === false ? "suspect" : "estimated",
  };

  return { heartRate };
}

export interface LeiturasImportadas {
  heartRate: NovaLeituraFc[];
  spo2: Novo<Spo2Reading>[];
  bloodPressure: Novo<BloodPressureReading>[];
  activity: Novo<ActivityReading>[];
  sleep: Novo<SleepReading>[];
}

/**
 * Linhas do arquivo → leituras dos cinco domínios.
 *
 * Cada tipo preserva o `recorded_at` da própria linha (inclusive a SpO₂, que
 * antes perdia o horário e caía no `now()` do banco — o médico via toda a
 * oxigenação importada empilhada no minuto da importação).
 *
 * `sleep_records` e `activity_records` também têm `recorded_at` além da data do
 * dia; preenchemos os dois: a data é a chave natural, o timestamp é a
 * rastreabilidade.
 */
export function linhasParaLeituras(
  linhas: LinhaImportada[],
  ctx: DeviceContext
): LeiturasImportadas {
  const out: LeiturasImportadas = { heartRate: [], spo2: [], bloodPressure: [], activity: [], sleep: [] };

  for (const l of linhas) {
    const b = base(ctx, l.recordedAt, "import");
    const dia = l.recordedAt.slice(0, 10);

    if (l.heartRate != null) {
      out.heartRate.push({
        ...b, vital_type: "heart_rate", bpm: l.heartRate,
        context: "resting", irregular_flag: null,
        rmssd: null, sdnn: null,
        validation_status: "estimated",
      });
    }
    if (l.spo2 != null) {
      out.spo2.push({
        ...b, vital_type: "spo2", value: l.spo2, context: "spot",
        time_below_90_pct: null,
        validation_status: "estimated",
      });
    }
    if (l.systolic != null && l.diastolic != null) {
      out.bloodPressure.push({
        ...b,
        vital_type: "blood_pressure",
        systolic: l.systolic,
        diastolic: l.diastolic,
        pulse: l.heartRate ?? null,
        context: "random",
        position: null,
        arm: null,
        // Os dois campos andam juntos, sempre. `cuff_validated: false` sozinho
        // não bastava: o DEFAULT da coluna de validação é 'validated', então a
        // PA de pulseira entrava no banco como validada e podia disparar alerta.
        cuff_validated: false,
        validation_status: "estimated",
        validation_note: NOTA_PA_ESTIMADA,
      });
    }
    if (l.steps != null || l.calories != null) {
      out.activity.push({
        ...b, vital_type: "steps", activity_date: dia,
        steps: l.steps ?? null, calories: l.calories ?? null,
        distance_km: null, moderate_minutes: null, vigorous_minutes: null,
        avg_heart_rate: l.heartRate ?? null, max_heart_rate: null,
        // Acelerômetro: contagem aproximada, calorias mais aproximada ainda.
        validation_status: "estimated",
      });
    }
    if (l.sleepMinutes != null) {
      out.sleep.push({
        ...b, vital_type: "sleep", sleep_date: dia,
        total_minutes: l.sleepMinutes,
        deep_minutes: l.deepMinutes ?? null,
        light_minutes: l.lightMinutes ?? null,
        rem_minutes: l.remMinutes ?? null,
        awake_minutes: l.awakeMinutes ?? null,
        awakenings: l.awakenings ?? null,
        efficiency_pct: l.efficiencyPct ?? null,
        min_heart_rate: l.minHeartRate ?? null,
        min_spo2: l.minSpo2 ?? null,
        // Actigrafia por movimento, não polissonografia (docs §4.2).
        validation_status: "estimated",
      });
    }
  }

  return out;
}

/** Colunas de sono que podem nascer vazias e ser preenchidas depois, sem apagar o que já foi gravado. */
export const CAMPOS_COMPLETAR_SONO = [
  "deep_minutes", "light_minutes", "rem_minutes", "awake_minutes",
  "awakenings", "efficiency_pct", "min_heart_rate", "min_spo2",
] as const;

export type CampoCompletarSono = (typeof CAMPOS_COMPLETAR_SONO)[number];

export interface NoiteGravada {
  id: string;
  sleep_date: string;
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  awakenings: number | null;
  efficiency_pct: number | null;
  min_heart_rate: number | null;
  min_spo2: number | null;
}

export interface DecisaoSono<T> {
  inserir: T[];
  completar: { id: string; patch: Partial<Record<CampoCompletarSono, number>>; linhas: number }[];
  /** Linhas que só preencheram uma noite nova, antes do insert. */
  mescladasNoInsert: number;
  ignoradas: number;
}

/**
 * Uma linha por `(paciente, sleep_date)`. Noite nova insere. Noite já gravada
 * só ganha coluna que está null e a linha nova traz.
 */
export function decidirGravacaoSono<T extends { sleep_date: string } & Partial<Record<CampoCompletarSono, number | null>>>(
  linhas: T[],
  existentes: NoiteGravada[],
): DecisaoSono<T> {
  const porData = new Map<string, NoiteGravada>();
  for (const e of existentes) porData.set(String(e.sleep_date).slice(0, 10), e);

  const pendente = new Map<string, T>();
  const inserir: T[] = [];
  const patchPorId = new Map<string, { patch: Partial<Record<CampoCompletarSono, number>>; linhas: number }>();
  let mescladasNoInsert = 0;
  let ignoradas = 0;

  const valorAtual = (dia: string, campo: CampoCompletarSono): number | null => {
    const ins = pendente.get(dia);
    if (ins) return ins[campo] ?? null;
    const ex = porData.get(dia);
    if (!ex) return null;
    const acc = patchPorId.get(ex.id);
    if (acc && acc.patch[campo] != null) return acc.patch[campo] ?? null;
    return ex[campo] ?? null;
  };

  for (const linha of linhas) {
    const dia = String(linha.sleep_date).slice(0, 10);
    const ex = porData.get(dia);
    const ins = pendente.get(dia);

    if (!ex && !ins) {
      const copia = { ...linha };
      pendente.set(dia, copia);
      inserir.push(copia);
      continue;
    }

    let preencheu = false;
    for (const campo of CAMPOS_COMPLETAR_SONO) {
      const novo = linha[campo];
      if (novo == null) continue;
      if (valorAtual(dia, campo) != null) continue;
      preencheu = true;
      if (ins) ins[campo] = novo;
      else if (ex) {
        const acc = patchPorId.get(ex.id) ?? { patch: {}, linhas: 0 };
        acc.patch[campo] = novo;
        patchPorId.set(ex.id, acc);
      }
    }
    if (!preencheu) ignoradas++;
    else if (ins) mescladasNoInsert++;
    else if (ex) {
      const acc = patchPorId.get(ex.id);
      if (acc) acc.linhas++;
    }
  }

  return {
    inserir,
    completar: [...patchPorId.entries()].map(([id, acc]) => ({ id, patch: acc.patch, linhas: acc.linhas })),
    mescladasNoInsert,
    ignoradas,
  };
}

export function noiteDePacote(
  noite: {
    sleepDate: string;
    recordedAt: string;
    campos: { total_minutes: number } & Partial<Record<CampoCompletarSono, number>>;
  },
  ctx: DeviceContext,
): Novo<SleepReading> {
  return {
    ...base(ctx, noite.recordedAt, "device"),
    vital_type: "sleep",
    sleep_date: noite.sleepDate,
    total_minutes: noite.campos.total_minutes,
    deep_minutes: noite.campos.deep_minutes ?? null,
    light_minutes: noite.campos.light_minutes ?? null,
    rem_minutes: noite.campos.rem_minutes ?? null,
    awake_minutes: noite.campos.awake_minutes ?? null,
    awakenings: noite.campos.awakenings ?? null,
    efficiency_pct: noite.campos.efficiency_pct ?? null,
    min_heart_rate: noite.campos.min_heart_rate ?? null,
    min_spo2: noite.campos.min_spo2 ?? null,
    validation_status: "estimated",
  };
}

/** Rótulo curto de proveniência, usado nos badges das telas. */
export function rotuloProveniencia(
  sourceType: string,
  validation: string,
  deviceName?: string | null
): { label: string; tone: "neutral" | "warning" } {
  if (validation === "estimated") {
    return { label: `Estimativa · ${deviceName ?? "pulseira"}`, tone: "warning" };
  }
  if (sourceType === "device") return { label: deviceName ?? "Dispositivo", tone: "neutral" };
  if (sourceType === "import") return { label: "Importado", tone: "neutral" };
  if (sourceType === "lab") return { label: "Laboratório", tone: "neutral" };
  if (sourceType === "manual") return { label: "Registro manual", tone: "neutral" };
  return { label: "Sistema", tone: "neutral" };
}
