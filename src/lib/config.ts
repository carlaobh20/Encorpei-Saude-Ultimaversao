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

// ══════════════════════════════════════════════════════════════════════
// SUPABASE — por que o projeto padrão está escrito aqui, no código
// ══════════════════════════════════════════════════════════════════════
//
// Estas duas constantes PARECEM segredo e não são. A chave "publishable"
// (anon) é desenhada para ficar pública: ela viaja dentro do pacote de
// JavaScript que todo navegador baixa. Qualquer pessoa lê o valor com um
// `curl` na URL do site — com ou sem variável de ambiente, o resultado
// publicado é byte por byte o mesmo.
//
// O que protege o banco NÃO é esconder esta chave: é a RLS. Com ela, a chave
// anônima só alcança as linhas que as políticas permitem — e este projeto tem
// RLS em todas as 41 tabelas, verificada contra banco real.
//
// Então por que escrever aqui em vez de deixar só na variável de ambiente?
// Porque a variável de ambiente é um passo manual, invisível, fora do
// repositório, que precisa ser repetido a cada novo ambiente — e que, quando
// esquecido, não quebra: o app SOBE, bonito, rodando em modo demonstração,
// parecendo pronto. Foi exatamente o que aconteceu: o banco ficou dias no ar
// sem ninguém conseguir se cadastrar, porque o site publicado apontava para
// `placeholder.supabase.co`. Um esquecimento silencioso que parece sucesso é
// pior que um erro barulhento.
//
// A variável de ambiente CONTINUA valendo e tem precedência: é assim que um
// ambiente de teste aponta para outro banco sem tocar no código. O valor
// abaixo é só o destino padrão de produção.
//
// O QUE NUNCA PODE VIR PARA CÁ: a `service_role`. Essa sim é segredo — ela
// ignora a RLS inteira. Vive só nas Edge Functions, do lado do servidor.

const PROJETO_PADRAO = {
  url: "https://rmodoqflmabzfsqieiln.supabase.co",
  chave: "sb_publishable_47xoBuULGGAehheD2sAZ0w_KBqb_vMh",
  id: "rmodoqflmabzfsqieiln",
} as const;

const URL_ENV = import.meta.env.VITE_SUPABASE_URL || PROJETO_PADRAO.url;
const KEY_ENV = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || PROJETO_PADRAO.chave;

/** Há um banco configurado? Falso = o app só roda em modo demonstração. */
export const SUPABASE_CONFIGURADO = Boolean(URL_ENV && KEY_ENV);

/** De onde veio a configuração — aparece na tela de diagnóstico (/status). */
export const ORIGEM_DA_CONFIGURACAO: "ambiente" | "padrao" =
  import.meta.env.VITE_SUPABASE_URL ? "ambiente" : "padrao";

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
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || PROJETO_PADRAO.id;
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
    "[Config] Sem banco configurado: o app abre, mas só o modo demonstração funciona."
  );
} else if (ORIGEM_DA_CONFIGURACAO === "padrao" && isProd) {
  // Não é erro — é o caminho esperado. O aviso existe para que, num ambiente
  // de teste criado no futuro, ninguém escreva em produção sem perceber.
  console.info("[Config] Usando o projeto Supabase padrão (nenhuma variável de ambiente definida).");
}
