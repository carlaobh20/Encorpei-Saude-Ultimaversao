/**
 * SonoPage — sono da pulseira.
 *
 * Duração por noite contra a meta, composição do sono, eficiência,
 * despertares, batimentos e oxigenação mínimos. Dessaturação recorrente
 * (§2.6 spo2_noturna) gera um cartão de atenção com o texto do paciente.
 */
import { useMemo } from "react";
import { Moon, HeartPulse, Wind, AlertTriangle } from "lucide-react";
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
import { useSleep } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { ALERT_RULES } from "@/lib/clinical/cardioAlertRules";
import { DOMAIN_COLORS } from "@/theme/colors";

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function horas(min: number): string {
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

export default function SonoPage() {
  const sleep = useSleep();
  const { targets, isLoading: loadingTargets } = useTargets();

  const isLoading = sleep.isLoading || loadingTargets;

  const chart14d = useMemo(() => {
    return [...sleep.records]
      .slice(0, 14)
      .reverse()
      .map((r) => ({ dia: fmtDia(r.sleep_date), horas: +(r.total_minutes / 60).toFixed(1) }));
  }, [sleep.records]);

  const ultima = sleep.ultima;
  const temDessaturacao = !!ultima && (ultima.min_spo2 != null) &&
    sleep.records.slice(0, 7).some((r) => r.min_spo2 != null && r.min_spo2 < 90);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Sono" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Sono" subtitle="O que a pulseira registrou à noite" />

      {sleep.records.length === 0 ? (
        <EmptyState icon={Moon} title="Sem dados de sono" description="Conecte sua pulseira para acompanhar o sono aqui." variant="card" />
      ) : (
        <>
          {/* ── Dessaturação — cartão de atenção ───────────────────── */}
          {temDessaturacao && (
            <SurfaceCard className="mb-5 bg-warning-bg border-0">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{ALERT_RULES.spo2_noturna.label}</p>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    {ALERT_RULES.spo2_noturna.patientMessage}
                  </p>
                </div>
              </div>
            </SurfaceCard>
          )}

          {/* ── Resumo da última noite ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard label="Última noite" value={ultima ? horas(ultima.total_minutes) : "—"} icon={Moon} iconColor={DOMAIN_COLORS.sono} />
            <StatCard label="Eficiência" value={ultima?.efficiency_pct != null ? `${ultima.efficiency_pct}%` : "—"} icon={Moon} iconColor={DOMAIN_COLORS.sono} />
            <StatCard label="Despertares" value={ultima?.awakenings ?? "—"} icon={Moon} iconColor={DOMAIN_COLORS.sono} />
            <StatCard label="Batimentos mínimos" value={ultima?.min_heart_rate ? `${ultima.min_heart_rate} bpm` : "—"} icon={HeartPulse} iconColor={DOMAIN_COLORS.coracao} />
          </div>

          <SurfaceCard className="mb-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <Wind className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Oxigenação mínima da noite</p>
                <p className="text-xl font-bold text-foreground">{ultima?.min_spo2 != null ? `${ultima.min_spo2}%` : "—"}</p>
              </div>
            </div>
          </SurfaceCard>

          {/* ── Gráfico 14 dias contra a meta ─────────────────────── */}
          <div className="mb-5">
            <SectionHeader title="Duração — 14 noites" subtitle={`meta ${targets.sleep_hours}h`} />
            <SurfaceCard>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chart14d} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                  <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={targets.sleep_hours} stroke={DOMAIN_COLORS.sono} strokeDasharray="4 4" />
                  <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v} h`, "Sono"]} />
                  <Bar dataKey="horas" fill={DOMAIN_COLORS.sono} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </SurfaceCard>
          </div>

          {/* ── Composição do sono ────────────────────────────────── */}
          {ultima && (ultima.deep_minutes != null || ultima.light_minutes != null || ultima.rem_minutes != null) && (
            <div>
              <SectionHeader title="Composição da última noite" />
              <SurfaceCard>
                <div className="space-y-3">
                  {[
                    { label: "Sono profundo", min: ultima.deep_minutes, color: DOMAIN_COLORS.sono },
                    { label: "Sono leve", min: ultima.light_minutes, color: DOMAIN_COLORS.pressao },
                    { label: "REM", min: ultima.rem_minutes, color: DOMAIN_COLORS.metabolico },
                  ].filter((x) => x.min != null).map((x) => {
                    const pct = Math.round(((x.min ?? 0) / Math.max(1, ultima.total_minutes)) * 100);
                    return (
                      <div key={x.label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{x.label}</span>
                          <span className="font-semibold text-foreground">{horas(x.min ?? 0)} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: x.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SurfaceCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}
