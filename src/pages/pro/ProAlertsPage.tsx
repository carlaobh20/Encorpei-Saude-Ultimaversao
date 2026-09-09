/**
 * ALERTAS — todos os alertas da carteira, agrupados por severidade e por
 * paciente, com filtro de não lidos, marcar lido / dispensar, e o limiar
 * que disparou cada um ao lado do valor (docs §2.6).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, Archive, AlertTriangle, Clock, Info, Siren } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { useProfessionalAlerts, useProfessionalPatients } from "@/hooks/useProfessional";
import type { CardioAlert, Severity } from "@/types/cardio";

type Filter = "todos" | "nao_lidos";

const SEVERITY_META: Record<Severity, { label: string; icon: typeof Bell; tone: string; bg: string }> = {
  emergency: { label: "Emergência", icon: Siren, tone: "text-error", bg: "bg-error-bg" },
  critical: { label: "Crítico", icon: AlertTriangle, tone: "text-error", bg: "bg-error-bg" },
  warning: { label: "Atenção", icon: Clock, tone: "text-warning", bg: "bg-warning-bg" },
  info: { label: "Informativo", icon: Info, tone: "text-muted-foreground", bg: "bg-secondary" },
};
const SEVERITY_ORDER: Record<Severity, number> = { emergency: 0, critical: 1, warning: 2, info: 3 };

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

function AlertRow({ a, patientName, onOpen, onRead, onDismiss }: {
  a: CardioAlert; patientName: string; onOpen: () => void; onRead: () => void; onDismiss: () => void;
}) {
  const meta = SEVERITY_META[a.severity];
  return (
    <div className={cn("flex items-start gap-3 p-4 border-b border-border last:border-0", !a.is_read && "bg-primary/[0.03]")}>
      <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", meta.bg, meta.tone)}>
        <meta.icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onOpen} className="text-sm font-semibold text-foreground hover:text-primary truncate">{patientName}</button>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.tone)}>{meta.label}</span>
          {!a.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>
        <p className="text-sm text-foreground mt-0.5">{a.title}</p>
        {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
          <span>valor: <b className="text-foreground tabular-nums">{a.trigger_value ?? "—"}</b></span>
          <span>limiar: {a.threshold_value ?? "—"}</span>
          <span>{relTime(a.triggered_at)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!a.is_read && (
          <Button variant="ghost" size="sm" onClick={onRead} title="Marcar como lido"><Check className="h-3.5 w-3.5" /></Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDismiss} title="Dispensar"><Archive className="h-3.5 w-3.5" /></Button>
      </div>
    </div>
  );
}

export default function ProAlertsPage() {
  const navigate = useNavigate();
  const { alerts, isLoading, marcarLido, dispensar } = useProfessionalAlerts();
  const { patients } = useProfessionalPatients();
  const [filter, setFilter] = useState<Filter>("todos");
  const [groupBy, setGroupBy] = useState<"severidade" | "paciente">("severidade");

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.patient_user_id, p.full_name));
    return m;
  }, [patients]);

  const filtered = useMemo(
    () => alerts.filter((a) => (filter === "nao_lidos" ? !a.is_read : true)),
    [alerts, filter],
  );

  const groups = useMemo(() => {
    if (groupBy === "severidade") {
      const bySev = new Map<Severity, CardioAlert[]>();
      for (const a of filtered) {
        const list = bySev.get(a.severity) ?? [];
        list.push(a);
        bySev.set(a.severity, list);
      }
      return [...bySev.entries()]
        .sort(([a], [b]) => SEVERITY_ORDER[a] - SEVERITY_ORDER[b])
        .map(([sev, list]) => ({
          key: sev,
          title: SEVERITY_META[sev].label,
          list: list.sort((a, b) => b.triggered_at.localeCompare(a.triggered_at)),
        }));
    }
    const byPatient = new Map<string, CardioAlert[]>();
    for (const a of filtered) {
      const list = byPatient.get(a.patient_user_id) ?? [];
      list.push(a);
      byPatient.set(a.patient_user_id, list);
    }
    return [...byPatient.entries()]
      .sort(([, la], [, lb]) => lb.length - la.length)
      .map(([uid, list]) => ({
        key: uid,
        title: nameOf.get(uid) ?? "Paciente",
        list: list.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.triggered_at.localeCompare(a.triggered_at)),
      }));
  }, [filtered, groupBy, nameOf]);

  const naoLidos = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Alertas"
        subtitle={naoLidos > 0 ? `${naoLidos} não lido${naoLidos > 1 ? "s" : ""}` : "Tudo revisado"}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["todos", "nao_lidos"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 h-9 rounded-xl text-xs font-semibold border transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-border-strong")}>
            {f === "todos" ? `Todos (${alerts.length})` : `Não lidos (${naoLidos})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 text-xs">
          <span className="text-muted-foreground mr-1">Agrupar por</span>
          {(["severidade", "paciente"] as const).map((g) => (
            <button key={g} onClick={() => setGroupBy(g)}
              className={cn("px-2.5 h-8 rounded-lg border capitalize", groupBy === g ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground")}>
              {g}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Bell} title="Nenhum alerta" description={filter === "nao_lidos" ? "Nada não lido no momento." : "Quando um limiar disparar, aparece aqui."} variant="card" />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <SectionHeader title={g.title} subtitle={`${g.list.length} alerta${g.list.length > 1 ? "s" : ""}`} />
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                {g.list.map((a) => (
                  <AlertRow
                    key={a.id}
                    a={a}
                    patientName={nameOf.get(a.patient_user_id) ?? "Paciente"}
                    onOpen={() => navigate(`/pro/pacientes/${a.patient_user_id}`)}
                    onRead={() => marcarLido.mutate(a.id)}
                    onDismiss={() => dispensar.mutate(a.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
