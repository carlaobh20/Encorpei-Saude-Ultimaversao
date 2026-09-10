/**
 * DASHBOARD — "seus pacientes, e quem precisa de você hoje" (docs §5.1).
 *
 * A fila responde, nesta ordem e nesta hierarquia visual:
 *   1. QUEM precisa de avaliação  → o estado (prioridade / sem dados / atenção)
 *   2. POR QUÊ                    → `motivo`, uma frase
 *   3. QUAL A ÚLTIMA INFORMAÇÃO CONFIÁVEL → `ultimaInfo` + os indicadores com
 *      valor, n, período e origem
 *
 * A mudança mais importante em relação à versão anterior é o estado
 * `sem_dados_recentes`. Antes, quem não tinha alerta era pintado de verde — e
 * paciente que parou de medir não gera alerta, porque alerta nasce de número.
 * Ou seja: a tela pintava de "estável" exatamente o paciente sobre quem não se
 * sabia nada. Silêncio não é sinal de saúde, e agora tem cor, contagem, filtro
 * e lugar próprio na ordenação.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, AlertTriangle, Bell, Activity, ChevronRight, Search,
  UserPlus, Copy, Check, Ticket, EyeOff, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton, GridSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useProfessionalPatients, useProfessionalAlerts, useIndicadoresDaCarteira, type FilaItem,
} from "@/hooks/useProfessional";
import {
  LABEL_ESTADO, TOM_ESTADO, DIAS_SEM_DADOS, DIAS_JANELA_MEDIDAS, DIAS_ADESAO,
  legendaAdesao, legendaIndicador, textoAdesao, textoIndicador,
} from "@/hooks/useCarteiraIndicadores";
import { useInviteCode } from "@/hooks/useInviteCode";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** Filtros da fila. "Condição" é texto livre porque o campo é texto livre. */
type FiltroEstado = "todos" | "prioridade" | "sem_dados_recentes" | "pendencia";

/**
 * Um indicador da carteira, sempre com a legenda embaixo.
 *
 * O componente não aceita a opção de esconder o n e o período: se um número
 * pode aparecer sem procedência, alguém vai fazê-lo aparecer sem procedência.
 */
function Indicador({ rotulo, valor, legenda, alerta }: {
  rotulo: string; valor: string; legenda: string; alerta?: boolean;
}) {
  const semDado = valor === "sem medidas suficientes" || valor === "sem doses esperadas no período";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn(
        "text-sm tabular-nums leading-tight",
        // Frase de ausência fica em itálico e apagada: é texto, não medida.
        semDado ? "italic text-muted-foreground text-xs" : "font-semibold text-foreground",
        alerta && !semDado && "text-warning",
      )}>
        {valor}
      </p>
      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{legenda}</p>
    </div>
  );
}

function CartaoDaFila({ p, onOpen }: { p: FilaItem; onOpen: () => void }) {
  const tom = TOM_ESTADO[p.estado];
  const semDados = p.estado === "sem_dados_recentes";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-2xl bg-card border border-border border-l-4 p-4 shadow-sm hover:border-border-strong transition-colors",
        tom.borda,
        // Fundo levemente listrado no silêncio: o cartão tem que PARECER
        // incompleto, não tem que parecer calmo.
        semDados && "bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold",
          semDados ? "bg-muted-foreground" : "bg-gradient-to-br from-primary to-cardio-dark",
        )}>
          {semDados ? <EyeOff className="h-4 w-4" /> : initials(p.full_name)}
        </div>

        <div className="min-w-0 flex-1">
          {/* 1. QUEM */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{p.full_name}</span>
            {p.age != null && <span className="text-xs text-muted-foreground shrink-0">{p.age}a</span>}
            <span className={cn(
              "ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0",
              tom.badge,
            )}>
              {LABEL_ESTADO[p.estado]}
            </span>
          </div>
          {p.condition && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.condition}</p>}

          {/* 2. POR QUÊ */}
          <p className={cn("text-sm mt-1.5 leading-snug", semDados ? "text-muted-foreground" : "text-foreground")}>
            {p.motivo}
          </p>

          {/* 3. ÚLTIMA INFORMAÇÃO CONFIÁVEL */}
          <p className="text-[11px] text-muted-foreground mt-1">
            Última informação: <span className="text-foreground">{p.ultimaInfo}</span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-2.5">
            <Indicador
              rotulo="Pressão média"
              valor={textoIndicador(p.indicadores.pa)}
              legenda={legendaIndicador(p.indicadores.pa)}
            />
            <Indicador
              rotulo="FC repouso"
              valor={textoIndicador(p.indicadores.fcRepouso)}
              legenda={legendaIndicador(p.indicadores.fcRepouso)}
            />
            <Indicador
              rotulo="Adesão autorrelatada"
              valor={textoAdesao(p.indicadores.adesao)}
              legenda={legendaAdesao(p.indicadores.adesao)}
              alerta={(p.indicadores.adesao.percentual ?? 1) < 0.8}
            />
          </div>

          {p.openAlerts > 0 && (
            <p className="inline-flex items-center gap-1 text-error font-medium text-[11px] mt-2">
              <Bell className="h-3 w-3" /> {p.openAlerts} alerta{p.openAlerts > 1 ? "s" : ""} não lido{p.openAlerts > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </button>
  );
}

function InviteCard() {
  const { pendingInvites, generateInvite } = useInviteCode();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  return (
    <SurfaceCard>
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Convidar paciente</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Gere um código e compartilhe com o paciente. Ele digita no app dele para vincular.
      </p>
      <Button
        size="sm"
        className="w-full"
        onClick={() => generateInvite.mutate()}
        disabled={generateInvite.isPending}
      >
        <Ticket className="h-4 w-4" /> {generateInvite.isPending ? "Gerando…" : "Gerar código de convite"}
      </Button>
      {pendingInvites.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Aguardando uso</p>
          {pendingInvites.slice(0, 3).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
              <span className="font-mono font-bold tracking-widest text-sm text-foreground">{inv.invite_code}</span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => inv.invite_code && copy(inv.invite_code)}>
                {copied === inv.invite_code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

export default function ProDashboardPage() {
  const navigate = useNavigate();
  const { patients, contagem, isLoading: loadingPatients } = useProfessionalPatients();
  const { criticos, clinicos, operacionais, alerts, isLoading: loadingAlerts } = useProfessionalAlerts();

  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<FiltroEstado>("todos");
  const [condicao, setCondicao] = useState<string>("todas");

  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);

  const idsAtivos = useMemo(() => ativos.map((p) => p.patient_user_id).filter(Boolean), [ativos]);
  const carteira = useIndicadoresDaCarteira(idsAtivos);

  /**
   * Condições vêm de `resumirCondicao` como "HAS · DM2 · dislipidemia".
   * Quebramos no separador para o filtro operar por comorbidade, e não pela
   * combinação exata — filtrar por "HAS · DM2" não serviria a ninguém.
   */
  const condicoes = useMemo(() => {
    const set = new Set<string>();
    ativos.forEach((p) => p.condition.split("·").map((c) => c.trim()).filter(Boolean).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [ativos]);

  const fila = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return ativos.filter((p) => {
      if (q && !p.full_name.toLowerCase().includes(q)) return false;
      if (condicao !== "todas" && !p.condition.toLowerCase().includes(condicao.toLowerCase())) return false;
      if (filtro === "prioridade" && p.estado !== "prioridade") return false;
      if (filtro === "sem_dados_recentes" && p.estado !== "sem_dados_recentes") return false;
      if (filtro === "pendencia" && !p.pendencia) return false;
      return true;
    });
  }, [ativos, busca, condicao, filtro]);

  /**
   * Indicadores da carteira, agora com denominador visível.
   *
   * "68% no alvo" sem dizer sobre quantos pacientes é uma frase que soa a
   * relatório e não significa nada: 68% de 3 pacientes com medida numa carteira
   * de 40 é um número perigoso de se olhar sozinho.
   */
  const daFila = useMemo(() => {
    const comPa = ativos.filter((p) => p.indicadores.pa.valor);
    const noAlvo = comPa.filter((p) => {
      const [s, d] = (p.indicadores.pa.valor ?? "").split("/").map(Number);
      return Number.isFinite(s) && Number.isFinite(d) && s <= 130 && d <= 80;
    });
    const comAdesao = ativos.filter((p) => p.indicadores.adesao.percentual != null);
    const adesaoMedia = comAdesao.length
      ? comAdesao.reduce((s, p) => s + (p.indicadores.adesao.percentual ?? 0), 0) / comAdesao.length
      : null;
    const medidasPa = comPa.reduce((s, p) => s + p.indicadores.pa.n, 0);
    return {
      percentualNoAlvo: comPa.length ? Math.round((noAlvo.length / comPa.length) * 100) : null,
      pacientesComPa: comPa.length,
      medidasPa,
      adesaoMedia: adesaoMedia != null ? Math.round(adesaoMedia * 100) : null,
      pacientesComAdesao: comAdesao.length,
    };
  }, [ativos]);

  const loading = loadingPatients || loadingAlerts;

  const botaoFiltro = (valor: FiltroEstado, texto: string, contador?: number, tomAtivo?: string) => (
    <button
      key={valor}
      onClick={() => setFiltro(valor)}
      className={cn(
        "px-3 h-10 rounded-xl text-xs font-semibold border transition-colors shrink-0",
        filtro === valor
          ? tomAtivo ?? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:border-border-strong",
      )}
    >
      {texto}{contador != null && ` (${contador})`}
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Painel"
        subtitle={`${ativos.length} paciente${ativos.length === 1 ? "" : "s"} em acompanhamento`}
      />

      {loading ? (
        <GridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
          <button onClick={() => setFiltro("todos")} className="text-left">
            <StatCard label="Carteira" value={ativos.length} icon={Users} className={cn(filtro === "todos" && "ring-2 ring-primary/40")} />
          </button>
          <button onClick={() => setFiltro("prioridade")} className="text-left">
            <StatCard label="Prioridade" value={contagem.prioridade} icon={AlertTriangle} iconColor="hsl(var(--error))" className={cn(filtro === "prioridade" && "ring-2 ring-error/40")} />
          </button>
          {/* O cartão que a tela não tinha. Ele existe para que o número de
              pacientes invisíveis nunca mais fique invisível. */}
          <button onClick={() => setFiltro("sem_dados_recentes")} className="text-left">
            <StatCard
              label={`Sem dados há +${DIAS_SEM_DADOS} dias`}
              value={contagem.semDadosRecentes}
              icon={EyeOff}
              className={cn(filtro === "sem_dados_recentes" && "ring-2 ring-muted-foreground/40")}
            />
          </button>
          <button onClick={() => setFiltro("pendencia")} className="text-left">
            <StatCard label="Com pendência" value={contagem.comPendencia} icon={ClipboardList} iconColor="hsl(var(--warning))" className={cn(filtro === "pendencia" && "ring-2 ring-warning/40")} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-5">
        {/* Fila */}
        <div>
          <SectionHeader
            title="Fila de avaliação"
            subtitle="quem precisa de você, por quê, e qual foi a última informação confiável"
          />

          {/* Busca visível — não escondida atrás de ícone. Em carteira de 40
              pacientes, procurar um nome é a ação mais frequente da tela. */}
          <div className="flex flex-wrap items-center gap-2.5 mb-4">
            <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 h-10 flex-1 min-w-[200px]">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar paciente pelo nome…"
                aria-label="Buscar paciente pelo nome"
                className="border-0 bg-transparent focus-visible:ring-0 px-1 h-8"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
              {botaoFiltro("todos", "Todos", ativos.length)}
              {botaoFiltro("prioridade", "Prioridade", contagem.prioridade, "bg-error text-white border-error")}
              {botaoFiltro("sem_dados_recentes", "Sem dados recentes", contagem.semDadosRecentes, "bg-muted-foreground text-white border-muted-foreground")}
              {botaoFiltro("pendencia", "Pendência", contagem.comPendencia, "bg-warning text-white border-warning")}
            </div>
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
          </div>

          {loading ? (
            <ListSkeleton rows={4} />
          ) : fila.length === 0 ? (
            <EmptyState
              icon={Users}
              title={ativos.length === 0 ? "Nenhum paciente ainda" : "Nada nesse filtro"}
              description={ativos.length === 0 ? "Convide seu primeiro paciente para começar o acompanhamento." : "Ajuste a busca ou os filtros."}
              variant="card"
            />
          ) : (
            <div className="space-y-2.5">
              {fila.map((p) => (
                <CartaoDaFila key={p.link_id} p={p} onOpen={() => navigate(`/pro/pacientes/${p.patient_user_id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <SurfaceCard>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-error" />
              <h3 className="text-sm font-semibold text-foreground">Risco clínico aberto</h3>
            </div>
            {criticos.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhum alerta crítico agora.</p>
            ) : (
              <div className="space-y-2">
                {criticos.slice(0, 5).map((a) => {
                  const paciente = patients.find((p) => p.patient_user_id === a.patient_user_id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => navigate("/pro/alertas")}
                      className="w-full text-left rounded-xl border border-error-bg bg-error-bg/40 px-3 py-2 hover:bg-error-bg transition-colors"
                    >
                      <p className="text-xs font-semibold text-error">{a.title}</p>
                      <p className="text-[11px] text-foreground mt-0.5 truncate">
                        {paciente?.full_name ?? "Paciente"} · {a.trigger_value ?? ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
            {/* Atraso operacional aparece separado até no resumo: se voltar a
                dividir espaço com risco clínico, volta a competir com ele. */}
            {operacionais.length > 0 && (
              <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border">
                Além destes, {operacionais.length} pendência{operacionais.length > 1 ? "s" : ""} operacional
                {operacionais.length > 1 ? "is" : ""} (adesão / falta de registro) — não é risco clínico medido.
              </p>
            )}
            {alerts.length > criticos.length && (
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate("/pro/alertas")}>
                Ver todos os alertas ({clinicos.length} clínicos · {operacionais.length} operacionais) <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Indicadores da carteira</h3>
            </div>
            {/* Cada linha traz denominador e período. Um indicador de carteira
                sem n é uma opinião com aparência de métrica. */}
            <dl className="space-y-3 text-sm">
              <div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">No alvo de pressão</dt>
                  <dd className="font-semibold tabular-nums">
                    {daFila.percentualNoAlvo != null
                      ? `${daFila.percentualNoAlvo}%`
                      : <span className="text-xs italic font-normal text-muted-foreground">sem medidas suficientes</span>}
                  </dd>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {daFila.pacientesComPa} de {ativos.length} pacientes · n={daFila.medidasPa} medidas de manguito · {DIAS_JANELA_MEDIDAS} dias
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Adesão autorrelatada média</dt>
                  <dd className="font-semibold tabular-nums">
                    {daFila.adesaoMedia != null
                      ? `${daFila.adesaoMedia}%`
                      : <span className="text-xs italic font-normal text-muted-foreground">sem doses esperadas</span>}
                  </dd>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {daFila.pacientesComAdesao} de {ativos.length} pacientes · {DIAS_ADESAO} dias · marcado pelo paciente, ninguém confere
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Sem dados recentes</dt>
                  <dd className={cn("font-semibold tabular-nums", contagem.semDadosRecentes > 0 && "text-warning")}>
                    {contagem.semDadosRecentes}
                  </dd>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  nenhuma medida de nenhum tipo há mais de {DIAS_SEM_DADOS} dias
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">Medidas de PA na meta (média)</dt>
                  <dd className="font-semibold tabular-nums">
                    {carteira.tempoNoAlvoMedio != null
                      ? `${carteira.tempoNoAlvoMedio}%`
                      : <span className="text-xs italic font-normal text-muted-foreground">sem medidas suficientes</span>}
                  </dd>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {carteira.pacientesComMedida} de {ativos.length} pacientes · 30 dias · manguito validado
                </p>
              </div>

              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Com cuidador ativo</dt>
                <dd className="font-semibold tabular-nums">
                  {ativos.length > 0 ? `${carteira.comCuidador} de ${ativos.length}` : "—"}
                </dd>
              </div>
            </dl>
          </SurfaceCard>

          <InviteCard />
        </div>
      </div>
    </div>
  );
}
