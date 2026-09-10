/**
 * Seção "Privacidade e dados" da conta do paciente.
 * Entrega os direitos do titular (LGPD art. 18):
 *   - Exportar meus dados (JSON)
 *   - Excluir minha conta (hard-delete com confirmação dupla)
 *
 * O trabalho real acontece nas edge functions `exportar-meus-dados` e
 * `excluir-minha-conta` (service-role). Esta tela só pede, mostra o relatório
 * e — o ponto principal — distingue SOLICITADO de CONCLUÍDO.
 *
 * Antes ela dizia "Seus dados foram apagados em definitivo" com base em
 * `failed.length === 0`, e `failed` estava vazio porque os DELETEs barrados
 * pela RLS retornavam sucesso afetando zero linhas. A tela afirmava um fato
 * que não tinha como conhecer. Agora ela mostra o que o servidor contou:
 * quantas linhas por tabela, quantos arquivos, e o que falhou.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  exportarMeusDados,
  excluirMinhaConta,
  type ManifestoExportacao,
  type RelatorioExclusao,
} from "@/lib/dataPrivacy";

/* eslint-disable @typescript-eslint/no-explicit-any */

const CONFIRM_WORD = "APAGAR";

/**
 * Estágio do pedido. "solicitado" existe porque o servidor pode demorar ou
 * falhar no meio: enquanto não voltou relatório, a tela não tem o direito de
 * dizer que terminou.
 */
type Estagio = "parado" | "solicitado" | "concluido" | "parcial";

/** Só as tabelas que realmente tinham linha entram no resumo visível. */
function linhasComDado(mapa: Record<string, number>): [string, number][] {
  return Object.entries(mapa)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
}

function ListaDeFalhas({ falhas }: { falhas: { tabela: string; etapa: string; motivo: string }[] }) {
  if (falhas.length === 0) return null;
  return (
    <div className="mt-3 rounded-2xl bg-error-bg border border-error/30 p-3">
      <p className="text-[11.5px] font-semibold text-error flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
        {falhas.length === 1 ? "1 item não foi concluído" : `${falhas.length} itens não foram concluídos`}
      </p>
      <ul className="mt-1.5 space-y-1">
        {falhas.map((f, i) => (
          <li key={i} className="text-[11px] text-muted-foreground leading-snug">
            <span className="font-medium text-foreground">{f.tabela}</span> ({f.etapa}): {f.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DataPrivacySection() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();

  const [estagioExport, setEstagioExport] = useState<Estagio>("parado");
  const [manifesto, setManifesto] = useState<ManifestoExportacao | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [estagioDelete, setEstagioDelete] = useState<Estagio>("parado");
  const [relatorio, setRelatorio] = useState<RelatorioExclusao | null>(null);

  const exportando = estagioExport === "solicitado";
  const excluindo = estagioDelete === "solicitado";

  const handleExport = async () => {
    if (!user?.id) return;
    setEstagioExport("solicitado");
    setManifesto(null);
    try {
      const m = await exportarMeusDados();
      setManifesto(m);
      if (m.status === "parcial") {
        // Não é sucesso. O arquivo baixou, mas incompleto — e o usuário
        // precisa saber disso ANTES de arquivar o JSON achando que é a
        // cópia integral dos dados dele.
        setEstagioExport("parcial");
        toast.warning("Exportação parcial: veja abaixo o que não pôde ser lido.");
      } else {
        setEstagioExport("concluido");
        toast.success("Exportação concluída");
      }
    } catch (e: any) {
      setEstagioExport("parado");
      toast.error(e?.message ?? "Não foi possível exportar agora");
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    setEstagioDelete("solicitado");
    setRelatorio(null);
    try {
      const r = await excluirMinhaConta();
      setRelatorio(r);

      if (r.status === "parcial") {
        // A conta pode ainda existir. Não desloga e não navega: o usuário
        // precisa ver o relatório e ter como voltar ao suporte.
        setEstagioDelete("parcial");
        setDeleteOpen(false);
        toast.error("Exclusão incompleta. Veja o relatório abaixo.");
        return;
      }

      setEstagioDelete("concluido");
      setDeleteOpen(false);
      toast.success(
        `Conta apagada: ${r.total_linhas_removidas} registros e ${r.total_arquivos_removidos} arquivos removidos.`,
      );
      await signOut?.();
      navigate("/landing");
    } catch (e: any) {
      setEstagioDelete("parado");
      toast.error(e?.message ?? "Não foi possível excluir agora");
    }
  };

  return (
    <section id="privacidade" className="rounded-3xl bg-card border border-border shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h3 className="font-display text-lg font-medium text-foreground tracking-tight">
          Privacidade e dados
        </h3>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-4">
        Você é dono dos seus dados. A qualquer momento pode baixar uma cópia ou apagar tudo em definitivo.
      </p>

      <div className="space-y-2.5">
        <button
          onClick={handleExport}
          disabled={exportando}
          className="w-full rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3.5 hover:border-border-strong transition-colors text-left disabled:opacity-60"
        >
          <div className="h-10 w-10 rounded-2xl bg-cardio-50 grid place-items-center text-primary shrink-0">
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.75} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Exportar meus dados</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              {exportando
                ? "Solicitação enviada — reunindo seus dados no servidor…"
                : "Baixa um arquivo com tudo que guardamos sobre você"}
            </p>
          </div>
        </button>

        {/* Relatório da exportação: cobertura real, não "deu certo". */}
        {manifesto && (
          <div className="rounded-2xl bg-card border border-border p-4">
            <p className="text-[11.5px] font-semibold text-foreground flex items-center gap-1.5">
              {manifesto.status === "completo" ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2} />
                  Exportação concluída
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-error" strokeWidth={2} />
                  Exportação parcial
                </>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{manifesto.mensagem}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Solicitado e concluído em {new Date(manifesto.gerado_em).toLocaleString("pt-BR")} ·{" "}
              {manifesto.tabelas_consultadas.length} tabelas consultadas ·{" "}
              {linhasComDado(manifesto.contagem_por_tabela).reduce((s, [, n]) => s + n, 0)} registros
              {manifesto.solicitacao_id && <> · protocolo {manifesto.solicitacao_id.slice(0, 8)}</>}
            </p>

            {manifesto.tabelas_truncadas.length > 0 && (
              <p className="text-[11px] text-warning mt-1.5 leading-snug">
                Limite de {manifesto.teto_por_tabela.toLocaleString("pt-BR")} registros atingido em:{" "}
                {manifesto.tabelas_truncadas.join(", ")}. Fale com o suporte para receber o restante.
              </p>
            )}

            {manifesto.retencoes.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-snug">
                Retido por obrigação legal: {manifesto.retencoes.map((r) => r.tabela).join(", ")}.
              </p>
            )}

            <ListaDeFalhas falhas={manifesto.falhas} />
          </div>
        )}

        <button
          onClick={() => { setConfirmText(""); setRelatorio(null); setEstagioDelete("parado"); setDeleteOpen(true); }}
          className="w-full rounded-2xl bg-card border border-error/30 shadow-card p-4 flex items-center gap-3.5 hover:bg-error-bg transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-2xl bg-error-bg grid place-items-center text-error shrink-0">
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-error">Excluir minha conta</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Apaga todos os seus dados em definitivo</p>
          </div>
        </button>

        {/* Só aparece quando a exclusão saiu PARCIAL: no caso feliz o usuário
            já foi deslogado e a tela nem existe mais. */}
        {relatorio && estagioDelete === "parcial" && (
          <div className="rounded-2xl bg-card border border-error/30 p-4">
            <p className="text-[11.5px] font-semibold text-error flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
              Exclusão incompleta — sua conta ainda existe
            </p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{relatorio.mensagem}</p>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Solicitado em {new Date(relatorio.executado_em).toLocaleString("pt-BR")} ·{" "}
              {relatorio.total_linhas_removidas} registros e {relatorio.total_arquivos_removidos} arquivos removidos ·
              login {relatorio.usuario_auth_removido ? "removido" : "ainda ativo"}
              {relatorio.solicitacao_id && <> · protocolo {relatorio.solicitacao_id.slice(0, 8)}</>}
            </p>

            {linhasComDado(relatorio.linhas_por_tabela).length > 0 && (
              <details className="mt-2">
                <summary className="text-[11px] text-primary cursor-pointer">Ver detalhe por tabela</summary>
                <ul className="mt-1.5 space-y-0.5">
                  {linhasComDado(relatorio.linhas_por_tabela).map(([tabela, n]) => (
                    <li key={tabela} className="text-[11px] text-muted-foreground">
                      {tabela}: {n} {n === 1 ? "registro" : "registros"}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <ListaDeFalhas falhas={relatorio.falhas} />
          </div>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(aberto) => { if (!excluindo) setDeleteOpen(aberto); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-medium tracking-tight">
              Apagar sua conta em definitivo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              {/* O texto antigo dizia "gestação" — resíduo do app de gestantes
                  que originou este projeto. Aqui o que se apaga é registro
                  cardiológico. */}
              Isso remove para sempre todos os seus registros: pressão, frequência cardíaca,
              peso, remédios, sintomas, exames, consultas e mensagens.{" "}
              <strong className="text-foreground">Não há como desfazer.</strong>
              <br /><br />
              Para confirmar, digite <strong className="text-error">{CONFIRM_WORD}</strong> abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="h-11 rounded-2xl"
            autoFocus
          />

          {excluindo && (
            <p className="text-[11.5px] text-muted-foreground">
              Solicitação enviada. Apagando arquivos, registros e o seu login — não feche esta tela.
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={confirmText.trim() !== CONFIRM_WORD || excluindo}
              className="rounded-2xl bg-error hover:bg-error/90 text-white"
            >
              {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
