/**
 * AtividadePage — passos, minutos ativos e exercício.
 */
import { useMemo } from "react";
import { Footprints, Flame, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { useActivity } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { DOMAIN_COLORS } from "@/theme/colors";

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AtividadePage() {
  const activity = useActivity();
  const { targets, isLoading: loadingTargets } = useTargets();

  const isLoading = activity.isLoading || loadingTargets;

  const chart14d = useMemo(() => {
    return [...activity.records]
      .slice(0, 14)
      .reverse()
      .map((r) => ({ dia: fmtDia(r.activity_date), passos: r.steps ?? 0 }));
  }, [activity.records]);

  const mvpaSemana = activity.mvpaSemana;
  const metaMvpa = targets.mvpa_minutes_week;
  const pctMvpa = Math.min(100, Math.round((mvpaSemana / Math.max(1, metaMvpa)) * 100));

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Atividade" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Atividade" subtitle="Passos e exercício" />

      {/* ── Resumo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard
          label="Passos hoje"
          value={activity.hoje?.steps ?? "—"}
          icon={Footprints}
          iconColor={DOMAIN_COLORS.atividade}
        />
        <StatCard
          label="Meta diária"
          value={targets.steps_per_day}
          icon={Footprints}
          iconColor={DOMAIN_COLORS.atividade}
        />
      </div>

      {/* ── Gráfico de passos 14 dias ────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Passos — 14 dias" subtitle={`meta ${targets.steps_per_day.toLocaleString("pt-BR")}/dia`} />
        {chart14d.length === 0 ? (
          <EmptyState icon={Footprints} title="Sem passos registrados" description="Conecte a pulseira para ver seus passos aqui." variant="card" />
        ) : (
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chart14d} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <ReferenceLine y={targets.steps_per_day} stroke={DOMAIN_COLORS.atividade} strokeDasharray="4 4" />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString("pt-BR")} passos`, ""]} />
                <Bar dataKey="passos" fill={DOMAIN_COLORS.atividade} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>
        )}
      </div>

      {/* ── Minutos ativos na semana ─────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Minutos de exercício nesta semana" />
        <SurfaceCard>
          <div className="flex items-end justify-between mb-2">
            <p className="text-3xl font-bold text-foreground">{mvpaSemana} <span className="text-base font-normal text-muted-foreground">min</span></p>
            <p className="text-sm text-muted-foreground">meta: {metaMvpa} min</p>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pctMvpa}%`, background: DOMAIN_COLORS.atividade }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{pctMvpa}% da meta semanal recomendada.</p>
        </SurfaceCard>
      </div>

      {/* ── O que conta como atividade moderada ──────────────────── */}
      <SurfaceCard className="mb-5 bg-cardio-50 border-0">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-card grid place-items-center shrink-0">
            <Flame className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">O que conta como atividade moderada?</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Caminhar rápido, pedalar tranquilo, dançar, nadar devagar — qualquer coisa que aumente sua respiração,
              mas ainda dá para conversar enquanto faz. Se você não consegue mais falar frases inteiras, já é intenso, não moderado.
            </p>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Histórico ────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Histórico" />
        {activity.records.length === 0 ? (
          <EmptyState icon={Footprints} title="Sem histórico" description="Seus dias de atividade aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-2.5">
            {activity.records.slice(0, 14).map((r) => (
              <SurfaceCard key={r.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{fmtDia(r.activity_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {(r.moderate_minutes ?? 0) + (r.vigorous_minutes ?? 0)} min ativos
                    {r.distance_km ? ` · ${r.distance_km.toFixed(1)} km` : ""}
                  </p>
                </div>
                <p className="text-lg font-bold text-foreground">{(r.steps ?? 0).toLocaleString("pt-BR")}</p>
              </SurfaceCard>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Dados vindos da pulseira — passos e minutos são estimativas de sensor, dentro da margem normal para uso diário.
        </p>
      </div>
    </div>
  );
}
