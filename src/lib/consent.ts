/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════
 * LGPD — Gestão de consentimento (art. 8 e art. 11)
 * ══════════════════════════════════════════════════════════════════
 *
 * Dado de saúde é dado SENSÍVEL: o consentimento precisa ser específico,
 * destacado e comprovável. Este módulo registra de forma append-only
 * cada consentimento dado (e cada revogação) na tabela consent_records.
 *
 * Versionar os documentos é essencial: se a política muda, é preciso
 * saber qual versão cada usuário aceitou — e, eventualmente, pedir novo
 * consentimento.
 */

import { supabase } from "@/integrations/supabase/client";

/** Versão vigente de cada documento. Bump ao alterar o texto correspondente. */
export const DOCUMENT_VERSIONS = {
  terms: "2026-05-24",
  privacy: "2026-05-24",
  health_data: "2026-05-24",
  analytics: "2026-05-24",
  doctor_sharing: "2026-05-24",
} as const;

export type ConsentType = keyof typeof DOCUMENT_VERSIONS;
export type ConsentContext = "signup" | "onboarding" | "settings" | "cookie_banner";

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: ConsentType;
  document_version: string;
  status: "granted" | "revoked";
  context: string | null;
  created_at: string;
}

/** Registra um consentimento concedido. */
export async function grantConsent(
  userId: string,
  type: ConsentType,
  context: ConsentContext,
): Promise<void> {
  await (supabase as any).from("consent_records").insert({
    user_id: userId,
    consent_type: type,
    document_version: DOCUMENT_VERSIONS[type],
    status: "granted",
    context,
  });
}

/** Registra a revogação de um consentimento (novo registro, append-only). */
export async function revokeConsent(
  userId: string,
  type: ConsentType,
  context: ConsentContext,
): Promise<void> {
  await (supabase as any).from("consent_records").insert({
    user_id: userId,
    consent_type: type,
    document_version: DOCUMENT_VERSIONS[type],
    status: "revoked",
    context,
  });
}

/** Registra vários consentimentos de uma vez (ex.: no cadastro). */
export async function grantManyConsents(
  userId: string,
  types: ConsentType[],
  context: ConsentContext,
): Promise<void> {
  const rows = types.map((type) => ({
    user_id: userId,
    consent_type: type,
    document_version: DOCUMENT_VERSIONS[type],
    status: "granted" as const,
    context,
  }));
  if (rows.length) await (supabase as any).from("consent_records").insert(rows);
}

/**
 * Estado atual de cada tipo de consentimento do usuário.
 * Considera o registro mais recente de cada tipo (granted vence se for o último).
 */
export async function getConsentState(
  userId: string,
): Promise<Record<string, { status: string; version: string; at: string }>> {
  const { data } = await supabase
    .from("consent_records")
    .select("consent_type, document_version, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const state: Record<string, { status: string; version: string; at: string }> = {};
  for (const row of (data ?? []) as { consent_type: string; document_version: string; status: string; created_at: string }[]) {
    // primeiro encontrado = mais recente (já ordenado desc)
    if (!state[row.consent_type]) {
      state[row.consent_type] = {
        status: row.status,
        version: row.document_version,
        at: row.created_at,
      };
    }
  }
  return state;
}

/** Verifica se o usuário tem consentimento ativo para um tipo. */
export async function hasActiveConsent(
  userId: string,
  type: ConsentType,
): Promise<boolean> {
  const state = await getConsentState(userId);
  return state[type]?.status === "granted";
}
