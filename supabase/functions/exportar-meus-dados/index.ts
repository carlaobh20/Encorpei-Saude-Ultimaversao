/**
 * ══════════════════════════════════════════════════════════════════════════
 * exportar-meus-dados — LGPD art. 18, II e V (acesso e portabilidade)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * A versão anterior rodava no navegador, sob a RLS do paciente, e fazia
 * `if (!error && rows) data[table] = rows`. Duas coisas erradas de uma vez:
 * uma tabela que falhava simplesmente NÃO APARECIA no JSON, e uma tabela que
 * a RLS filtrava aparecia vazia. Nos dois casos o arquivo baixado era
 * indistinguível de um arquivo completo. Uma exportação incompleta que se
 * anuncia como completa é pior do que exportação nenhuma: o titular confere
 * um dado que não existe e conclui que o app não guarda o que guarda.
 *
 * Aqui: service-role (a RLS não filtra nada), TODA tabela entra no manifesto
 * mesmo quando falha, e a falha vem com o motivo. Nunca devolvemos sucesso
 * parcial disfarçado de sucesso — se alguma tabela falhou, `status` é
 * 'parcial' e a lista `falhas` diz exatamente qual e por quê.
 */

import {
  BUCKETS, PAGINA, TABELAS_PACIENTE, TABELAS_RETIDAS, TABELAS_SECUNDARIAS,
  TABELAS_USUARIO, TETO_EXPORTACAO, abrirSolicitacao, autenticar, cors,
  fecharSolicitacao, listarArquivos, mensagemDoErro, resposta,
  type FalhaTabela,
} from "../_compartilhado/lgpd.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ResultadoTabela {
  linhas: Record<string, unknown>[];
  truncado: boolean;
}

/**
 * Lê uma tabela inteira, paginando.
 *
 * O PostgREST corta em 1000 linhas por requisição. Sem paginação, um paciente
 * com pulseira (hr_readings a cada minuto) exportaria menos de um dia e não
 * saberia. Se ainda assim batermos no teto, `truncado` vai para o manifesto.
 */
async function lerTudo(
  admin: SupabaseClient,
  tabela: string,
  coluna: string,
  uid: string,
): Promise<ResultadoTabela> {
  const linhas: Record<string, unknown>[] = [];
  let inicio = 0;

  for (;;) {
    const { data, error } = await admin
      .from(tabela)
      .select("*")
      .eq(coluna, uid)
      .range(inicio, inicio + PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    linhas.push(...(data as Record<string, unknown>[]));
    if (data.length < PAGINA) break;
    if (linhas.length >= TETO_EXPORTACAO) return { linhas, truncado: true };
    inicio += PAGINA;
  }

  return { linhas, truncado: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const t0 = Date.now();

  const auth = await autenticar(req, "exportar seus dados");
  if (auth instanceof Response) return auth;
  const { admin, uid, email } = auth;

  // Prova de SOLICITAÇÃO antes de qualquer leitura: se a execução morrer no
  // meio, ainda existe registro de que o titular pediu.
  const solicitacaoId = await abrirSolicitacao(admin, uid, "export");

  const dados: Record<string, unknown[]> = {};
  const contagem: Record<string, number> = {};
  const consultadas: string[] = [];
  const truncadas: string[] = [];
  const falhas: FalhaTabela[] = [];

  if (!solicitacaoId) {
    falhas.push({
      tabela: "data_requests",
      etapa: "registro_da_solicitacao",
      motivo: "Não foi possível registrar o comprovante da solicitação.",
    });
  }

  const alvos: { tabela: string; coluna: string; chave: string }[] = [
    ...TABELAS_PACIENTE.map((t) => ({ tabela: t, coluna: "patient_user_id", chave: t })),
    ...TABELAS_USUARIO.map((t) => ({ tabela: t, coluna: "user_id", chave: t })),
    // Chave distinta para não sobrescrever a leitura primária da mesma tabela.
    ...TABELAS_SECUNDARIAS.map((s) => ({
      tabela: s.tabela, coluna: s.coluna, chave: `${s.tabela}__${s.coluna}`,
    })),
    ...TABELAS_RETIDAS.map((r) => ({ tabela: r.tabela, coluna: r.coluna, chave: r.tabela })),
  ];

  for (const alvo of alvos) {
    consultadas.push(alvo.chave);
    try {
      const { linhas, truncado } = await lerTudo(admin, alvo.tabela, alvo.coluna, uid);
      dados[alvo.chave] = linhas;
      contagem[alvo.chave] = linhas.length;
      if (truncado) truncadas.push(alvo.chave);
    } catch (e) {
      // A tabela CONTINUA no manifesto, marcada como falha. O que não pode
      // acontecer é ela desaparecer do JSON como se não existisse.
      contagem[alvo.chave] = -1;
      falhas.push({ tabela: alvo.chave, etapa: "leitura", motivo: mensagemDoErro(e) });
    }
  }

  // ── Storage: metadados dos arquivos, não o conteúdo ──────────────────────
  // O conteúdo (PDF de exame, foto) pode ter centenas de MB e não cabe num
  // JSON de resposta. O titular precisa saber O QUE existe; o download de
  // cada arquivo continua disponível pela tela de exames.
  const arquivos: Record<string, unknown[]> = {};
  for (const bucket of BUCKETS) {
    const r = await listarArquivos(admin, bucket, uid);
    if (r.ok) {
      arquivos[bucket] = r.arquivos;
      contagem[`storage:${bucket}`] = r.arquivos.length;
    } else {
      contagem[`storage:${bucket}`] = -1;
      falhas.push({ tabela: `storage:${bucket}`, etapa: "listagem", motivo: r.motivo });
    }
  }

  const status = falhas.length === 0 ? "completo" : "parcial";

  const manifesto = {
    // O manifesto vem NO TOPO de propósito: quem abre o arquivo lê primeiro
    // o que foi consultado e o que falhou, antes de acreditar nos dados.
    gerado_em: new Date().toISOString(),
    usuario_id: uid,
    email,
    solicitacao_id: solicitacaoId,
    status,
    mensagem: status === "completo"
      ? "Exportação completa: todas as tabelas foram lidas com sucesso."
      : "Exportação PARCIAL. As tabelas listadas em `falhas` não puderam ser lidas — "
        + "o conteúdo abaixo não representa a totalidade dos seus dados.",
    tabelas_consultadas: consultadas,
    contagem_por_tabela: contagem,
    tabelas_truncadas: truncadas,
    teto_por_tabela: TETO_EXPORTACAO,
    falhas,
    retencoes: TABELAS_RETIDAS.map((r) => ({ tabela: r.tabela, motivo: r.motivo })),
    duracao_ms: Date.now() - t0,
  };

  const relatorio = { ...manifesto };
  await fecharSolicitacao(
    admin,
    solicitacaoId,
    status === "completo" ? "completed" : "failed",
    relatorio,
  );

  return resposta({ manifesto, dados, arquivos });
});
