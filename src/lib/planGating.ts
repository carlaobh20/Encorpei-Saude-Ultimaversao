/**
 * Centralized plan-based feature access control.
 * Single source of truth: which plan unlocks which features.
 *
 * Planos: free (paciente) → consultorio → clinica → rede
 */

import type { PlanType } from "@/config/plans";

/** All gatable features in the product */
export type GatedFeature =
  | "risk_dashboard"
  | "auto_alerts"
  | "pdf_reports"
  | "prescriptions"
  | "clinical_history"
  | "multi_doctor"
  | "clinic_branding"
  | "admin_panel"
  | "sms_alerts"
  | "whatsapp_support"
  | "api_access"
  | "multi_unit";

/** Minimum plan required for each feature */
const FEATURE_MIN_PLAN: Record<GatedFeature, PlanType> = {
  risk_dashboard: "consultorio",
  auto_alerts: "consultorio",
  pdf_reports: "consultorio",
  prescriptions: "consultorio",
  clinical_history: "consultorio",
  multi_doctor: "clinica",
  clinic_branding: "clinica",
  admin_panel: "clinica",
  sms_alerts: "clinica",
  whatsapp_support: "clinica",
  api_access: "rede",
  multi_unit: "rede",
};

/** Plan hierarchy for comparison */
const PLAN_RANK: Record<PlanType, number> = {
  free: 0,
  consultorio: 1,
  clinica: 2,
  rede: 3,
};

/** Check if a plan has access to a feature */
export function canAccessFeature(userPlan: PlanType, feature: GatedFeature): boolean {
  const requiredPlan = FEATURE_MIN_PLAN[feature];
  return PLAN_RANK[userPlan] >= PLAN_RANK[requiredPlan];
}

/** Get the minimum plan required for a feature */
export function getRequiredPlan(feature: GatedFeature): PlanType {
  return FEATURE_MIN_PLAN[feature];
}

/** Get all features available for a plan */
export function getFeaturesForPlan(plan: PlanType): GatedFeature[] {
  return (Object.keys(FEATURE_MIN_PLAN) as GatedFeature[]).filter(
    (f) => PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN_PLAN[f]]
  );
}

/** Check if plan A is higher than plan B */
export function isPlanHigher(a: PlanType, b: PlanType): boolean {
  return PLAN_RANK[a] > PLAN_RANK[b];
}

/** Human-readable plan name */
export function getPlanLabel(plan: PlanType): string {
  const labels: Record<PlanType, string> = {
    free: "Gratuito",
    consultorio: "Consultório",
    clinica: "Clínica",
    rede: "Rede",
  };
  return labels[plan];
}

/** Limits per plan (for numeric gating) */
export const PLAN_LIMITS: Record<PlanType, {
  patients: number;
  doctors: number;
}> = {
  free: { patients: 0, doctors: 0 },
  consultorio: { patients: 50, doctors: 1 },
  clinica: { patients: 999, doctors: 5 },
  rede: { patients: 999, doctors: 999 },
};
