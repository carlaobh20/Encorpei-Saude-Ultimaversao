/**
 * ══════════════════════════════════════════════════════════════════════════
 * excluir-minha-conta — LGPD art. 18, VI (eliminação)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * O que estava errado antes
 * -------------------------
 * A exclusão rodava no navegador e classificava cada tabela como "apagada"
 * quando o DELETE não retornava erro. Só que um DELETE barrado pela RLS NÃO É
 * ERRO: ele afeta zero linhas e retorna sucesso. Como o paciente só tem
 * permissão de leitura em cardio_targets (hoje do médico), cardio_alerts e
 * patient_messages (que sequer tem política de DELETE), essas três tabelas
 * eram reportadas como apagadas e continuavam intactas. Além disso o usuário
 * em `auth.users` nunca era removido e os arquivos no Storage ficavam lá.
 *
 * Como é agora
 * ------------
 *   1. exige `{ "confirmacao": "EXCLUIR" }` no corpo;
 *   2. autentica pelo JWT — o uid nunca vem do corpo;
 *   3. registra a SOLICITAÇÃO em data_requests, antes de destruir nada;
 *   4. apaga os arquivos do Storage;
 *   5. apaga as linhas de todas as tabelas contando as linhas afetadas;
 *   6. remove o usuário de auth.users via admin.deleteUser;
 *   7. devolve um relatório verificável — quantas linhas por tabela, o que
 *      falhou e o que foi retido por obrigação legal.
 *
 * Contagem é o ponto central: "apagado: true" não prova nada; "bp_readings:
 * 1.482 linhas removidas" prova. E `linhas: 0` num paciente que tinha dados
 * fica visível no relatório em vez de virar um "sucesso".
 */

import {
  BUCKETS, PAGINA, TABELAS_PACIENTE, TABELAS_RETIDAS, TABELAS_SECUNDARIAS,
  TABELAS_USUARIO, abrirSolicitacao, autenticar, cors, fecharSolicitacao,
  listarArquivos, mensagemDoErro, resposta,
  type FalhaTabela,
} from "../_compartilhado/lgpd.ts";

const PALAVRA_CONFIRMACAO = "EXCLUIR";

/**
 * A ordem importa: filhos antes dos pais.
 *
 * A maioria das FKs aponta para auth.users com `on delete cascade`, então o
 * passo 6 limparia o resto sozinho. Não confiamos nisso: cascade não devolve
 * contagem, e sem contagem não há relatório verificável. Apagamos
 * explicitamente e conferimos.
 *
 * Uma exceção consciente: se o titular for PROFISSIONAL, os vínculos dele com
 * outros pacientes moram em professional_patient_links.professional_id, que
 * referencia professional_profiles(id) com `on delete cascade`. Eles caem
 * quando professional_profiles é apagado, no grupo user_id — por isso a ordem
 * paciente → usuário importa.
 */
const ORDEM_EXCLUSAO: { tabela: string; coluna: string; rotulo: string }[] = [
  ...TABELAS_SECUNDARIAS.map((s) => ({
    tabela: s.tabela, coluna: s.coluna, rotulo: `${s.tabela} (${s.coluna})`,
  })),
  ...TABELAS_PACIENTE.map((t) => ({ tabela: t, coluna: "patient_user_id", rotulo: t })),
  // cardio_patients e profiles vêm por último dentro do grupo user_id: são os
  // "pais" que o restante referencia.
  ...TABELAS_USUARIO.map((t) => ({ tabela: t, coluna: "user_id", rotulo: t })),
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const t0 = Date.now();

  // ── 1. Confirmação explícita ─────────────────────────────────────────────
  // A dupla confirmação da tela é UI e some com um fetch direto. A função
  // precisa da sua própria trava: exclusão é irreversível.
  let corpo: { confirmacao?: unknown } = {};
  try {
    corpo = await req.json();
  } catch {
    corpo = {};
  }
  if (corpo?.confirmacao !== PALAVRA_CONFIRMACAO) {
    return resposta(
      {
        status: "erro",
        mensagem: `Confirmação ausente. Envie { "confirmacao": "${PALAVRA_CONFIRMACAO}" } para prosseguir.`,
      },
      400,
    );
  }

  // ── 2. Autenticação ──────────────────────────────────────────────────────
  const auth = await autenticar(req, "excluir sua conta");
  if (auth instanceof Response) return auth;
  const { admin, uid, email } = auth;

  // ── 3. Prova de solicitação ──────────────────────────────────────────────
  const solicitacaoId = await abrirSolicitacao(admin, uid, "delete");

  const falhas: FalhaTabela[] = [];
  const linhasPorTabela: Record<string, number> = {};
  const arquivosApagados: Record<string, number> = {};

  if (!solicitacaoId) {
    falhas.push({
      tabela: "data_requests",
      etapa: "registro_da_solicitacao",
      motivo: "Não foi possível registrar o comprovante da solicitação.",
    });
  }

  // Auditoria ANTES de destruir: depois do delete não existe mais vínculo
  // para registrar, e a RPC deriva o autor da sessão — que também some.
  try {
    await admin.rpc("log_audit_event", {
      p_action: "lgpd:conta_excluida",
      p_description: "Titular solicitou exclusão definitiva da conta (LGPD art. 18, VI)",
      p_risk_level: "high",
      p_patient_user_id: uid,
      p_resource_type: "conta",
      p_resource_id: uid,
      p_metadata: { solicitacao_id: solicitacaoId, email },
    });
  } catch {
    // Auditoria não pode bloquear o direito do titular — mas a falha aparece.
    falhas.push({
      tabela: "audit_logs",
      etapa: "auditoria_previa",
      motivo: "Não foi possível registrar a auditoria prévia da exclusão.",
    });
  }

  // ── 4. Storage ───────────────────────────────────────────────────────────
  // Antes das tabelas: cardio_exams guarda o caminho do arquivo. Apagar a
  // linha primeiro deixaria o arquivo órfão e invisível.
  for (const bucket of BUCKETS) {
    const listagem = await listarArquivos(admin, bucket, uid);
    if (!listagem.ok) {
      arquivosApagados[bucket] = -1;
      falhas.push({ tabela: `storage:${bucket}`, etapa: "listagem", motivo: listagem.motivo });
      continue;
    }
    if (listagem.arquivos.length === 0) {
      arquivosApagados[bucket] = 0;
      continue;
    }

    const caminhos = listagem.arquivos.map((a) => a.caminho);
    let apagados = 0;
    for (let i = 0; i < caminhos.length; i += PAGINA) {
      const lote = caminhos.slice(i, i + PAGINA);
      const { data, error } = await admin.storage.from(bucket).remove(lote);
      if (error) {
        falhas.push({ tabela: `storage:${bucket}`, etapa: "remocao", motivo: error.message });
        break;
      }
      apagados += data?.length ?? 0;
    }
    arquivosApagados[bucket] = apagados;

    // Conferência explícita: `remove` pode retornar menos do que foi pedido.
    if (apagados < caminhos.length) {
      falhas.push({
        tabela: `storage:${bucket}`,
        etapa: "conferencia",
        motivo: `${caminhos.length} arquivos listados, ${apagados} removidos.`,
      });
    }
  }

  // ── 5. Tabelas ───────────────────────────────────────────────────────────
  for (const alvo of ORDEM_EXCLUSAO) {
    try {
      // `count: 'exact'` é o que transforma "não deu erro" em prova. Com
      // service-role a RLS não filtra, então zero linhas aqui significa
      // mesmo zero linhas — e não "o banco recusou em silêncio".
      const { count, error } = await admin
        .from(alvo.tabela)
        .delete({ count: "exact" })
        .eq(alvo.coluna, uid);
      if (error) throw new Error(error.message);
      linhasPorTabela[alvo.rotulo] = count ?? 0;
    } catch (e) {
      linhasPorTabela[alvo.rotulo] = -1;
      falhas.push({ tabela: alvo.rotulo, etapa: "exclusao", motivo: mensagemDoErro(e) });
    }
  }

  // ── 6. auth.users ────────────────────────────────────────────────────────
  // O passo que só service-role consegue fazer — e que o código do navegador
  // nunca fez. Sem ele, a conta de login continua existindo e o titular
  // consegue entrar de novo depois de "excluir tudo".
  let usuarioRemovido = false;
  try {
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);
    usuarioRemovido = true;
  } catch (e) {
    falhas.push({ tabela: "auth.users", etapa: "exclusao", motivo: mensagemDoErro(e) });
  }

  const totalLinhas = Object.values(linhasPorTabela)
    .filter((n) => n > 0)
    .reduce((a, b) => a + b, 0);
  const totalArquivos = Object.values(arquivosApagados)
    .filter((n) => n > 0)
    .reduce((a, b) => a + b, 0);

  const concluido = falhas.length === 0 && usuarioRemovido;

  const relatorio = {
    executado_em: new Date().toISOString(),
    usuario_id: uid,
    email,
    solicitacao_id: solicitacaoId,
    status: concluido ? "concluido" : "parcial",
    mensagem: concluido
      ? "Conta e dados removidos em definitivo."
      : "Exclusão PARCIAL. Os itens em `falhas` não puderam ser removidos — sua conta ainda pode ter dados. "
        + "Guarde o número da solicitação e procure o suporte.",
    usuario_auth_removido: usuarioRemovido,
    total_linhas_removidas: totalLinhas,
    total_arquivos_removidos: totalArquivos,
    linhas_por_tabela: linhasPorTabela,
    arquivos_por_bucket: arquivosApagados,
    retencoes: TABELAS_RETIDAS.map((r) => ({ tabela: r.tabela, motivo: r.motivo })),
    falhas,
    duracao_ms: Date.now() - t0,
  };

  await fecharSolicitacao(
    admin,
    solicitacaoId,
    concluido ? "completed" : "failed",
    relatorio,
  );

  // 200 mesmo quando parcial: o corpo é o relatório, e o cliente precisa
  // conseguir LER o relatório para mostrar o que falhou. Um 500 com corpo de
  // erro genérico devolveria menos informação ao titular, não mais.
  return resposta(relatorio);
});
