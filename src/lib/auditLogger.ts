/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * AUDIT LOGGER
 * ══════════════════════════════════════════════════════════════════════
 *
 * Logger de auditoria para rastreabilidade LGPD.
 *
 * Fase 1 (atual): Log em console + localStorage buffer
 * Fase 2 (futuro): Persiste em tabela audit_logs no Supabase
 *
 * Uso:
 *   auditLog("reading:created", {
 *     resourceId: reading.id,
 *     resourceType: "blood_pressure_reading",
 *     patientId: reading.patient_id,
 *     description: "Pressão arterial registrada: 120/80",
 *   });
 */

import type { AuditAction, AuditLogEntry, AuditRiskLevel } from "@/types/audit";
import { ACTION_RISK_LEVELS, maskSensitiveData } from "@/types/audit";

// ── Buffer local ─────────────────────────────────────────────────────

const AUDIT_BUFFER_KEY = "encorpei:audit:buffer";
const MAX_BUFFER_SIZE = 500;

interface AuditInput {
  resourceId?: string;
  resourceType?: string;
  patientId?: string;
  orgId?: string;
  description: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

function getBuffer(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function appendToBuffer(entry: AuditLogEntry): void {
  const buffer = getBuffer();
  buffer.push(entry);

  // Trim se exceder tamanho máximo (mantém os mais recentes)
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
  }

  try {
    localStorage.setItem(AUDIT_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // localStorage cheio — limpa metade
    buffer.splice(0, Math.floor(buffer.length / 2));
    localStorage.setItem(AUDIT_BUFFER_KEY, JSON.stringify(buffer));
  }
}

// ── API Pública ──────────────────────────────────────────────────────

/**
 * Registra uma ação auditável.
 * Fase 1: Console + localStorage. Fase 2: Supabase.
 */
export function auditLog(
  action: AuditAction,
  input: AuditInput,
  actor?: { id: string; role: string },
): void {
  const riskLevel: AuditRiskLevel = ACTION_RISK_LEVELS[action] ?? "low";

  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    action,
    risk_level: riskLevel,
    actor_id: actor?.id ?? "anonymous",
    actor_role: actor?.role ?? "unknown",
    org_id: input.orgId,
    resource_id: input.resourceId,
    resource_type: input.resourceType,
    patient_id: input.patientId,
    description: input.description,
    before: input.before ? maskSensitiveData(input.before) : undefined,
    after: input.after ? maskSensitiveData(input.after) : undefined,
    created_at: new Date().toISOString(),
  };

  // Console log (dev)
  if (import.meta.env.DEV) {
    const emoji = riskLevel === "critical" ? "🔴" : riskLevel === "high" ? "🟠" : riskLevel === "medium" ? "🟡" : "⚪";
    console.info(`[audit] ${emoji} ${action}: ${input.description}`);
  }

  // Buffer local
  appendToBuffer(entry);

  // Fase 2: (supabase as any).from("audit_logs").insert(entry)
}

/**
 * Retorna os logs auditáveis do buffer local.
 * Útil para debug e compliance local.
 */
export function getAuditBuffer(): AuditLogEntry[] {
  return getBuffer();
}

/**
 * Limpa o buffer local (após sync com servidor).
 */
export function clearAuditBuffer(): void {
  localStorage.removeItem(AUDIT_BUFFER_KEY);
}

/**
 * Conta logs por nível de risco.
 */
export function getAuditStats(): Record<AuditRiskLevel, number> {
  const buffer = getBuffer();
  const stats: Record<AuditRiskLevel, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const entry of buffer) {
    stats[entry.risk_level]++;
  }
  return stats;
}
