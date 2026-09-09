/**
 * DASHBOARD — "seus pacientes, e quem precisa de você hoje" (docs §5.1).
 *
 * Contagem por semáforo como filtros clicáveis, fila de risco em cartões
 * densos, alertas críticos abertos, indicadores da carteira e convite de
 * paciente. Esta tela é o principal argumento de venda: tem que provar em
 * 10 segundos que o app diz ao médico quem precisa de atenção — e por quê.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, AlertTriangle, Bell, Target, Activity, Clock, ChevronRight,
  UserPlus, Copy, Check, Ticket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton, GridSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import {
  useProfessionalPatients, useProfessionalAlerts, useIndicadoresDaCarteira, type FilaItem,
} from "@/hooks/useProfessional";
import { useInviteCode } from "@/hooks/useInviteCode";
import { RISK_LABEL } from "@/lib/clinical/cardioRiskEngine";
import type { RiskLevel } from "@/types/cardio";

const RISK_DOT: Record<RiskLevel, string> = {
  red: "bg-error", yellow: "bg-warning", green: "bg-success",
};
const RISK_BORDER: Record<RiskLevel, string> = {
  red: "border-l-error", yellow: "border-l-warning", green: "border-l-success",
};
const RISK_BADGE: Record<RiskLevel, string> = {
  red: "bg-error-bg text-error", yellow: "bg-warning-bg text-warning", green: "bg-success-bg text-success",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function relTime(iso: string | null): string {
  if (!iso) return "sem registro";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

function PatientQueueCard({ p, onOpen }: { p: FilaItem; onOpen: () => void }) {
  const semDados = !p.lastReadingAt || Date.now() - new Date(p.lastReadingAt).getTime() > 10 * 86400000;
  return (
    <button
      onClick={onOpen}
      className={cn(
        "w-full text-left rounded-2xl bg-card border border-border border-l-4 p-4 shadow-sm hover:border-border-strong transition-colors",
        RISK_BORDER[p.risk],
      )}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-primary to-cardio-dark">
          {initials(p.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{p.full_name}</span>
            {p.age != null && <span className="text-xs text-muted-foreground shrink-0">{p.age}a</span>}
            <span className={cn("ml-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0", RISK_BADGE[p.risk])}>
              {RISK_LABEL[p.risk]}
            </span>
          </div>
          {p.condition && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.condition}</p>}
          <p className="text-sm text-foreground mt-1.5 leading-snug">{p.headline}</p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-muted-foreground">
            <span className="tabular-nums">PA méd. {p.bpAvg ?? "—"}</span>
            <span className="tabular-nums">{p.restingHr != null ? `${p.restingHr} bpm` : "FC —"}</span>
            <span className="tabular-nums">Adesão {p.adherence != null ? `${Math.round(p.adherence * 100)}%` : "—"}</span>
            <span className={cn(semDados && "text-warning font-medium")}>{relTime(p.lastReadingAt)}</span>
            {p.openAlerts > 0 && (
              <span className="inline-flex items-center gap-1 text-error font-medium">
                <Bell className="h-3 w-3" /> {p.openAlerts} alerta{p.openAlerts > 1 ? "s" : ""}
              </span>
            )}
          </div>
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

/**
 * A fila (`useProfessionalPatients`) não traz Tempo no Alvo nem cuidador —
 * esses hooks são por paciente (`patientUserId`). Para não inventar um
 * número agregado, buscamos cada paciente ativo carregado individualmente,
 * em um componente invisível, e só então calculamos a média.
 */
export default function ProDashboardPage() {
  const navigate = useNavigate();
  const { patients, contagem, isLoading: loadingPatients } = useProfessionalPatients();
  const { criticos, alerts, isLoading: loadingAlerts } = useProfessionalAlerts();
  const [filtroRisco, setFiltroRisco] = useState<RiskLevel | null>(null);

  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);

  // Indicadores agregados: três consultas para a carteira toda, não três por
  // paciente (ver useIndicadoresDaCarteira).
  const idsAtivos = useMemo(
    () => ativos.map((p) => p.patient_user_id).filter(Boolean),
    [ativos],
  );
  const carteira = useIndicadoresDaCarteira(idsAtivos);

  const fila = useMemo(
    () => (filtroRisco ? ativos.filter((p) => p.risk === filtroRisco) : ativos),
    [ativos, filtroRisco],
  );

  const daFila = useMemo(() => {
    const comPa = ativos.filter((p) => p.bpAvg);
    const noAlvo = comPa.filter((p) => {
      const [s, d] = (p.bpAvg ?? "").split("/").map(Number);
      return Number.isFinite(s) && Number.isFinite(d) && s <= 130 && d <= 80;
    });
    const comAdesao = ativos.filter((p) => p.adherence != null);
    const adesaoMedia = comAdesao.length
      ? comAdesao.reduce((s, p) => s + (p.adherence ?? 0), 0) / comAdesao.length
      : null;
    const semRegistro10d = ativos.filter(
      (p) => !p.lastReadingAt || Date.now() - new Date(p.lastReadingAt).getTime() > 10 * 86400000,
    ).length;
    return {
      percentualNoAlvo: comPa.length ? Math.round((noAlvo.length / comPa.length) * 100) : null,
      adesaoMedia: adesaoMedia != null ? Math.round(adesaoMedia * 100) : null,
      semRegistro10d,
    };
  }, [ativos]);

  const loading = loadingPatients || loadingAlerts;

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
          <button onClick={() => setFiltroRisco(null)} className="text-left">
            <StatCard label="Carteira" value={ativos.length} icon={Users} className={cn(!filtroRisco && "ring-2 ring-primary/40")} />
          </button>
          <button onClick={() => setFiltroRisco("red")} className="text-left">
            <StatCard label="Prioridade" value={contagem.vermelho} icon={AlertTriangle} iconColor="hsl(var(--error))" className={cn(filtroRisco === "red" && "ring-2 ring-error/40")} />
          </button>
          <button onClick={() => setFiltroRisco("yellow")} className="text-left">
            <StatCard label="Atenção" value={contagem.amarelo} icon={Clock} iconColor="hsl(var(--warning))" className={cn(filtroRisco === "yellow" && "ring-2 ring-warning/40")} />
          </button>
          <button onClick={() => setFiltroRisco("green")} className="text-left">
            <StatCard label="Estáveis" value={contagem.verde} icon={Target} iconColor="hsl(var(--success))" className={cn(filtroRisco === "green" && "ring-2 ring-success/40")} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.7fr_1fr] gap-5">
        {/* Fila */}
        <div>
          <SectionHeader
            title="Fila de risco"
            subtitle={filtroRisco ? `filtrando por ${RISK_LABEL[filtroRisco].toLowerCase()}` : "ordenada por quem precisa de você"}
            action={filtroRisco && <Button variant="ghost" size="sm" onClick={() => setFiltroRisco(null)}>Limpar filtro</Button>}
          />
          {loading ? (
            <ListSkeleton rows={4} />
          ) : fila.length === 0 ? (
            <EmptyState
              icon={Users}
              title={ativos.length === 0 ? "Nenhum paciente ainda" : "Nada nesse filtro"}
              description={ativos.length === 0 ? "Convide seu primeiro paciente para começar o acompanhamento." : "Ninguém nessa faixa de risco no momento."}
              variant="card"
            />
          ) : (
            <div className="space-y-2.5">
              {fila.map((p) => (
                <PatientQueueCard key={p.link_id} p={p} onOpen={() => navigate(`/pro/pacientes/${p.patient_user_id}`)} />
              ))}
            </div>
          )}
        </div>

        {/* Lateral */}
        <div className="space-y-5">
          <SurfaceCard>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-error" />
              <h3 className="text-sm font-semibold text-foreground">Alertas críticos abertos</h3>
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
            {alerts.length > criticos.length && (
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate("/pro/alertas")}>
                Ver todos os alertas <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Indicadores da carteira</h3>
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">No alvo de pressão</dt>
                <dd className="font-semibold tabular-nums">{daFila.percentualNoAlvo != null ? `${daFila.percentualNoAlvo}%` : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Adesão média</dt>
                <dd className="font-semibold tabular-nums">{daFila.adesaoMedia != null ? `${daFila.adesaoMedia}%` : "—"}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Sem registro há +10 dias</dt>
                <dd className={cn("font-semibold tabular-nums", daFila.semRegistro10d > 0 && "text-warning")}>{daFila.semRegistro10d}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Tempo no Alvo médio (mês)</dt>
                <dd className="font-semibold tabular-nums">
                  {carteira.tempoNoAlvoMedio != null ? `${carteira.tempoNoAlvoMedio}%` : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Com cuidador ativo</dt>
                <dd className="font-semibold tabular-nums">
                  {ativos.length > 0 ? `${carteira.comCuidador} de ${ativos.length}` : "—"}
                </dd>
              </div>
              {carteira.tempoNoAlvoMedio != null && carteira.pacientesComMedida < ativos.length && (
                <p className="text-[10px] text-muted-foreground pt-0.5">
                  Tempo no Alvo calculado sobre {carteira.pacientesComMedida} de {ativos.length} pacientes —
                  os demais não têm medidas suficientes no período.
                </p>
              )}
            </dl>
          </SurfaceCard>

          <InviteCard />
        </div>
      </div>
    </div>
  );
}
