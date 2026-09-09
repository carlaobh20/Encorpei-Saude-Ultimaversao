/**
 * Metas terapêuticas — o eixo do produto (docs/MAPEAMENTO-CARDIO.md §1).
 *
 * Cada paciente tem alvos definidos pelo cardiologista. O app mede a distância
 * até o alvo; o médico titula. Aqui ficam apenas os PADRÕES sugeridos por
 * estrato de risco — o valor final é sempre o que o médico gravou.
 */

import type { CardioTargets, CardioPatient } from "@/types/cardio";

export type RiskCategory = "low" | "moderate" | "high" | "very_high";

export const RISK_CATEGORY_LABEL: Record<RiskCategory, string> = {
  low: "Risco baixo",
  moderate: "Risco moderado",
  high: "Risco alto",
  very_high: "Risco muito alto",
};

/**
 * LDL-alvo por estrato. Valores em mg/dL, alinhados às diretrizes de
 * dislipidemia em uso no Brasil (SBC/ESC).
 */
export const LDL_TARGET_BY_RISK: Record<RiskCategory, number> = {
  low: 130,
  moderate: 100,
  high: 70,
  very_high: 50,
};

export const DEFAULT_TARGETS: Omit<CardioTargets, "id" | "patient_user_id" | "updated_at"> = {
  professional_id: null,
  bp_systolic_max: 130,
  bp_diastolic_max: 80,
  ldl_max: 100,
  resting_hr_min: 50,
  resting_hr_max: 80,
  dry_weight_kg: null,
  steps_per_day: 7000,
  mvpa_minutes_week: 150,
  sleep_hours: 7,
  sodium_mg_day: 2000,
};

/** Sugestão inicial de alvos a partir do perfil — o médico confirma ou muda. */
export function sugerirAlvos(patient: Pick<CardioPatient, "risk_category" | "history">) {
  const risk = (patient.risk_category ?? "moderate") as RiskCategory;
  const temIC = !!patient.history?.heart_failure;

  return {
    ...DEFAULT_TARGETS,
    ldl_max: LDL_TARGET_BY_RISK[risk],
    // Na IC com betabloqueador, a faixa de FC de repouso é mais baixa.
    resting_hr_min: temIC ? 50 : 55,
    resting_hr_max: temIC ? 70 : 85,
    steps_per_day: temIC ? 5000 : 7000,
  };
}

export interface TargetProgress {
  label: string;
  current: number | null;
  target: number;
  unit: string;
  /** true quando o objetivo é ficar ABAIXO do alvo (PA, LDL, peso). */
  lowerIsBetter: boolean;
  status: "on_target" | "near" | "off_target" | "no_data";
}

export function avaliarMeta(
  label: string,
  current: number | null | undefined,
  target: number,
  unit: string,
  lowerIsBetter: boolean,
  /** Tolerância relativa para o estado "quase lá". */
  tolerance = 0.1
): TargetProgress {
  if (current == null || Number.isNaN(current)) {
    return { label, current: null, target, unit, lowerIsBetter, status: "no_data" };
  }
  const margin = target * tolerance;
  let status: TargetProgress["status"];
  if (lowerIsBetter) {
    status = current <= target ? "on_target" : current <= target + margin ? "near" : "off_target";
  } else {
    status = current >= target ? "on_target" : current >= target - margin ? "near" : "off_target";
  }
  return { label, current, target, unit, lowerIsBetter, status };
}
