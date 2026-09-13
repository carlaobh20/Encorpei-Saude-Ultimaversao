/**
 * ══════════════════════════════════════════════════════════════════════
 * MOTOR DE RISCO CARDIOVASCULAR
 * ══════════════════════════════════════════════════════════════════════
 *
 * Entra: leituras + sintomas + adesão + alvos do paciente.
 * Sai: lista de alertas + semáforo para a fila do médico.
 *
 * Função pura: sem rede, sem React, sem Date.now() implícito (a data de
 * referência é parâmetro). É isso que permite testar cada limiar.
 *
 * Substitui o motor de risco obstétrico do app que originou este projeto.
 */

import {
  ALERT_RULES,
  GATILHO,
  SEVERITY_WEIGHT,
  gatilhoDaDor,
  nyhaDoRelato,
  podeDispararAlerta,
} from "./cardioAlertRules";
import type {
  BloodPressureReading,
  CardioTargets,
  HeartRateReading,
  RiskLevel,
  Severity,
  SleepReading,
  Spo2Reading,
  SymptomReport,
  WeightReading,
} from "@/types/cardio";

export interface RiskInput {
  targets: CardioTargets;
  bloodPressure: BloodPressureReading[];
  heartRate: HeartRateReading[];
  weight: WeightReading[];
  spo2: Spo2Reading[];
  sleep: SleepReading[];
  symptoms: SymptomReport[];
  /** 0–1 — proporção de doses marcadas nos últimos 14 dias. */
  adherence14d: number | null;
  /** Paciente tem IC? Muda as regras de peso. */
  heartFailure: boolean;
  /** Data de referência do cálculo. */
  now: Date;
}

export interface EngineAlert {
  code: string;
  severity: Severity;
  title: string;
  patientMessage: string;
  doctorMessage: string;
  triggerValue: string;
  thresholdValue: string;
  occurredAt: string;
}

export interface RiskResult {
  level: RiskLevel;
  score: number;
  alerts: EngineAlert[];
  /** Frase curta para a fila do médico: por que este paciente está aqui. */
  headline: string;
}

const DIA = 24 * 60 * 60 * 1000;

function mk(
  code: string,
  triggerValue: string,
  occurredAt: string,
  thresholdOverride?: string
): EngineAlert {
  const r = ALERT_RULES[code];
  return {
    code,
    severity: r.severity,
    title: r.label,
    patientMessage: r.patientMessage,
    doctorMessage: r.doctorMessage,
    triggerValue,
    thresholdValue: thresholdOverride ?? r.defaultThreshold,
    occurredAt,
  };
}

function dentroDe(iso: string, now: Date, dias: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now.getTime() - t <= dias * DIA;
}

/**
 * Média de MRPA: só entram medidas de manhã/noite feitas com manguito
 * validado. Estimativa de pulseira fica de fora por decisão de produto
 * (docs §4) — e é aqui que essa decisão vira código.
 */
export function mediaMrpa(
  leituras: BloodPressureReading[],
  now: Date,
  dias = 7
): { systolic: number; diastolic: number; n: number } | null {
  const validas = leituras.filter(
    (r) =>
      r.cuff_validated &&
      r.validation_status === "validated" &&
      (r.context === "morning" || r.context === "evening") &&
      dentroDe(r.recorded_at, now, dias)
  );
  if (validas.length < 2) return null;
  const s = validas.reduce((a, r) => a + r.systolic, 0) / validas.length;
  const d = validas.reduce((a, r) => a + r.diastolic, 0) / validas.length;
  return { systolic: Math.round(s), diastolic: Math.round(d), n: validas.length };
}

export function avaliarRisco(input: RiskInput): RiskResult {
  const { targets, now } = input;
  const alerts: EngineAlert[] = [];

  // ── Pressão arterial ───────────────────────────────────────────────
  const paValidas = input.bloodPressure.filter(
    (r) => podeDispararAlerta(r.validation_status) && r.cuff_validated
  );

  for (const r of paValidas) {
    if (!dentroDe(r.recorded_at, now, 7)) continue;
    if (r.systolic >= 180 || r.diastolic >= 110) {
      alerts.push(mk("pa_crise", `${r.systolic}/${r.diastolic} mmHg`, r.recorded_at));
    } else if (r.systolic < 90) {
      alerts.push(mk("pa_baixa", `${r.systolic}/${r.diastolic} mmHg`, r.recorded_at));
    }
  }

  const acimaDoAlvo = paValidas.filter(
    (r) =>
      dentroDe(r.recorded_at, now, 7) &&
      (r.systolic > targets.bp_systolic_max || r.diastolic > targets.bp_diastolic_max)
  );
  if (acimaDoAlvo.length >= 3 && !alerts.some((a) => a.code === "pa_crise")) {
    alerts.push(
      mk(
        "pa_alta_sustentada",
        `${acimaDoAlvo.length} medidas acima de ${targets.bp_systolic_max}/${targets.bp_diastolic_max}`,
        acimaDoAlvo[0].recorded_at,
        `3 medidas > ${targets.bp_systolic_max}/${targets.bp_diastolic_max} mmHg em 7 dias`
      )
    );
  }

  // ── Frequência cardíaca ────────────────────────────────────────────
  const fcRepouso = input.heartRate.filter(
    (r) => r.context === "resting" && dentroDe(r.recorded_at, now, 3)
  );
  const taqui = fcRepouso.filter((r) => r.bpm > 100);
  if (taqui.length >= 2) {
    alerts.push(mk("fc_taqui_repouso", `${taqui[0].bpm} bpm`, taqui[0].recorded_at));
  }
  const bradi = fcRepouso.find((r) => r.bpm < 45 || r.bpm < targets.resting_hr_min - 10);
  if (bradi) {
    alerts.push(mk("fc_bradi", `${bradi.bpm} bpm`, bradi.recorded_at, `< ${Math.min(45, targets.resting_hr_min)} bpm`));
  }
  const irregulares = input.heartRate.filter((r) => r.irregular_flag && dentroDe(r.recorded_at, now, 7));
  if (irregulares.length >= 3) {
    alerts.push(mk("ritmo_irregular", `${irregulares.length} episódios em 7 dias`, irregulares[0].recorded_at));
  }

  // ── Peso (regras de IC) ────────────────────────────────────────────
  const pesos = [...input.weight]
    .filter((r) => dentroDe(r.recorded_at, now, 8))
    .sort((a, b) => +new Date(b.recorded_at) - +new Date(a.recorded_at));

  if (input.heartFailure && pesos.length >= 2) {
    const atual = pesos[0];
    const ontem = pesos.find((r) => dentroDe(r.recorded_at, new Date(+new Date(atual.recorded_at)), 2) && r.id !== atual.id);
    if (ontem && atual.value - ontem.value > 1.5) {
      alerts.push(mk("peso_ic_dia", `+${(atual.value - ontem.value).toFixed(1)} kg em 24 h`, atual.recorded_at));
    }
    const maisAntigo = pesos[pesos.length - 1];
    if (atual.value - maisAntigo.value > 2 && !alerts.some((a) => a.code === "peso_ic_dia")) {
      alerts.push(mk("peso_ic_semana", `+${(atual.value - maisAntigo.value).toFixed(1)} kg em 7 dias`, atual.recorded_at));
    }
  }

  // ── Oxigenação ─────────────────────────────────────────────────────
  for (const r of input.spo2) {
    if (!dentroDe(r.recorded_at, now, 7)) continue;
    if (r.context === "sleep" && (r.time_below_90_pct ?? 0) >= 5) {
      alerts.push(mk("spo2_noturna", `${r.time_below_90_pct}% do sono < 90%`, r.recorded_at));
    } else if (r.value < 90 && podeDispararAlerta(r.validation_status)) {
      alerts.push(mk("spo2_baixa", `${r.value}%`, r.recorded_at));
    }
  }

  // ── Sintomas ───────────────────────────────────────────────────────
  //
  // AUDITORIA: estas três regras liam `qualifiers.trigger` e
  // `qualifiers.nyha_change`; a tela sempre gravou `gatilho` e `nyha`. Com
  // chave errada, `dor_toracica_repouso` e `dispneia_piora` — as duas regras
  // mais graves do motor — nunca dispararam com dado de paciente de verdade.
  // A nomenclatura canônica agora é uma só e mora em cardioAlertRules
  // (`QUALIFICADOR`), com leitores tolerantes ao formato antigo para não
  // perder o histórico já gravado.
  //
  // A varredura é do MAIS ANTIGO para o mais novo porque a regra de dispneia
  // precisa da classe NYHA anterior do próprio paciente: o app grava a classe
  // ABSOLUTA do momento (1–4), não a variação. Quem define "piora" é a
  // comparação, e ela só existe aqui.
  const sintomasEmOrdem = [...input.symptoms].sort(
    (a, b) => +new Date(a.occurred_at) - +new Date(b.occurred_at)
  );
  let nyhaAnterior: number | null = null;

  for (const s of sintomasEmOrdem) {
    const recente = dentroDe(s.occurred_at, now, 7);

    if (s.symptom_type === "chest_pain" && recente) {
      // Duração DESCONHECIDA conta como longa — a mesma leitura de
      // SintomasPage, e pelo mesmo motivo: quem não consegue dizer há quanto
      // tempo dói é justamente o caso que não pode escapar.
      const emRepouso = gatilhoDaDor(s.qualifiers) === GATILHO.REPOUSO;
      const longa = s.duration_minutes == null || s.duration_minutes > 10;
      if (emRepouso && longa) {
        alerts.push(
          mk(
            "dor_toracica_repouso",
            s.duration_minutes != null ? `${s.duration_minutes} min em repouso` : "duração não informada, em repouso",
            s.occurred_at
          )
        );
      }
    }

    if (s.symptom_type === "syncope" && recente) {
      alerts.push(mk("sincope", "episódio relatado", s.occurred_at));
    }

    if (s.symptom_type === "dyspnea") {
      const nyhaAgora = nyhaDoRelato(s.qualifiers);
      if (nyhaAgora != null) {
        if (recente && nyhaAnterior != null && nyhaAgora > nyhaAnterior) {
          alerts.push(
            mk(
              "dispneia_piora",
              `NYHA ${nyhaAnterior} → ${nyhaAgora}`,
              s.occurred_at,
              "subida de 1 classe NYHA em relação ao próprio relato anterior"
            )
          );
        }
        // A referência acompanha TODO o histórico, inclusive o que está fora
        // da janela de 7 dias — senão o primeiro relato da semana nunca teria
        // com o que ser comparado.
        nyhaAnterior = nyhaAgora;
      }
    }
  }

  // ── Adesão e silêncio ──────────────────────────────────────────────
  if (input.adherence14d != null && input.adherence14d < 0.8) {
    alerts.push(
      mk("adesao_baixa", `${Math.round(input.adherence14d * 100)}% das doses`, now.toISOString())
    );
  }

  const ultimoRegistro = [
    ...input.bloodPressure.map((r) => r.recorded_at),
    ...input.heartRate.map((r) => r.recorded_at),
    ...input.weight.map((r) => r.recorded_at),
    ...input.sleep.map((r) => r.recorded_at),
  ]
    .map((d) => new Date(d).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];

  if (!ultimoRegistro || now.getTime() - ultimoRegistro > 10 * DIA) {
    const dias = ultimoRegistro ? Math.floor((now.getTime() - ultimoRegistro) / DIA) : null;
    alerts.push(mk("sem_dados", dias ? `${dias} dias sem registro` : "nenhum registro", now.toISOString()));
  }

  // ── Semáforo ───────────────────────────────────────────────────────
  const score = alerts.reduce((s, a) => s + SEVERITY_WEIGHT[a.severity], 0);
  const level: RiskLevel = score >= 10 ? "red" : score >= 4 ? "yellow" : "green";

  const maisGrave = [...alerts].sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]
  )[0];

  const headline = maisGrave
    ? `${maisGrave.title} — ${maisGrave.triggerValue}`
    : "Dentro dos alvos, com registros em dia.";

  return { level, score, alerts, headline };
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  green: "Estável",
  yellow: "Atenção",
  red: "Prioridade",
};
