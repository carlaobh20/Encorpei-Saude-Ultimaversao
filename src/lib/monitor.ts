/**
 * Centralized monitoring & observability layer.
 *
 * Architecture:
 * - Sentry integration active when VITE_SENTRY_DSN is set
 * - Falls back to console + Supabase logs_erro table
 * - Environment-aware: verbose in dev, lean in production
 * - Scrubs sensitive data before sending
 *
 * To enable Sentry in production:
 * 1. Add VITE_SENTRY_DSN to .env (publishable key, safe for frontend)
 * 2. Done — Sentry will auto-initialize on app mount
 */

import * as Sentry from "@sentry/react";
import { supabase } from "@/integrations/supabase/client";
import { isDev, isProd } from "@/lib/config";

const IS_DEV = isDev;
const IS_PROD = isProd;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";
const SENTRY_ENABLED = !!SENTRY_DSN;

// ─── Sentry init (called once from main.tsx) ──────────
export function initSentry() {
  if (!SENTRY_ENABLED) {
    if (IS_DEV) console.info("[Monitor] Sentry disabled — no VITE_SENTRY_DSN set");
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: IS_PROD ? "production" : "development",
    enabled: IS_PROD, // only send in prod
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.5,
    beforeSend(event) {
      // Scrub sensitive data from EVERY channel que pode carregar PII.
      // Antes só a exception.value era limpa — message, breadcrumbs, extra,
      // contexts e request.url passavam cru (achado do panorama de 30/07).
      if (event.exception?.values) {
        for (const v of event.exception.values) {
          if (v.value) v.value = scrub(v.value);
        }
      }
      if (event.message) event.message = scrub(event.message);
      if (event.request?.url) event.request.url = scrub(event.request.url);
      if (event.breadcrumbs) {
        for (const b of event.breadcrumbs) {
          if (b.message) b.message = scrub(b.message);
          if (b.data) b.data = scrubDeep(b.data) as typeof b.data;
        }
      }
      if (event.extra) event.extra = scrubDeep(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrubDeep(event.contexts) as typeof event.contexts;
      return event;
    },
  });
}

// ─── Sensitive data scrubbing ─────────────────────────

const SENSITIVE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]{20,}/g,           // JWTs
  /Bearer\s+[A-Za-z0-9._-]+/gi,       // Auth headers
  /password["\s:=]+["']?[^"'\s,}]+/gi, // Passwords
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
  /\b\d{3}[.-]?\d{3}[.-]?\d{3}[.-]?\d{2}\b/g, // CPF
];

function scrub(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Aplica `scrub` recursivamente em objetos e arrays.
 * Usado no beforeSend do Sentry: breadcrumbs, extra e contexts são objetos
 * arbitrários e podem carregar PA, peso, e-mail ou id de paciente.
 * Profundidade limitada para não travar em estruturas circulares.
 */
function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (typeof value === "string") return scrub(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

// ─── Log levels ───────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: Error;
  scope?: string;
}

// ─── Core logger ──────────────────────────────────────

class Monitor {
  private userId: string | null = null;

  /** Set after auth resolves */
  setUser(userId: string | null) {
    this.userId = userId;
    if (SENTRY_ENABLED && userId) {
      Sentry.setUser({ id: userId });
    } else if (SENTRY_ENABLED) {
      Sentry.setUser(null);
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (IS_DEV) this.log({ level: "debug", message, context });
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log({ level: "info", message, context });
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log({ level: "warn", message, context });
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error ?? message));
    this.log({ level: "error", message, error: err, context });
  }

  fatal(message: string, error?: unknown, context?: Record<string, unknown>) {
    const err = error instanceof Error ? error : new Error(String(error ?? message));
    this.log({ level: "fatal", message, error: err, context });
  }

  /** Capture a React Error Boundary crash */
  captureComponentError(error: Error, componentStack: string | null | undefined, scope?: string) {
    this.log({
      level: "error",
      message: `[${scope ?? "Component"}] ${error.message}`,
      error,
      context: { componentStack: componentStack ?? undefined },
      scope,
    });
  }

  // ─── Internal ─────────────────────────────────────

  private log(entry: LogEntry) {
    // 1. Console (always in dev, errors only in prod)
    if (IS_DEV || entry.level === "error" || entry.level === "fatal") {
      const consoleFn = entry.level === "debug" ? console.debug
        : entry.level === "info" ? console.info
        : entry.level === "warn" ? console.warn
        : console.error;

      consoleFn(`[${entry.scope ?? "Monitor"}:${entry.level}]`, entry.message, {
        ...(entry.context ?? {}),
        ...(entry.error ? { stack: entry.error.stack } : {}),
      });
    }

    // 2. Persist critical errors to Supabase (async, fire-and-forget)
    if ((entry.level === "error" || entry.level === "fatal") && IS_PROD) {
      this.persistToSupabase(entry).catch(() => {
        // Silent fail — don't create error loops
      });
    }

    // 3. Sentry
    if (SENTRY_ENABLED && entry.error && (entry.level === "error" || entry.level === "fatal")) {
      Sentry.captureException(entry.error, {
        tags: { scope: entry.scope, level: entry.level },
        extra: entry.context,
      });
    }
  }

  private async persistToSupabase(entry: LogEntry) {
    try {
      const scrubbedMessage = scrub(entry.message);
      const scrubbedStack = entry.error?.stack ? scrub(entry.error.stack) : null;

      await (supabase as any).from("audit_logs").insert({
        action: "frontend_error",
        risk_level: "low",
        actor_id: this.userId,
        actor_role: "sistema",
        description: scrubbedMessage.slice(0, 500),
        resource_type: entry.scope ?? "frontend",
        metadata: { stack: scrubbedStack?.slice(0, 2000) ?? null },
        contexto: entry.context ? JSON.parse(JSON.stringify(entry.context)) : null,
      });
    } catch {
      // Never throw from monitoring code
    }
  }
}

// ─── Singleton ────────────────────────────────────────

export const monitor = new Monitor();

// ─── Global unhandled error capture ───────────────────

export function initGlobalErrorCapture() {
  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    monitor.error(
      "Unhandled promise rejection",
      event.reason,
      { type: "unhandledrejection" }
    );
  });

  // Uncaught errors
  window.addEventListener("error", (event) => {
    // Ignore script loading errors (CDN, extensions, etc.)
    if (!event.error) return;
    monitor.error(
      "Uncaught error",
      event.error,
      { type: "uncaughterror", filename: event.filename, lineno: event.lineno }
    );
  });
}
