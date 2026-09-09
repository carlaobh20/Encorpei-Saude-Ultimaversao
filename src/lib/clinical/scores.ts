/**
 * Escores e cálculos cardiológicos (docs/MAPEAMENTO-CARDIO.md §2.1).
 *
 * Todos são funções puras, sem dependência de rede ou de React — é o que
 * permite testá-los e é o que evita que um número clínico dependa de estado
 * de tela.
 *
 * IMPORTANTE: escore é APOIO à decisão do médico, exibido com a origem e a
 * data de cálculo. Nenhuma tela do paciente transforma escore em conduta.
 */

import type { CardioPatient } from "@/types/cardio";

// ── Antropometria e função renal ─────────────────────────────────────

export function calcularIMC(pesoKg: number, alturaCm: number): number | null {
  if (!pesoKg || !alturaCm) return null;
  const m = alturaCm / 100;
  return +(pesoKg / (m * m)).toFixed(1);
}

export function classificarIMC(imc: number): string {
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25) return "Peso adequado";
  if (imc < 30) return "Sobrepeso";
  if (imc < 35) return "Obesidade grau I";
  if (imc < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

/** CKD-EPI 2021 (sem coeficiente de raça). Creatinina em mg/dL. */
export function calcularTFG(creatinina: number, idade: number, sexo: "male" | "female"): number | null {
  if (!creatinina || !idade) return null;
  const k = sexo === "female" ? 0.7 : 0.9;
  const a = sexo === "female" ? -0.241 : -0.302;
  const scr = creatinina / k;
  const min = Math.min(scr, 1) ** a;
  const max = Math.max(scr, 1) ** -1.2;
  const sexFactor = sexo === "female" ? 1.012 : 1;
  return +(142 * min * max * 0.9938 ** idade * sexFactor).toFixed(0);
}

export function idadeEmAnos(birthDate?: string | null, ref = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  let idade = ref.getFullYear() - d.getFullYear();
  const m = ref.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < d.getDate())) idade--;
  return idade;
}

// ── Colesterol ───────────────────────────────────────────────────────

/** Friedewald — inválida com triglicérides ≥ 400 mg/dL. */
export function ldlFriedewald(ct: number, hdl: number, tg: number): number | null {
  if (!ct || !hdl || !tg || tg >= 400) return null;
  return +(ct - hdl - tg / 5).toFixed(0);
}

export function naoHDL(ct: number, hdl: number): number | null {
  if (!ct || !hdl) return null;
  return +(ct - hdl).toFixed(0);
}

// ── CHA₂DS₂-VASc — risco tromboembólico na fibrilação atrial ─────────

export interface Cha2ds2VascInput {
  heartFailure: boolean;
  hypertension: boolean;
  age: number;
  diabetes: boolean;
  strokeOrTia: boolean;
  vascularDisease: boolean;
  female: boolean;
}

export interface ScoreResult {
  score: number;
  max: number;
  label: string;
  interpretation: string;
  breakdown: { item: string; points: number }[];
}

export function cha2ds2Vasc(i: Cha2ds2VascInput): ScoreResult {
  const b: { item: string; points: number }[] = [];
  const add = (item: string, points: number) => { if (points > 0) b.push({ item, points }); };

  add("Insuficiência cardíaca", i.heartFailure ? 1 : 0);
  add("Hipertensão", i.hypertension ? 1 : 0);
  add("Idade ≥ 75 anos", i.age >= 75 ? 2 : 0);
  if (i.age >= 65 && i.age < 75) add("Idade 65–74 anos", 1);
  add("Diabetes", i.diabetes ? 1 : 0);
  add("AVC/AIT prévio", i.strokeOrTia ? 2 : 0);
  add("Doença vascular", i.vascularDisease ? 1 : 0);
  add("Sexo feminino", i.female ? 1 : 0);

  const score = b.reduce((s, x) => s + x.points, 0);
  const interpretation =
    score === 0
      ? "Risco baixo."
      : score === 1
      ? "Risco intermediário — conduta individualizada pelo médico."
      : "Risco elevado — o médico avaliará anticoagulação.";

  return { score, max: 9, label: "CHA₂DS₂-VASc", interpretation, breakdown: b };
}

// ── HAS-BLED — risco de sangramento sob anticoagulação ───────────────

export interface HasBledInput {
  hypertensionUncontrolled: boolean;
  abnormalRenal: boolean;
  abnormalLiver: boolean;
  stroke: boolean;
  bleedingHistory: boolean;
  labileInr: boolean;
  elderly: boolean; // > 65 anos
  drugs: boolean;   // AINE/antiagregante
  alcohol: boolean;
}

export function hasBled(i: HasBledInput): ScoreResult {
  const b: { item: string; points: number }[] = [];
  const add = (item: string, on: boolean) => { if (on) b.push({ item, points: 1 }); };

  add("Hipertensão não controlada", i.hypertensionUncontrolled);
  add("Função renal alterada", i.abnormalRenal);
  add("Função hepática alterada", i.abnormalLiver);
  add("AVC prévio", i.stroke);
  add("Sangramento prévio", i.bleedingHistory);
  add("INR lábil", i.labileInr);
  add("Idade > 65 anos", i.elderly);
  add("Medicamentos de risco", i.drugs);
  add("Álcool", i.alcohol);

  const score = b.reduce((s, x) => s + x.points, 0);
  return {
    score,
    max: 9,
    label: "HAS-BLED",
    interpretation: score >= 3 ? "Risco de sangramento elevado — atenção redobrada no seguimento." : "Risco de sangramento não elevado.",
    breakdown: b,
  };
}

// ── NYHA — classe funcional na insuficiência cardíaca ────────────────

export const NYHA_DESCRICAO: Record<1 | 2 | 3 | 4, string> = {
  1: "Sem limitação: atividade física habitual não causa cansaço nem falta de ar.",
  2: "Limitação leve: confortável em repouso, sintomas em atividade habitual.",
  3: "Limitação importante: sintomas com esforço menor que o habitual.",
  4: "Sintomas em repouso: qualquer atividade piora.",
};

/** Questionário curto que o paciente responde; devolve a classe. */
export function classificarNyha(respostas: {
  sintomaEmRepouso: boolean;
  sintomaEsforcoLeve: boolean;
  sintomaAtividadeHabitual: boolean;
}): 1 | 2 | 3 | 4 {
  if (respostas.sintomaEmRepouso) return 4;
  if (respostas.sintomaEsforcoLeve) return 3;
  if (respostas.sintomaAtividadeHabitual) return 2;
  return 1;
}

// ── Framingham (risco global 10 anos) — versão por pontos ────────────
// Mantido porque ainda é o escore mais pedido no Brasil em consultório.
// Prevenção primária apenas: não se aplica a quem já tem doença estabelecida.

export interface FraminghamInput {
  age: number;
  sex: "male" | "female";
  totalCholesterol: number;
  hdl: number;
  systolic: number;
  treatedForHypertension: boolean;
  smoker: boolean;
  diabetes: boolean;
}

export function framinghamRisco10a(i: FraminghamInput): ScoreResult | null {
  if (i.age < 30 || i.age > 79) return null;
  const male = i.sex === "male";
  const ln = Math.log;

  // Coeficientes do modelo de risco global (D'Agostino, 2008).
  const c = male
    ? { age: 3.06117, chol: 1.1237, hdl: -0.93263, sbpT: 1.99881, sbpU: 1.93303, smoke: 0.65451, dm: 0.57367, mean: 23.9802, s0: 0.88936 }
    : { age: 2.32888, chol: 1.20904, hdl: -0.70833, sbpT: 2.82263, sbpU: 2.76157, smoke: 0.52873, dm: 0.69154, mean: 26.1931, s0: 0.95012 };

  const sum =
    c.age * ln(i.age) +
    c.chol * ln(i.totalCholesterol) +
    c.hdl * ln(i.hdl) +
    (i.treatedForHypertension ? c.sbpT : c.sbpU) * ln(i.systolic) +
    (i.smoker ? c.smoke : 0) +
    (i.diabetes ? c.dm : 0);

  const risco = (1 - c.s0 ** Math.exp(sum - c.mean)) * 100;
  const pct = +Math.max(0, Math.min(100, risco)).toFixed(1);

  const interpretation =
    pct < 5 ? "Risco baixo em 10 anos." : pct < 10 ? "Risco intermediário-baixo." : pct < 20 ? "Risco intermediário-alto." : "Risco alto em 10 anos.";

  return {
    score: pct,
    max: 100,
    label: "Framingham (risco global 10 anos)",
    interpretation,
    breakdown: [
      { item: "Idade", points: i.age },
      { item: "Colesterol total", points: i.totalCholesterol },
      { item: "HDL", points: i.hdl },
      { item: "PA sistólica", points: i.systolic },
    ],
  };
}

// ── Helpers de perfil ────────────────────────────────────────────────

/** Monta as entradas do CHA₂DS₂-VASc a partir do cadastro do paciente. */
export function cha2ds2VascDoPaciente(p: CardioPatient): ScoreResult | null {
  const age = idadeEmAnos(p.birth_date);
  if (age == null || !p.history?.atrial_fibrillation) return null;
  return cha2ds2Vasc({
    heartFailure: !!p.history?.heart_failure,
    hypertension: !!p.comorbidities?.hypertension,
    age,
    diabetes: !!p.comorbidities?.diabetes,
    strokeOrTia: !!p.history?.stroke_tia,
    vascularDisease: !!(p.history?.previous_mi || p.history?.pad),
    female: p.sex === "female",
  });
}
