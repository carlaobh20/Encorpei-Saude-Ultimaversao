type AppEnv = "development" | "staging" | "production";

function resolveEnv(): AppEnv {
  const mode = import.meta.env.MODE;
  if (mode === "staging") return "staging";
  if (mode === "production") return "production";
  return "development";
}

export const env = resolveEnv();
export const isDev = env === "development";
export const isProd = env === "production";

// ── Supabase — Encorpei Cardio ────────────────────────────────────
// Sem fallback de credencial real: o projeto é preenchido no .env
// (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
const URL_ENV = import.meta.env.VITE_SUPABASE_URL ?? "";
const KEY_ENV = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Há um banco configurado? Falso = o app só roda em modo demonstração. */
export const SUPABASE_CONFIGURADO = Boolean(URL_ENV && KEY_ENV);

/**
 * Placeholder quando falta configuração.
 *
 * `createClient("", "")` LANÇA na importação do módulo — e, como o cliente é
 * importado por praticamente toda tela, isso derrubava o app inteiro em tela
 * branca, inclusive a landing e o modo demonstração. Com o placeholder, o app
 * abre normalmente; qualquer chamada real falha em rede, o que é o
 * comportamento correto para "ainda não tem banco".
 */
export const SUPABASE_URL = URL_ENV || "https://placeholder.supabase.co";
export const SUPABASE_ANON_KEY = KEY_ENV || "public-anon-key-placeholder";
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
export const SUPABASE_FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`;

export const APP_NAME = "Encorpei Cardio";
export const APP_TAGLINE = "Seu coração acompanhado todos os dias";
export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? "1.0.0";

// Injetados pelo Vite no build (ver vite.config.ts → define)
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
export const BUILD_SHA = typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";
export const BUILD_TIME = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";

export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN ?? "";

/** Telefone de emergência exibido nas telas de risco agudo. */
export const EMERGENCIA_TELEFONE = "192";

if (!SUPABASE_CONFIGURADO) {
  console.warn(
    "[Config] Sem VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY: o app abre, mas só o modo demonstração funciona."
  );
}
