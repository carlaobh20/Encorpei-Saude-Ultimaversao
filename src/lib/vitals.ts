/**
 * Validação de sinais vitais.
 *
 * Dois objetivos:
 *  1. Parse seguro: nunca deixar NaN/Infinity chegar ao banco.
 *  2. Faixas plausíveis: barrar valores fisiologicamente impossíveis
 *     (digitação errada, ex.: PA 999, peso 5kg) antes de salvar.
 *
 * As faixas são propositalmente largas — o objetivo é pegar erro de
 * digitação, não fazer triagem clínica (isso é papel do motor de risco).
 */

export interface VitalRange {
  min: number;
  max: number;
  label: string;
}

export const VITAL_RANGES: Record<string, VitalRange> = {
  weight_kg:                 { min: 30,  max: 250, label: "Peso" },
  blood_pressure_systolic:   { min: 60,  max: 260, label: "Pressão (sistólica)" },
  blood_pressure_diastolic:  { min: 30,  max: 160, label: "Pressão (diastólica)" },
  blood_glucose_fasting:     { min: 30,  max: 600, label: "Glicemia" },
  spo2_pct:                  { min: 50,  max: 100, label: "Saturação (SpO₂)" },
  heart_rate_bpm:            { min: 30,  max: 220, label: "Frequência cardíaca" },
  body_temp_c:               { min: 30,  max: 45,  label: "Temperatura" },
};

/** Converte string para número finito, ou null se inválido (vazio, NaN, Infinity). */
export function parseNumeric(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Verifica se um valor está dentro da faixa plausível de um vital. */
export function isWithinRange(field: string, value: number): boolean {
  const range = VITAL_RANGES[field];
  if (!range) return true; // sem faixa definida → não bloqueia
  return value >= range.min && value <= range.max;
}

export interface VitalsResult {
  values: Record<string, number>;
  /** Rótulos dos campos fora da faixa plausível. */
  outOfRange: string[];
}

/**
 * Recebe um mapa campo→string e devolve só os valores numéricos válidos,
 * mais a lista de campos que ficaram fora da faixa plausível.
 */
export function collectVitals(input: Record<string, string | null | undefined>): VitalsResult {
  const values: Record<string, number> = {};
  const outOfRange: string[] = [];
  for (const [field, raw] of Object.entries(input)) {
    const n = parseNumeric(raw);
    if (n === null) continue; // vazio ou inválido → ignora
    if (!isWithinRange(field, n)) {
      outOfRange.push(VITAL_RANGES[field]?.label ?? field);
      continue; // não salva valor implausível
    }
    values[field] = n;
  }
  return { values, outOfRange };
}
