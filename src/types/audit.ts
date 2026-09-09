/**
 * ══════════════════════════════════════════════════════════════════════
 * SISTEMA DE AUDITORIA E RASTREABILIDADE
 * ══════════════════════════════════════════════════════════════════════
 *
 * Log imutável de todas as ações no sistema.
 * Requisito LGPD: rastreabilidade de acesso e alteração de dados pessoais.
 *
 * Regras:
 * - Logs são append-only (nunca editados ou deletados)
 * - Cada ação gera um registro com contexto completo
 * - Dados sensíveis são mascarados no log
 */

// ── Enums ────────────────────────────────────────────────────────────

/** Categorias de ação auditável */
export type AuditAction =
  // Dados clínicos
  | "reading:created"
  | "reading:validated"
  | "reading:rejected"
  | "reading:deleted"
  // Alertas
  | "alert:triggered"
  | "alert:read"
  | "alert:dismissed"
  // Prescrições
  | "prescription:created"
  | "prescription:updated"
  | "prescription:cancelled"
  // Pacientes
  | "patient:linked"
  | "patient:unlinked"
  | "patient:profile_viewed"
  | "patient:data_exported"
  // Devices
  | "device:registered"
  | "device:approved"
  | "device:revoked"
  | "device:data_received"
  // Organização
  | "org:member_added"
  | "org:member_removed"
  | "org:settings_changed"
  // Auth & acesso
  | "auth:login"
  | "auth:logout"
  | "auth:password_changed"
  // LGPD
  | "lgpd:data_requested"
  | "lgpd:data_exported"
  | "lgpd:data_deleted"
  | "lgpd:consent_given"
  | "lgpd:consent_revoked";

/** Nível de risco da ação (para filtrar logs sensíveis) */
export type AuditRiskLevel = "low" | "medium" | "high" | "critical";

// ── Audit Log Entry ──────────────────────────────────────────────────

/**
 * Entrada no log de auditoria.
 * Imutável — uma vez criada, nunca é editada.
 */
export interface AuditLogEntry {
  id: string;
  /** Ação realizada */
  action: AuditAction;
  /** Nível de risco */
  risk_level: AuditRiskLevel;
  /** UUID do ator (quem fez a ação) */
  actor_id: string;
  /** Papel do ator no momento */
  actor_role: string;
  /** Organização contexto (se aplicável) */
  org_id?: string;
  /** UUID do recurso afetado */
  resource_id?: string;
  /** Tipo do recurso (ex: "blood_pressure_reading") */
  resource_type?: string;
  /** UUID do paciente afetado (se aplicável) */
  patient_id?: string;
  /** Descrição legível da ação */
  description: string;
  /** Dados antes da mudança (mascarados) */
  before?: Record<string, unknown>;
  /** Dados depois da mudança (mascarados) */
  after?: Record<string, unknown>;
  /** Metadados extras */
  metadata?: {
    ip_address?: string;
    user_agent?: string;
    session_id?: string;
    [key: string]: unknown;
  };
  /** Timestamp da ação (ISO 8601) */
  created_at: string;
}

// ── Helpers de Auditoria ─────────────────────────────────────────────

/** Mapeamento de ação → nível de risco padrão */
export const ACTION_RISK_LEVELS: Record<AuditAction, AuditRiskLevel> = {
  // Dados clínicos
  "reading:created": "low",
  "reading:validated": "low",
  "reading:rejected": "medium",
  "reading:deleted": "high",
  // Alertas
  "alert:triggered": "medium",
  "alert:read": "low",
  "alert:dismissed": "medium",
  // Prescrições
  "prescription:created": "medium",
  "prescription:updated": "medium",
  "prescription:cancelled": "medium",
  // Pacientes
  "patient:linked": "medium",
  "patient:unlinked": "medium",
  "patient:profile_viewed": "low",
  "patient:data_exported": "high",
  // Devices
  "device:registered": "medium",
  "device:approved": "medium",
  "device:revoked": "medium",
  "device:data_received": "low",
  // Organização
  "org:member_added": "medium",
  "org:member_removed": "high",
  "org:settings_changed": "medium",
  // Auth
  "auth:login": "low",
  "auth:logout": "low",
  "auth:password_changed": "high",
  // LGPD
  "lgpd:data_requested": "high",
  "lgpd:data_exported": "critical",
  "lgpd:data_deleted": "critical",
  "lgpd:consent_given": "medium",
  "lgpd:consent_revoked": "high",
};

/**
 * Mascara dados sensíveis para o log.
 * Ex: "ana.silva@email.com" → "an***@em***.com"
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ["email", "phone", "cpf", "crm", "password", "token"];
  const masked = { ...data };

  for (const key of Object.keys(masked)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      const val = String(masked[key]);
      if (val.includes("@")) {
        // Email masking
        const [local, domain] = val.split("@");
        masked[key] = `${local.slice(0, 2)}***@${domain.slice(0, 2)}***.${domain.split(".").pop()}`;
      } else if (val.length > 4) {
        // Generic masking
        masked[key] = `${val.slice(0, 2)}${"*".repeat(val.length - 4)}${val.slice(-2)}`;
      } else {
        masked[key] = "****";
      }
    }
  }

  return masked;
}
