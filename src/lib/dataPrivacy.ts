/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════
 * LGPD — Portabilidade e exclusão de dados (art. 18)
 * ══════════════════════════════════════════════════════════════════
 *
 * Direito do titular de dados:
 *   - exportData()  → confirmação/acesso (art. 18, II e V): gera um
 *     JSON com todos os dados pessoais do paciente.
 *   - deleteAccountData() → eliminação (art. 18, VI): apaga em definitivo
 *     os dados do paciente de todas as tabelas (hard-delete).
 *
 * Tudo roda sob a RLS do Supabase: cada query só alcança as linhas do
 * próprio usuário. Mesmo assim filtramos explicitamente por patient_id/
 * user_id como segunda camada de segurança.
 *
 * IMPORTANTE: a remoção do registro de auth (auth.users) precisa de
 * privilégio de service-role e deve ser feita por uma edge function
 * dedicada. Aqui apagamos todos os DADOS; a conta de login em si é
 * sinalizada para remoção e o usuário é deslogado.
 */

import { supabase } from "@/integrations/supabase/client";
import { auditLog } from "@/lib/auditLogger";

/** Tabelas com dado clínico do paciente, chaveadas por patient_user_id. */
const PATIENT_SCOPED_TABLES = [
  "bp_readings",
  "hr_readings",
  "spo2_readings",
  "weight_readings",
  "glucose_readings",
  "sleep_records",
  "activity_records",
  "symptom_reports",
  "medication_intakes",
  "lab_results",
  "cardio_exams",
  "cardio_alerts",
  "appointments",
  "raw_device_data",
  "registered_devices",
  "weight_records",
  "blood_pressure",
  "glucose_readings",
  "body_measurements",
  "water_intake",
  "kick_sessions",
  "contraction_logs",
  "fasting_sessions",
  "meals",
  "medications",
  "maternal_vaccines",
  "exams",
  "exam_biomarkers",
  "lab_results",
  "ultrasound_reports",
  "progress_photos",
  "appointments",
  "prescriptions",
  "prescription_tasks",
  "prescription_task_completions",
  "treatments",
  "treatment_logs",
  "treatment_checkins",
  "professional_notes",
  "professional_alerts",
  "patient_messages",
  "clinical_vitals",
  "mind_records",
  "spirit_records",
  "workout_logs",
  "conquistas",
  "scores_evolucao",
  "daily_missions",
] as const;

/** Tabelas chaveadas diretamente por user_id. */
const USER_SCOPED_TABLES = [
  "profiles",
  "onboardings",
  "user_roles",
  "professional_patient_links",
  "beta_events",
] as const;

export interface ExportResult {
  exportedAt: string;
  userId: string;
  patientId: string | null;
  data: Record<string, unknown[]>;
}

/** Busca o patient.id do usuário logado (se houver). */
async function getPatientId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("cardio_patients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Reúne todos os dados pessoais do usuário num único objeto.
 * Tabelas/colunas inexistentes são ignoradas silenciosamente — o
 * schema evolui, e a exportação não deve quebrar por causa disso.
 */
export async function collectUserData(userId: string): Promise<ExportResult> {
  const patientId = await getPatientId(userId);
  const data: Record<string, unknown[]> = {};

  // Dados base do paciente
  const { data: patientRow } = await supabase
    .from("cardio_patients")
    .select("*")
    .eq("user_id", userId);
  data.patients = patientRow ?? [];

  if (patientId) {
    for (const table of PATIENT_SCOPED_TABLES) {
      const { data: rows, error } = await supabase
        .from(table)
        .select("*")
        .eq("patient_id", patientId);
      if (!error && rows) data[table] = rows;
    }
  }

  for (const table of USER_SCOPED_TABLES) {
    const { data: rows, error } = await supabase
      .from(table)
      .select("*")
      .eq("user_id", userId);
    if (!error && rows) data[table] = rows;
  }

  return {
    exportedAt: new Date().toISOString(),
    userId,
    patientId,
    data,
  };
}

/** Dispara o download do JSON no navegador. */
export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Conveniência: coleta + baixa em um passo. */
export async function exportData(userId: string): Promise<void> {
  const payload = await collectUserData(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadJson(payload, `encorpei-cardio-meus-dados-${stamp}.json`);
  auditLog(
    "lgpd:data_exported",
    {
      description: "Titular exportou os próprios dados (LGPD art. 18)",
      patientId: payload.patientId ?? undefined,
    },
    { id: userId, role: "patient" },
  );
}

/**
 * Apaga em definitivo todos os dados do paciente (hard-delete).
 * Ordem: filhos primeiro (patient-scoped), depois user-scoped, por fim patients.
 * Falhas individuais são coletadas mas não interrompem o processo —
 * o objetivo é remover o máximo possível.
 */
export async function deleteAccountData(
  userId: string,
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  const patientId = await getPatientId(userId);

  // Audita ANTES de apagar — depois do delete o vínculo já não existe.
  auditLog(
    "lgpd:data_deleted",
    {
      description: "Titular solicitou exclusão definitiva da conta (LGPD art. 18, VI)",
      patientId: patientId ?? undefined,
    },
    { id: userId, role: "patient" },
  );

  if (patientId) {
    for (const table of PATIENT_SCOPED_TABLES) {
      const { error } = await (supabase as any).from(table).delete().eq("patient_id", patientId);
      (error ? failed : deleted).push(table);
    }
  }

  for (const table of USER_SCOPED_TABLES) {
    const { error } = await (supabase as any).from(table).delete().eq("user_id", userId);
    (error ? failed : deleted).push(table);
  }

  // patients por último (é o pai de tudo)
  {
    const { error } = await (supabase as any).from("cardio_patients").delete().eq("user_id", userId);
    (error ? failed : deleted).push("patients");
  }

  return { deleted, failed };
}
