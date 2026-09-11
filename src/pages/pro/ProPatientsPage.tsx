/**
 * PACIENTES — a carteira completa.
 *
 * Duas apresentações do MESMO dado, escolhidas por largura:
 *
 * · `lg:` para cima → TABELA, com colunas alinhadas (nome, motivo, última
 *   medida, origem/período, adesão autorrelatada, ação). O médico lê a carteira
 *   verticalmente, comparando pacientes na mesma coluna — é para isso que
 *   tabela existe, e cartão empilhado impede exatamente essa leitura.
 *
 * · abaixo de `lg:` → CARTÕES. Tabela no celular só funciona com scroll
 *   horizontal, e scroll horizontal em lista clínica esconde coluna: o médico
 *   lê "sem dados recentes" e não vê a adesão porque ela está fora da tela.
 *   Por isso a tabela é `hidden lg:block` e os cartões `lg:hidden` — nenhuma
 *   das duas rola de lado.
 *
 * Filtros: busca por nome (visível), prioridade, sem dados recentes, condição e
 * pendência — mais o filtro de status do vínculo, que já existia.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Users, ChevronRight, Copy, Check, UserX, ArrowUpDown, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InviteCodeDialog } from "@/components/pro/InviteCodeDialog";
import { useProfessionalPatients, type FilaItem } from "@/hooks/useProfessional";
import {
  LABEL_ESTADO, TOM_ESTADO, DIAS_SEM_DADOS,
  legendaAdesao, legendaIndicador, textoAdesao, textoIndicador, tempoRelativo,
  type EstadoFila,
} from "@/hooks/useCarteiraIndicadores";

type EstadoFiltro = "todos" | "prioridade" | "sem_dados_recentes" | "pendencia";
type StatusFilter = "todos" | "active" | "pending";
type SortKey = "fila" | "nome" | "atividade";

const ORDEM_ESTADO: Record<EstadoFila, number> = {
  prioridade: 0, sem_dados_recentes: 1, atencao: 2, estavel: 3, convite_pendente: 4,
};

/** Badge do estado — reusa o mesmo mapa de tom do painel, para que "sem dados
 *  recentes" tenha a mesma cara nas duas telas. */
function BadgeEstado({ estado }: { estado: EstadoFila }) {
  return (
    <span className={cn(
      // Sem `whitespace-nowrap`: na coluna "Paciente" da tabela (22% da largura,
      // ~124px em 1024px) o selo "SEM DADOS RECENTES" saía por cima da coluna
      // vizinha em vez de quebrar dentro da própria célula.
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-left",
      TOM_ESTADO[estado].badge,
    )}>
      {estado === "sem_dados_recentes" && <EyeOff className="h-3 w-3" />}
      {LABEL_ESTADO[estado]}
    </span>
  );
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function ProPatientsPage() {
  const navigate = useNavigate();
  const { patients, contagem, isLoading, desvincular } = useProfessionalPatients();

  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [condicao, setCondicao] = useState("todas");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [sort, setSort] = useState<SortKey>("fila");
  const [copied, setCopied] = useState<string | null>(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<FilaItem | null>(null);

  /** Comorbidades individuais, não a combinação — ver o mesmo raciocínio no painel. */
  const condicoes = useMemo(() => {
    const set = new Set<string>();
    patients.forEach((p) => p.condition.split("·").map((c) => c.trim()).filter(Boolean).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = patients.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (q && !p.full_name.toLowerCase().includes(q) && !(p.inviteCode ?? "").toLowerCase().includes(q)) return false;
      if (condicao !== "todas" && !p.condition.toLowerCase().includes(condicao.toLowerCase())) return false;
      if (estadoFiltro === "prioridade" && p.estado !== "prioridade") return false;
      if (estadoFiltro === "sem_dados_recentes" && p.estado !== "sem_dados_recentes") return false;
      if (estadoFiltro === "pendencia" && !p.pendencia) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "nome") return a.full_name.localeCompare(b.full_name);
      if (sort === "atividade") {
        // Sem medida nenhuma vai para o TOPO nesta ordenação, não para o fim:
        // "quem está mais tempo sem dar notícia" é a pergunta que se faz ao
        // ordenar por atividade, e `0` no fim respondia o contrário.
        const ta = a.lastReadingAt ? new Date(a.lastReadingAt).getTime() : -Infinity;
        const tb = b.lastReadingAt ? new Date(b.lastReadingAt).getTime() : -Infinity;
        return ta - tb;
      }
      return ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] || a.full_name.localeCompare(b.full_name);
    });
    return list;
  }, [patients, search, estadoFiltro, condicao, statusFilter, sort]);

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const confirmarEncerrar = () => {
    if (!encerrarAlvo) return;
    desvincular.mutate(encerrarAlvo.link_id, {
      onSuccess: () => { toast.success("Vínculo encerrado."); setEncerrarAlvo(null); },
    });
  };

  const chip = (ativo: boolean, ativoTom?: string) => cn(
    "px-3 h-10 rounded-xl text-xs font-semibold border transition-colors shrink-0",
    ativo
      ? ativoTom ?? "bg-primary text-primary-foreground border-primary"
      : "bg-card text-muted-foreground border-border hover:border-border-strong",
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Pacientes"
        subtitle={`${patients.filter((p) => p.status === "active").length} ativos · ${contagem.semDadosRecentes} sem dados recentes · ${patients.filter((p) => p.status === "pending").length} convites pendentes`}
        action={<InviteCodeDialog />}
      />

      {/* Filtros — a busca ocupa a linha inteira no celular e fica sempre à
          vista: não há ícone de lupa que abre campo. */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 h-10 w-full lg:w-auto lg:flex-1 lg:min-w-[240px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código de convite…"
            aria-label="Buscar paciente pelo nome"
            className="border-0 bg-transparent focus-visible:ring-0 px-1 h-8"
          />
        </div>

        <button onClick={() => setEstadoFiltro("todos")} className={chip(estadoFiltro === "todos")}>
          Todos ({patients.length})
        </button>
        <button onClick={() => setEstadoFiltro("prioridade")} className={chip(estadoFiltro === "prioridade", "bg-error text-white border-error")}>
          Prioridade ({contagem.prioridade})
        </button>
        <button onClick={() => setEstadoFiltro("sem_dados_recentes")} className={chip(estadoFiltro === "sem_dados_recentes", "bg-muted-foreground text-white border-muted-foreground")}>
          Sem dados recentes ({contagem.semDadosRecentes})
        </button>
        <button onClick={() => setEstadoFiltro("pendencia")} className={chip(estadoFiltro === "pendencia", "bg-warning text-white border-warning")}>
          Pendência ({contagem.comPendencia})
        </button>

        {condicoes.length > 0 && (
          <select
            value={condicao}
            onChange={(e) => setCondicao(e.target.value)}
            aria-label="Filtrar por condição"
            className="h-10 rounded-xl border border-border bg-card px-3 text-xs font-semibold text-muted-foreground"
          >
            <option value="todas">Qualquer condição</option>
            {condicoes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {(["todos", "active", "pending"] as StatusFilter[]).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={chip(statusFilter === s)}>
            {s === "todos" ? "Qualquer vínculo" : s === "active" ? "Ativos" : "Convite pendente"}
          </button>
        ))}

        <button
          onClick={() => setSort((s) => (s === "fila" ? "nome" : s === "nome" ? "atividade" : "fila"))}
          className="px-3 h-10 rounded-xl text-xs font-semibold border border-border bg-card text-muted-foreground hover:border-border-strong inline-flex items-center gap-1.5 shrink-0"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sort === "fila" ? "Ordenar: fila" : sort === "nome" ? "Ordenar: nome" : "Ordenar: mais tempo sem medir"}
        </button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={patients.length === 0 ? "Nenhum paciente ainda" : "Nada encontrado"}
          description={patients.length === 0 ? "Convide seu primeiro paciente para começar." : "Ajuste a busca ou os filtros."}
          variant="card"
        />
      ) : (
        <>
          {/* ── DESKTOP: tabela ─────────────────────────────────────────── */}
          <div className="hidden lg:block rounded-2xl bg-card border border-border overflow-hidden">
            <table className="w-full text-left table-fixed">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {/* A coluna "Ação" tinha 6% (≈67px em 1440): "Abrir ›" mais o
                      botão de encerrar vínculo não cabiam, e como a célula
                      alinha à direita o excesso vazava para a ESQUERDA, por
                      cima do número de adesão da linha. 12% é o que os dois
                      botões ocupam de verdade. */}
                  <th className="font-semibold px-4 py-2.5 w-[22%]">Paciente</th>
                  <th className="font-semibold px-4 py-2.5 w-[24%]">Motivo</th>
                  <th className="font-semibold px-4 py-2.5 w-[14%]">Última medida</th>
                  <th className="font-semibold px-4 py-2.5 w-[18%]">Origem / período</th>
                  <th className="font-semibold px-4 py-2.5 w-[12%]">Adesão autorrelatada</th>
                  <th className="font-semibold px-4 py-2.5 w-[170px] text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const semDados = p.estado === "sem_dados_recentes";
                  return (
                    <tr
                      key={p.link_id}
                      className={cn(
                        "border-b border-border last:border-0 align-top",
                        semDados && "bg-muted/30",
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <span className={cn("h-1.5 w-1.5 rounded-full mt-1.5 shrink-0", TOM_ESTADO[p.estado].ponto)} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{p.full_name}</p>
                            <div className="mt-1"><BadgeEstado estado={p.estado} /></div>
                            <p className="text-[11px] text-muted-foreground truncate mt-1">
                              {p.condition || "sem condição registrada"}
                              {p.age != null && ` · ${p.age}a`}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className={cn("text-xs leading-snug", semDados ? "text-muted-foreground" : "text-foreground")}>
                          {p.motivo}
                        </p>
                        {p.status === "pending" && p.inviteCode && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                            Código: <span className="font-mono font-semibold text-foreground">{p.inviteCode}</span>
                            <button onClick={() => copy(p.inviteCode!)} className="text-primary hover:text-cardio-dark" aria-label="Copiar código">
                              {copied === p.inviteCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <p className={cn("text-xs tabular-nums", semDados ? "text-warning font-medium" : "text-foreground")}>
                          {tempoRelativo(p.lastReadingAt)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{p.ultimaInfo}</p>
                      </td>

                      <td className="px-4 py-3">
                        {/* Valor + n + período + origem, na mesma célula: é o
                            trio que torna o número interpretável. */}
                        <p className={cn(
                          "text-xs tabular-nums",
                          p.indicadores.pa.valor ? "font-semibold text-foreground" : "italic text-muted-foreground",
                        )}>
                          PA {textoIndicador(p.indicadores.pa)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{legendaIndicador(p.indicadores.pa)}</p>
                        <p className={cn(
                          "text-xs tabular-nums mt-1",
                          p.indicadores.fcRepouso.valor ? "text-foreground" : "italic text-muted-foreground",
                        )}>
                          FC {textoIndicador(p.indicadores.fcRepouso)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{legendaIndicador(p.indicadores.fcRepouso)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <p className={cn(
                          "text-xs tabular-nums",
                          p.indicadores.adesao.percentual == null
                            ? "italic text-muted-foreground"
                            : p.indicadores.adesao.percentual < 0.8
                              ? "font-semibold text-warning"
                              : "font-semibold text-foreground",
                        )}>
                          {textoAdesao(p.indicadores.adesao)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{legendaAdesao(p.indicadores.adesao)}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "active" ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/pro/pacientes/${p.patient_user_id}`)}>
                                Abrir <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)} aria-label="Encerrar vínculo">
                                <UserX className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)}>
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── CELULAR: cartões, sem scroll lateral ────────────────────── */}
          <div className="lg:hidden space-y-2.5">
            {filtered.map((p) => {
              const semDados = p.estado === "sem_dados_recentes";
              return (
                <div
                  key={p.link_id}
                  className={cn(
                    "rounded-2xl bg-card border border-border border-l-4 p-4 shadow-sm",
                    TOM_ESTADO[p.estado].borda,
                    semDados && "bg-muted/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold",
                      semDados ? "bg-muted-foreground" : "bg-gradient-to-br from-primary to-cardio-dark",
                    )}>
                      {p.status === "pending" ? "⋯" : semDados ? <EyeOff className="h-4 w-4" /> : initials(p.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground truncate">{p.full_name}</span>
                        {p.status === "pending"
                          ? <StatusBadge variant="pendente">Convite pendente</StatusBadge>
                          : <BadgeEstado estado={p.estado} />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {p.condition || "sem condição registrada"}{p.age != null && ` · ${p.age}a`}
                      </p>

                      <p className={cn("text-xs mt-1.5 leading-snug", semDados ? "text-muted-foreground" : "text-foreground")}>
                        {p.motivo}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Última informação: {p.ultimaInfo}</p>

                      {p.status === "active" && (
                        <dl className="mt-2 space-y-1.5">
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pressão média</dt>
                            <dd className={cn("text-xs tabular-nums", p.indicadores.pa.valor ? "font-semibold text-foreground" : "italic text-muted-foreground")}>
                              {textoIndicador(p.indicadores.pa)}
                            </dd>
                            <dd className="text-[10px] text-muted-foreground">{legendaIndicador(p.indicadores.pa)}</dd>
                          </div>
                          <div>
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Adesão autorrelatada</dt>
                            <dd className={cn(
                              "text-xs tabular-nums",
                              p.indicadores.adesao.percentual == null ? "italic text-muted-foreground" : "font-semibold text-foreground",
                            )}>
                              {textoAdesao(p.indicadores.adesao)}
                            </dd>
                            <dd className="text-[10px] text-muted-foreground">{legendaAdesao(p.indicadores.adesao)}</dd>
                          </div>
                        </dl>
                      )}

                      {p.status === "pending" && p.inviteCode && (
                        <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                          Código: <span className="font-mono font-semibold text-foreground">{p.inviteCode}</span>
                          <button onClick={() => copy(p.inviteCode!)} className="text-primary hover:text-cardio-dark" aria-label="Copiar código">
                            {copied === p.inviteCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1 mt-2">
                        {p.status === "active" ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/pro/pacientes/${p.patient_user_id}`)}>
                              Abrir <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)}>
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)}>
                            Cancelar convite
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {contagem.semDadosRecentes > 0 && (
            <p className="text-[11px] text-muted-foreground mt-3">
              {contagem.semDadosRecentes} paciente{contagem.semDadosRecentes > 1 ? "s" : ""} sem nenhuma medida há mais de {DIAS_SEM_DADOS} dias.
              Ausência de alerta não significa estabilidade — significa que não chegou número para avaliar.
            </p>
          )}
        </>
      )}

      <AlertDialog open={!!encerrarAlvo} onOpenChange={(o) => !o && setEncerrarAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {encerrarAlvo?.status === "active" ? "Encerrar vínculo?" : "Cancelar convite?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {encerrarAlvo?.status === "active"
                ? `${encerrarAlvo?.full_name} deixará de aparecer no seu painel. Esta ação não apaga os dados clínicos já registrados.`
                : "O código deixa de funcionar. Você pode gerar um novo convite quando quiser."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEncerrar} className="bg-error text-white hover:bg-error/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
