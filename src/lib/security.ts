/**
 * ══════════════════════════════════════════════════════════════════
 * Helpers de segurança
 * ══════════════════════════════════════════════════════════════════
 *
 * Funções pequenas e auditáveis para prevenir as classes de
 * vulnerabilidade mais comuns no frontend:
 *   - escapeHtml: previne XSS ao injetar texto em HTML cru
 *   - isSafeRedirectUrl: previne open redirect
 */

/**
 * Escapa os caracteres que tornam uma string perigosa dentro de HTML.
 * SEMPRE usar ao interpolar dados controlados pelo usuário (nome,
 * efeitos colaterais, notas etc.) em qualquer HTML montado à mão
 * (document.write, innerHTML, templates de relatório/e-mail).
 */
export function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Valida se uma URL é segura para redirecionamento.
 * Aceita apenas http(s) absolutos ou caminhos relativos do próprio app.
 * Bloqueia javascript:, data:, e protocolos arbitrários (anti open-redirect/XSS).
 */
export function isSafeRedirectUrl(url: unknown): boolean {
  if (typeof url !== "string" || url.length === 0) return false;
  // caminho relativo do próprio app (mas não "//" que é protocol-relative)
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Limpeza total de dado local no logout.
 *
 * O celular do paciente pode ser compartilhado; nada clínico pode
 * sobreviver à troca de conta:
 *   - cache do React Query (leituras clínicas em memória)
 *   - chaves locais do app (fila offline, buffer de auditoria,
 *     push subscription, checklists) — tudo que começa com "encorpei_"
 *     ou "encorpei:" 
 *   - caches do service worker criados pelo app
 *
 * Preferências inofensivas (tema, banner do PWA) são preservadas.
 */
export function clearLocalClinicalData(): void {
  // 1. React Query — import dinâmico para evitar ciclo de dependência.
  import("@/lib/queryClient")
    .then(({ queryClient }) => queryClient.clear())
    .catch(() => { /* noop */ });

  // 2. localStorage do app.
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("encorpei_") || key.startsWith("encorpei:"))) {
        toRemove.push(key);
      }
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage indisponível — nada a limpar */ }

  // 3. Caches do service worker.
  try {
    if ("caches" in window) {
      caches.keys()
        .then((keys) => Promise.all(
          keys.filter((k) => k.includes("encorpei")).map((k) => caches.delete(k)),
        ))
        .catch(() => { /* noop */ });
    }
  } catch { /* noop */ }
}
