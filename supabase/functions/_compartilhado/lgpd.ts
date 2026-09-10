/**
 * ══════════════════════════════════════════════════════════════════════════
 * LGPD — o que é "todos os dados do titular", em um lugar só
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Exportar e excluir precisam responder à MESMA pergunta: onde mora o dado
 * desta pessoa. Se cada função tivesse a sua lista, elas divergiriam na
 * primeira tabela nova — e a divergência apareceria como uma exportação que
 * mostra dado que a exclusão não apaga, ou pior, o contrário.
 *
 * A lista abaixo foi conferida contra supabase/migrations/ (blocos
 * `create table`), não contra a memória de ninguém.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Tabelas com dado clínico do paciente, chaveadas por `patient_user_id`. */
export const TABELAS_PACIENTE = [
  "professional_patient_links",
  "cardio_targets",
  "registered_devices",
  "raw_device_data",
  "bp_readings",
  "hr_readings",
  "spo2_readings",
  "weight_readings",
  "glucose_readings",
  "sleep_records",
  "activity_records",
  "symptom_reports",
  "cardio_medications",
  "medication_intakes",
  "medication_titrations",
  "lab_results",
  "cardio_exams",
  "cardio_alerts",
  "appointments",
  "patient_messages",
  "professional_notes",
  "capacity_tests",
  "walk_sessions",
  "sodium_entries",
  "wellbeing_checkins",
  "qol_responses",
  "heart_age_snapshots",
  "education_progress",
  "caregiver_links",
  "monitoring_plan",
  "patient_goals",
] as const;

/** Tabelas chaveadas diretamente por `user_id`. */
export const TABELAS_USUARIO = [
  "profiles",
  "user_roles",
  "professional_profiles",
  "cardio_patients",
  "consent_records",
  "feedback",
  "beta_events",
] as const;

/**
 * Vínculos em que o titular aparece pelo OUTRO lado da relação.
 *
 * `caregiver_links` guarda paciente e cuidador; quem é cuidador de outra
 * pessoa tem dado pessoal ali sem ser o `patient_user_id`. Ignorar isso faria
 * a exportação omitir e a exclusão deixar para trás.
 */
export const TABELAS_SECUNDARIAS = [
  { tabela: "caregiver_links", coluna: "caregiver_user_id" },
] as const;

/**
 * Buckets onde os arquivos moram em `<user_id>/<arquivo>` (ver as políticas
 * de storage.objects em 20260911000000_integracao.sql). O prefixo é o próprio
 * uid, então listar e apagar a "pasta" do titular é determinístico.
 */
export const BUCKETS = ["exams", "feedback-attachments", "clinic-logos"] as const;

/**
 * Tabelas com dado do titular que NÃO são apagadas, e por quê.
 *
 * A LGPD (art. 16, I) permite a conservação necessária ao cumprimento de
 * obrigação legal ou regulatória. O registro de auditoria é exatamente isso:
 * é o que prova, depois, que a exclusão aconteceu e quem a executou. Apagá-lo
 * junto destruiria a prova do próprio ato.
 *
 * O ponto é declarar isso NO RELATÓRIO, não silenciosamente. Uma retenção
 * informada é conformidade; uma retenção escondida é o problema que esta
 * mudança inteira existe para corrigir.
 */
export const TABELAS_RETIDAS = [
  {
    tabela: "audit_logs",
    coluna: "patient_user_id",
    motivo:
      "Retido por obrigação legal (LGPD art. 16, I): é a prova de que a exclusão foi executada. " +
      "Não contém dado clínico, apenas o rastro das ações.",
  },
  {
    tabela: "data_requests",
    coluna: "user_id",
    motivo:
      "Retido como comprovante da própria solicitação (LGPD art. 18). O user_id vira nulo quando a conta é removida.",
  },
] as const;

/** Páginas de 1000 linhas: acima disso o PostgREST corta sozinho. */
export const PAGINA = 1000;

/** Teto por tabela na exportação. Ultrapassar é sinalizado, nunca escondido. */
export const TETO_EXPORTACAO = 50_000;

export interface FalhaTabela {
  tabela: string;
  etapa: string;
  motivo: string;
}

export function clienteServico(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !chave) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no ambiente da função.",
    );
  }
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Autentica pelo JWT do header Authorization.
 *
 * O uid NUNCA vem do corpo da requisição: com service-role na mão, aceitar um
 * id enviado pelo cliente transformaria estas funções em "apague a conta de
 * quem eu quiser".
 */
export async function usuarioDoToken(
  req: Request,
  admin: SupabaseClient,
): Promise<{ id: string; email: string | null }> {
  const header = req.headers.get("Authorization") ?? "";
  const jwt = header.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) throw new Error("nao_autenticado");

  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) throw new Error("nao_autenticado");
  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Cliente + identidade, ou a resposta de erro pronta.
 *
 * Devolve `Response` em vez de lançar para que quem chama faça
 * `if (r instanceof Response) return r` e siga com tudo já atribuído — sem
 * `let admin!: SupabaseClient` nem variável possivelmente indefinida.
 */
export async function autenticar(
  req: Request,
  acao: string,
): Promise<Response | { admin: SupabaseClient; uid: string; email: string | null }> {
  try {
    const admin = clienteServico();
    const u = await usuarioDoToken(req, admin);
    return { admin, uid: u.id, email: u.email };
  } catch (e) {
    const msg = mensagemDoErro(e);
    const naoAutenticado = msg === "nao_autenticado";
    return resposta(
      {
        status: "erro",
        mensagem: naoAutenticado
          ? `Sessão inválida ou ausente. Entre novamente para ${acao}.`
          : msg,
      },
      naoAutenticado ? 401 : 500,
    );
  }
}

export function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo, null, 2), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function mensagemDoErro(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}

/** Abre o registro em `data_requests`: prova de SOLICITAÇÃO, antes de agir. */
export async function abrirSolicitacao(
  admin: SupabaseClient,
  userId: string,
  tipo: "export" | "delete",
): Promise<string | null> {
  const { data, error } = await admin
    .from("data_requests")
    .insert({ user_id: userId, tipo, status: "running" })
    .select("id")
    .single();
  // Se nem o comprovante grava, seguimos — negar a exportação ao titular por
  // causa do livro de registro seria pior. Mas isso vira uma falha no
  // relatório, para não passar por execução limpa.
  if (error) return null;
  return data?.id ?? null;
}

/** Fecha o registro: prova de CONCLUSÃO, com o relatório inteiro anexado. */
export async function fecharSolicitacao(
  admin: SupabaseClient,
  id: string | null,
  status: "completed" | "failed",
  relatorio: unknown,
): Promise<void> {
  if (!id) return;
  await admin
    .from("data_requests")
    .update({
      status,
      concluido_em: new Date().toISOString(),
      relatorio: relatorio as Record<string, unknown>,
    })
    .eq("id", id);
}

/** Lista os arquivos do titular num bucket (metadados, nunca o conteúdo). */
export async function listarArquivos(
  admin: SupabaseClient,
  bucket: string,
  userId: string,
): Promise<
  | { ok: true; arquivos: { caminho: string; tamanho_bytes: number | null; criado_em: string | null; atualizado_em: string | null }[] }
  | { ok: false; motivo: string }
> {
  const arquivos: {
    caminho: string;
    tamanho_bytes: number | null;
    criado_em: string | null;
    atualizado_em: string | null;
  }[] = [];

  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage
      .from(bucket)
      .list(userId, { limit: PAGINA, offset });
    if (error) return { ok: false, motivo: error.message };
    if (!data || data.length === 0) break;

    for (const f of data) {
      // `list` devolve "pastas" como itens sem id; ignoramos, não são objetos.
      if (!f.id) continue;
      arquivos.push({
        caminho: `${userId}/${f.name}`,
        tamanho_bytes: (f.metadata?.size as number | undefined) ?? null,
        criado_em: f.created_at ?? null,
        atualizado_em: f.updated_at ?? null,
      });
    }

    if (data.length < PAGINA) break;
    offset += PAGINA;
  }

  return { ok: true, arquivos };
}
