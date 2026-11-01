import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, AlertTriangle, Bell, Activity, ArrowUpRight, Search, EyeOff, ClipboardList, HeartPulse, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton, GridSkeleton } from "@/components/shell/Skeletons";
import { Input } from "@/components/ui/input";
import { InviteCodeDialog } from "@/components/pro/InviteCodeDialog";
import { useProfessionalPatients, useProfessionalAlerts, useIndicadoresDaCarteira, fluxoDoAlerta, LABEL_WORKFLOW, type FilaItem } from "@/hooks/useProfessional";
import { LABEL_ESTADO, TOM_ESTADO, DIAS_SEM_DADOS, DIAS_ADESAO, legendaAdesao, legendaIndicador, tempoRelativo, ROTULO_ORIGEM, type IndicadorAgregado } from "@/hooks/useCarteiraIndicadores";

type Filtro = "todos" | "prioridade" | "sem_dados_recentes" | "pendencia";
const SEVERIDADE = { emergency: 0, critical: 1, warning: 2, info: 3 };

function iniciais(nome: string) {
  return nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

/** A procedência resumida fica junto do valor; a versão completa é expansível. */
function Medida({ titulo, dado, unidade }: { titulo: string; dado: IndicadorAgregado; unidade?: string }) {
  return <div className="monitor-measure">
    <span className="monitor-measure-label">{titulo}</span>
    <strong className={cn(!dado.valor && "monitor-missing")}>{dado.valor ?? "Sem medidas"}{dado.valor && unidade && <small> {unidade}</small>}</strong>
    <span className="monitor-measure-caption">n={dado.n} · {dado.periodoDias}d{dado.origens.length > 0 && ` · ${dado.origens.map((o) => ROTULO_ORIGEM[o]).join(" + ")}`}</span>
    {!!dado.descartadasEstimativa && <span className="monitor-measure-caption">{dado.descartadasEstimativa} estimativas excluídas</span>}
  </div>;
}

function PacienteLinha({ p }: { p: FilaItem }) {
  const adesao = p.indicadores.adesao;
  return <article className={cn("monitor-patient", `monitor-patient--${p.estado}`)}>
    <div className="monitor-patient-grid">
      <div className="monitor-patient-identity">
        <span className="monitor-avatar" aria-hidden>{iniciais(p.full_name)}</span>
        <div className="min-w-0">
          <div className="monitor-patient-name">
            <Link to={`/pro/pacientes/${p.patient_user_id}`}>{p.full_name}</Link>
            <span className={cn("monitor-status", TOM_ESTADO[p.estado].badge)}><i className={TOM_ESTADO[p.estado].ponto} />{LABEL_ESTADO[p.estado]}</span>
          </div>
          <p className="monitor-condition">{p.age != null && `${p.age} anos · `}{p.condition || "Condição não informada"}</p>
          <p className="monitor-reason">{p.motivo}</p>
        </div>
      </div>
      <div className="monitor-patient-measures">
        <Medida titulo="PA média" dado={p.indicadores.pa} unidade="mmHg" />
        <Medida titulo="FC repouso" dado={p.indicadores.fcRepouso} />
        <div className="monitor-measure">
          <span className="monitor-measure-label">Adesão</span>
          <strong className={cn(adesao.percentual == null && "monitor-missing", adesao.percentual != null && adesao.percentual < .8 && "text-warning-forte")}>
            {adesao.percentual == null ? "Sem doses" : `${Math.round(adesao.percentual * 100)}%`}
          </strong>
          <span className="monitor-measure-caption">Autorrelatada · {adesao.periodoDias}d</span>
          <span className="monitor-measure-caption">{adesao.dosesMarcadas}/{adesao.dosesEsperadas} doses</span>
        </div>
      </div>
      <Link className="monitor-open" to={`/pro/pacientes/${p.patient_user_id}`} aria-label={`Abrir prontuário de ${p.full_name}`}><ArrowUpRight aria-hidden /></Link>
    </div>
    <div className="monitor-patient-footer">
      <span className="monitor-last-reading"><Activity aria-hidden />{p.ultimaInfo}</span>
      {p.openAlerts > 0 && <span className="monitor-unread"><Bell aria-hidden />{p.openAlerts} não lido{p.openAlerts > 1 ? "s" : ""}</span>}
      <details className="monitor-provenance">
        <summary>Detalhes dos dados <ChevronDown aria-hidden /></summary>
        <dl>
          <div><dt>Pressão média</dt><dd>{legendaIndicador(p.indicadores.pa)} · manguito validado</dd></div>
          <div><dt>FC em repouso</dt><dd>{legendaIndicador(p.indicadores.fcRepouso)}</dd></div>
          <div><dt>Adesão autorrelatada</dt><dd>{legendaAdesao(adesao)}</dd></div>
        </dl>
      </details>
    </div>
  </article>;
}

export default function ProDashboardPage() {
  const { patients, isLoading: loadingPatients } = useProfessionalPatients();
  const { clinicos, operacionais, isLoading: loadingAlerts } = useProfessionalAlerts();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [condicao, setCondicao] = useState("todas");
  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);
  const ids = useMemo(() => ativos.map((p) => p.patient_user_id).filter(Boolean), [ativos]);
  const carteira = useIndicadoresDaCarteira(ids);
  const prioridade = ativos.filter((p) => p.estado === "prioridade").length;
  const semDados = ativos.filter((p) => p.estado === "sem_dados_recentes").length;
  const pendencias = ativos.filter((p) => p.pendencia).length;
  const alertas = useMemo(() => clinicos.filter((a) => fluxoDoAlerta(a) !== "resolved").sort((a, b) => SEVERIDADE[a.severity] - SEVERIDADE[b.severity] || b.triggered_at.localeCompare(a.triggered_at)), [clinicos]);
  const operacionaisAbertos = operacionais.filter((a) => fluxoDoAlerta(a) !== "resolved");
  const condicoes = useMemo(() => [...new Set(ativos.flatMap((p) => p.condition.split("·").map((c) => c.trim()).filter(Boolean)))].sort(), [ativos]);
  const fila = useMemo(() => ativos.filter((p) => {
    if (!p.full_name.toLocaleLowerCase("pt-BR").includes(busca.trim().toLocaleLowerCase("pt-BR"))) return false;
    if (condicao !== "todas" && !p.condition.split("·").map((c) => c.trim()).includes(condicao)) return false;
    return filtro === "todos" || (filtro === "pendencia" ? p.pendencia : p.estado === filtro);
  }), [ativos, busca, condicao, filtro]);
  const comPa = ativos.filter((p) => p.indicadores.pa.valor != null).length;
  const comAdesao = ativos.filter((p) => p.indicadores.adesao.percentual != null);
  const adesaoMedia = comAdesao.length ? Math.round(comAdesao.reduce((s, p) => s + (p.indicadores.adesao.percentual ?? 0), 0) / comAdesao.length * 100) : null;
  const loading = loadingPatients || loadingAlerts;
  const metricas = [
    { key: "todos", label: "Pacientes ativos", value: ativos.length, icon: Users, caption: "Em acompanhamento" },
    { key: "prioridade", label: "Prioridade clínica", value: prioridade, icon: AlertTriangle, caption: "Na fila de avaliação" },
    { key: "sem_dados_recentes", label: "Sem dados recentes", value: semDados, icon: EyeOff, caption: `Há mais de ${DIAS_SEM_DADOS} dias` },
    { key: "pendencia", label: "Com pendência", value: pendencias, icon: ClipboardList, caption: "Pendências operacionais" },
  ] as const;
  const distribuicao = [
    { estado: "prioridade", label: "Prioridade", cor: "bg-error" },
    { estado: "atencao", label: "Atenção", cor: "bg-warning" },
    { estado: "sem_dados_recentes", label: "Sem dados", cor: "bg-muted-foreground" },
    { estado: "estavel", label: "Estável", cor: "bg-success" },
  ].map((item) => ({ ...item, total: ativos.filter((p) => p.estado === item.estado).length }));
  const limpar = () => { setBusca(""); setFiltro("todos"); setCondicao("todas"); };

  return <div className="pro-page monitor-page">
    <PageHeader title="Monitoramento" subtitle="Seus pacientes entre uma consulta e outra." action={<InviteCodeDialog compact />} />
    {loading ? <GridSkeleton count={4} /> : <div className="monitor-stats">
      {metricas.map((m) => <button key={m.key} onClick={() => setFiltro(m.key)} className="monitor-stat-button" aria-pressed={filtro === m.key}>
        <StatCard label={m.label} value={m.value} icon={m.icon} className={cn("monitor-stat", m.key === "prioridade" && m.value > 0 && "monitor-stat-priority")} />
        <span className="monitor-stat-caption">{m.caption}</span>
      </button>)}
    </div>}

    <div className="monitor-workspace">
      <SurfaceCard className="monitor-queue">
        <div className="monitor-section-heading">
          <div><h2>Acompanhamento <span className="monitor-count">{ativos.length}</span></h2><p>Prioridades e registros recentes.</p></div>
          <Link to="/pro/pacientes" className="monitor-text-link">Ver todos <ArrowUpRight aria-hidden /></Link>
        </div>
        <div className="monitor-filters">
          <div className="monitor-search"><Search aria-hidden /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome…" aria-label="Buscar paciente pelo nome" />{busca && <button aria-label="Limpar busca" onClick={() => setBusca("")}><X /></button>}</div>
          <select value={condicao} onChange={(e) => setCondicao(e.target.value)} aria-label="Filtrar por condição"><option value="todas">Condições</option>{condicoes.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="monitor-tabs" aria-label="Filtrar acompanhamento">
          {metricas.map((m) => <button key={m.key} aria-pressed={filtro === m.key} onClick={() => setFiltro(m.key)}>{m.key === "todos" ? "Todos" : m.key === "prioridade" ? "Prioridade" : m.key === "sem_dados_recentes" ? "Sem dados" : "Pendências"}<span>{m.value}</span></button>)}
        </div>
        <div className="monitor-list" aria-live="polite">
          {loading ? <ListSkeleton rows={4} /> : fila.length ? fila.map((p) => <PacienteLinha key={p.link_id} p={p} />) : <div className="monitor-empty"><EmptyState icon={Users} title={ativos.length ? "Nenhum paciente neste filtro" : "Comece pelo primeiro paciente"} description={ativos.length ? "Altere os filtros para continuar o acompanhamento." : "Use Convidar paciente para iniciar o acompanhamento."} />{ativos.length > 0 && <button className="monitor-text-link" onClick={limpar}>Limpar filtros</button>}</div>}
        </div>
        <div className="monitor-queue-footer"><span>{fila.length} de {ativos.length} pacientes</span><span>Classificação com base nos registros disponíveis</span></div>
      </SurfaceCard>

      <aside className="monitor-rail" aria-label="Resumo do acompanhamento">
        <SurfaceCard className="monitor-alerts">
          <div className="monitor-section-heading"><div><h2><Bell aria-hidden />Alertas clínicos <span className="monitor-count">{alertas.length}</span></h2><p>Ordenados por gravidade e recência.</p></div></div>
          {loadingAlerts ? <ListSkeleton rows={2} /> : alertas.length ? <div>{alertas.slice(0, 4).map((a) => <Link key={a.id} to="/pro/alertas" className={cn("monitor-alert", `monitor-alert--${a.severity}`)}>
            <div className="monitor-alert-meta"><span>{a.severity === "emergency" ? "Emergência" : a.severity === "critical" ? "Crítico" : a.severity === "warning" ? "Atenção" : "Informativo"}</span><time dateTime={a.triggered_at}>{tempoRelativo(a.triggered_at)}</time></div>
            <strong>{a.title}</strong><p>{patients.find((p) => p.patient_user_id === a.patient_user_id)?.full_name ?? "Paciente"}</p>
            <div className="monitor-alert-footer"><span>{LABEL_WORKFLOW[fluxoDoAlerta(a)]}</span><ArrowUpRight aria-hidden /></div>
          </Link>)}</div> : <p className="monitor-rail-empty">Nenhum alerta clínico em aberto.</p>}
          <Link to="/pro/alertas" className="monitor-panel-link">Abrir central de alertas <ArrowUpRight aria-hidden /></Link>
          {operacionaisAbertos.length > 0 && <p className="monitor-operational"><ClipboardList aria-hidden />{operacionaisAbertos.length} pendência{operacionaisAbertos.length > 1 ? "s" : ""} {operacionaisAbertos.length > 1 ? "operacionais" : "operacional"}, em fila separada.</p>}
        </SurfaceCard>
        <SurfaceCard className="monitor-overview">
          <div className="monitor-section-heading"><div><h2><HeartPulse aria-hidden />Visão da carteira</h2><p>Distribuição atual do acompanhamento.</p></div></div>
          {loadingPatients ? <ListSkeleton rows={2} /> : <>
            <div className="monitor-distribution" aria-hidden>{distribuicao.filter((d) => d.total > 0).map((d) => <span key={d.estado} className={d.cor} style={{ flex: d.total }} />)}</div>
            <div className="monitor-distribution-key">{distribuicao.map((d) => <div key={d.estado}><span><i className={d.cor} />{d.label}</span><b>{d.total}</b></div>)}</div>
            <div className="monitor-portfolio-metric"><span>PA: tempo no alvo médio</span><strong>{carteira.isLoading ? "…" : carteira.tempoNoAlvoMedio != null ? `${carteira.tempoNoAlvoMedio}%` : "Sem medidas"}</strong><p>{carteira.pacientesComMedida} de {ativos.length} pacientes · 30 dias · manguito validado</p></div>
            <div className="monitor-portfolio-metric"><span>Adesão autorrelatada média</span><strong>{adesaoMedia != null ? `${adesaoMedia}%` : "Sem doses"}</strong><p>{comAdesao.length} de {ativos.length} pacientes · {DIAS_ADESAO} dias · marcado pelo paciente</p></div>
            <div className="monitor-coverage"><span>Com medidas suficientes de PA</span><b>{comPa}/{ativos.length}</b><span>Com cuidador ativo</span><b>{carteira.isLoading ? "…" : `${carteira.comCuidador}/${ativos.length}`}</b></div>
          </>}
        </SurfaceCard>
      </aside>
    </div>
  </div>;
}
