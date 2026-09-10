/**
 * ══════════════════════════════════════════════════════════════════════════
 * LGPD — Portabilidade e exclusão de dados (art. 18)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Este arquivo NÃO faz mais o trabalho. Ele chama duas edge functions e
 * mostra o relatório que elas devolvem.
 *
 * Por que a mudança
 * -----------------
 * A versão anterior exportava e excluía direto do navegador, sob a RLS do
 * paciente. Auditoria mostrou três buracos, todos silenciosos:
 *
 *   · a exportação fazia `if (!error && rows)` — tabela que falhava sumia do
 *     JSON, e o arquivo baixado ficava indistinguível de um arquivo completo;
 *   · a exclusão tocava tabelas em que o paciente só tem SELECT
 *     (cardio_targets, cardio_alerts, patient_messages). Um DELETE barrado
 *     por RLS não é erro: afeta zero linhas e "dá certo". O app dizia
 *     "apagado" e nada tinha sido apagado;
 *   · `auth.users` e os arquivos no Storage nunca eram tocados — dava para
 *     entrar de novo depois de excluir a conta.
 *
 * Nada disso é corrigível no cliente: exige service-role. Daí as funções
 * `exportar-meus-dados` e `excluir-minha-conta`.
 *
 * A regra que orienta o arquivo inteiro: sucesso parcial nunca se apresenta
 * como sucesso. Quem chama recebe o relatório e o estado real.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from "@/integrations/supabase/client";

/** Palavra que a edge function exige no corpo — a trava do servidor. */
export const CONFIRMACAO_EXCLUSAO = "EXCLUIR";

export interface FalhaLgpd {
  tabela: string;
  etapa: string;
  motivo: string;
}

/** Manifesto que vem no topo do JSON exportado. */
export interface ManifestoExportacao {
  gerado_em: string;
  usuario_id: string;
  email: string | null;
  solicitacao_id: string | null;
  status: "completo" | "parcial";
  mensagem: string;
  tabelas_consultadas: string[];
  contagem_por_tabela: Record<string, number>;
  tabelas_truncadas: string[];
  teto_por_tabela: number;
  falhas: FalhaLgpd[];
  retencoes: { tabela: string; motivo: string }[];
  duracao_ms: number;
}

export interface RespostaExportacao {
  manifesto: ManifestoExportacao;
  dados: Record<string, unknown[]>;
  arquivos: Record<string, unknown[]>;
}

export interface RelatorioExclusao {
  executado_em: string;
  usuario_id: string;
  email: string | null;
  solicitacao_id: string | null;
  status: "concluido" | "parcial";
  mensagem: string;
  usuario_auth_removido: boolean;
  total_linhas_removidas: number;
  total_arquivos_removidos: number;
  linhas_por_tabela: Record<string, number>;
  arquivos_por_bucket: Record<string, number>;
  retencoes: { tabela: string; motivo: string }[];
  falhas: FalhaLgpd[];
  duracao_ms: number;
}

/**
 * Traduz o erro de `functions.invoke` para algo legível.
 *
 * `FunctionsHttpError` esconde o corpo da resposta atrás de `context`; sem
 * abrir esse corpo o usuário só veria "Edge Function returned a non-2xx
 * status code", que não diz nada sobre o que aconteceu com os dados dele.
 */
async function mensagemDaFuncao(erro: unknown, padrao: string): Promise<string> {
  const contexto = (erro as { context?: Response } | null)?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.json();
      if (corpo?.mensagem) return String(corpo.mensagem);
    } catch {
      // Corpo não-JSON: cai no padrão.
    }
  }
  if (erro instanceof Error && erro.message) return erro.message;
  return padrao;
}

/**
 * Chama `exportar-meus-dados`.
 *
 * NÃO lança quando a exportação vem parcial: o titular tem direito ao que foi
 * possível reunir. Quem chama decide o que fazer olhando
 * `manifesto.status` — mas não pode dizer "exportado com sucesso" sem olhar.
 */
export async function solicitarExportacao(): Promise<RespostaExportacao> {
  const { data, error } = await supabase.functions.invoke<RespostaExportacao>(
    "exportar-meus-dados",
    { body: {} },
  );

  if (error) {
    throw new Error(await mensagemDaFuncao(error, "Não foi possível exportar agora."));
  }
  if (!data?.manifesto) {
    throw new Error("A exportação voltou sem manifesto — não dá para confirmar o que foi lido.");
  }
  return data;
}

/** Dispara o download do JSON no navegador. */
export function downloadJson(payload: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta e baixa em um passo. Devolve o manifesto para a tela mostrar a
 * cobertura real — inclusive quando ela é parcial.
 *
 * O arquivo baixado carrega o manifesto DENTRO dele: se o titular guardar o
 * JSON por um ano e for conferir, a informação de que a exportação foi
 * parcial está no próprio arquivo, não só num toast que já sumiu.
 */
export async function exportarMeusDados(): Promise<ManifestoExportacao> {
  const resposta = await solicitarExportacao();
  const carimbo = new Date().toISOString().slice(0, 10);
  const sufixo = resposta.manifesto.status === "parcial" ? "-PARCIAL" : "";
  downloadJson(resposta, `encorpei-cardio-meus-dados-${carimbo}${sufixo}.json`);
  return resposta.manifesto;
}

/**
 * Chama `excluir-minha-conta`.
 *
 * A função responde 200 mesmo quando a exclusão sai parcial, de propósito: o
 * corpo É o relatório, e o titular precisa poder ler o que ficou para trás.
 * Por isso o retorno normal aqui pode ter `status: 'parcial'` — quem chama
 * TEM que checar antes de dizer que a conta foi apagada.
 */
export async function excluirMinhaConta(): Promise<RelatorioExclusao> {
  const { data, error } = await supabase.functions.invoke<RelatorioExclusao>(
    "excluir-minha-conta",
    { body: { confirmacao: CONFIRMACAO_EXCLUSAO } },
  );

  if (error) {
    throw new Error(await mensagemDaFuncao(error, "Não foi possível excluir agora."));
  }
  if (!data?.status) {
    throw new Error("A exclusão voltou sem relatório — não dá para confirmar o que foi apagado.");
  }
  return data;
}

/**
 * Histórico de solicitações do titular (data_requests).
 *
 * É o que separa "solicitado" de "concluído" na tela: a linha nasce quando o
 * pedido chega e só ganha `concluido_em` quando termina. Sem isso, uma
 * execução interrompida não deixaria vestígio nenhum.
 */
export interface SolicitacaoLgpd {
  id: string;
  tipo: "export" | "delete";
  status: "requested" | "running" | "completed" | "failed";
  solicitado_em: string;
  concluido_em: string | null;
  relatorio: Record<string, unknown> | null;
}

export async function listarSolicitacoes(userId: string): Promise<SolicitacaoLgpd[]> {
  // `as any`: data_requests nasce na migração 20260914000000_lgpd.sql e ainda
  // não está em src/integrations/supabase/types.ts (escrito à mão). Some
  // quando os tipos forem regerados.
  const { data, error } = await (supabase as any)
    .from("data_requests")
    .select("id, tipo, status, solicitado_em, concluido_em, relatorio")
    .eq("user_id", userId)
    .order("solicitado_em", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as SolicitacaoLgpd[];
}
