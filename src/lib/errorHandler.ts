import { toast } from "sonner";
import { monitor } from "@/lib/monitor";

// ─── Error classification ─────────────────────────────

type ErrorCategory = "network" | "auth" | "validation" | "notFound" | "rateLimit" | "unknown";

interface ClassifiedError {
  category: ErrorCategory;
  userMessage: string;
  debugMessage: string;
  retryable: boolean;
}

/**
 * Extrai a mensagem de QUALQUER formato de erro que chega aqui.
 * BUG CORRIGIDO (04/09/2026): o erro do Supabase (PostgrestError) não é
 * `instanceof Error` — virava "[object Object]" e a classificação abaixo não
 * enxergava nada (nem "violates", nem "permission"). Em tablet, `navigator.onLine`
 * instável ainda fazia o erro de banco aparecer como "Erro de conexão". Agora:
 * lemos message/details/hint/code do objeto e só chamamos de "conexão" o que é
 * falha de rede de verdade.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code].filter((x) => typeof x === "string" && x) as string[];
    if (parts.length) return parts.join(" · ");
    try { return JSON.stringify(error); } catch { /* segue */ }
  }
  return String(error);
}

export function classifyError(error: unknown): ClassifiedError {
  const raw = extractMessage(error);
  const lower = raw.toLowerCase();
  const code = (error && typeof error === "object" && typeof (error as any).code === "string") ? String((error as any).code) : "";

  const looksLikeNetwork =
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("net::err");
  // `navigator.onLine === false` só reforça um erro que já parece de rede;
  // sozinho não classifica (dá falso positivo em tablet/PWA).
  if (looksLikeNetwork || (typeof navigator !== "undefined" && !navigator.onLine && !code)) {
    return { category: "network", userMessage: "Erro de conexão. Verifique sua internet.", debugMessage: raw, retryable: true };
  }

  // Códigos do Postgres/PostgREST — mensagens que dizem o que fazer.
  if (code === "42501" || lower.includes("row-level security") || lower.includes("permission denied")) {
    return { category: "auth", userMessage: "Sem permissão para esta ação. Confirme o vínculo com a paciente e tente de novo.", debugMessage: raw, retryable: false };
  }
  if (code === "23502" || lower.includes("null value in column")) {
    const col = /column "([^"]+)"/.exec(raw)?.[1];
    return { category: "validation", userMessage: `Campo obrigatório não enviado${col ? ` (${col})` : ""}. Se persistir, o banco precisa da migração mais recente.`, debugMessage: raw, retryable: false };
  }
  if (code === "42703" || code === "42P01" || code === "PGRST204" || lower.includes("does not exist") || lower.includes("could not find the")) {
    return { category: "validation", userMessage: "O banco de dados está desatualizado em relação ao app (migração pendente). Avise o suporte.", debugMessage: raw, retryable: false };
  }

  if (
    lower.includes("jwt") ||
    lower.includes("not authenticated") ||
    lower.includes("invalid login") ||
    lower.includes("email not confirmed") ||
    lower.includes("401")
  ) {
    return { category: "auth", userMessage: "Sessão expirada. Faça login novamente.", debugMessage: raw, retryable: false };
  }

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("too many")) {
    return { category: "rateLimit", userMessage: "Muitas requisições. Aguarde um momento.", debugMessage: raw, retryable: true };
  }

  if (lower.includes("pgrst116") || lower.includes("no rows")) {
    return { category: "notFound", userMessage: "Dado não encontrado.", debugMessage: raw, retryable: false };
  }

  if (lower.includes("violates") || lower.includes("duplicate") || lower.includes("check constraint")) {
    return { category: "validation", userMessage: "Dados inválidos. Verifique as informações.", debugMessage: raw, retryable: false };
  }

  return { category: "unknown", userMessage: "Algo deu errado. Tente novamente.", debugMessage: raw, retryable: true };
}

// ─── Toast helpers ────────────────────────────────────

export function toastError(error: unknown, context?: string) {
  const classified = classifyError(error);

  toast.error(classified.userMessage, {
    description: context,
    duration: classified.retryable ? 4000 : 6000,
  });

  // Send to monitor
  monitor.error(
    `${context ?? "Operation"}: ${classified.userMessage}`,
    error instanceof Error ? error : undefined,
    { category: classified.category, context }
  );

  return classified;
}

export function toastSuccess(message: string) {
  toast.success(message);
}

export function onMutationError(context: string) {
  return (error: unknown) => toastError(error, context);
}
