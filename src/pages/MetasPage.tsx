/**
 * MetasPage — as metas definidas pelo cardiologista e a distância até cada
 * uma. Eixo do produto (docs §1): alvo → medida, nunca conduta sugerida.
 */
import { Target, Info } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { cn } from "@/lib/utils";
import { useTargets } from "@/hooks/useCardioPatient";
import { useBloodPressure, useHeartRate, useWeight, useActivity, useSleep } from "@/hooks/useCardioReadings";
import { useLabResults } from "@/hooks/useCardioClinical";
import { mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { avaliarMeta, type TargetProgress } from "@/lib/clinical/cardioTargets";

const STATUS_TONE: Record<TargetProgress["status"], { bg: string; text: string; label: string }> = {
  on_target: { bg: "bg-success-bg", text: "text-success", label: "No alvo" },
  near: { bg: "bg-warning-bg", text: "text-warning", label: "Quase lá" },
  off_target: { bg: "bg-error-bg", text: "text-error", label: "Fora do alvo" },
  no_data: { bg: "bg-muted", text: "text-muted-foreground", label: "Sem dado ainda" },
};

function MetaCard({ meta }: { meta: TargetProgress }) {
  const tone = STATUS_TONE[meta.status];
  const pct = meta.current == null
    ? 0
    : meta.lowerIsBetter
      ? Math.max(0, Math.min(100, Math.round((meta.target / Math.max(meta.current, 1)) * 100)))
      : Math.max(0, Math.min(100, Math.round((meta.current / Math.max(meta.target, 1)) * 100)));

  return (
    <SurfaceCard>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-semibold text-foreground">{meta.label}</p>
        <span className={cn("text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0", tone.bg, tone.text)}>
          {tone.label}
        </span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <p className="text-2xl font-bold text-foreground">
          {meta.current != null ? meta.current : "—"} <span className="text-sm font-normal text-muted-foreground">{meta.unit}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {meta.lowerIsBetter ? "meta: até" : "meta:"} {meta.target} {meta.unit}
        </p>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full", meta.status === "on_target" ? "bg-success" : meta.status === "near" ? "bg-warning" : meta.status === "off_target" ? "bg-error" : "bg-muted-foreground/30")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </SurfaceCard>
  );
}

export default function MetasPage() {
  const { targets, ehSugestao, isLoading: loadingTargets } = useTargets();
  const bp = useBloodPressure();
  const hr = useHeartRate();
  const weight = useWeight();
  const activity = useActivity();
  const sleep = useSleep();
  const { ultimoPorMarcador, isLoading: loadingLabs } = useLabResults();

  const isLoading = loadingTargets || bp.isLoading || loadingLabs;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Minhas metas" />
        <TabPageSkeleton />
      </div>
    );
  }

  const mrpa = mediaMrpa(bp.readings, new Date(), 7);
  const ldl = ultimoPorMarcador.get("ldl")?.value_num ?? null;
  const restingHr = hr.repouso[0]?.bpm ?? null;

  const metaSistolica = avaliarMeta("Pressão sistólica", mrpa?.systolic ?? null, targets.bp_systolic_max, "mmHg", true);
  const metaDiastolica = avaliarMeta("Pressão diastólica", mrpa?.diastolic ?? null, targets.bp_diastolic_max, "mmHg", true);
  const metaLdl = avaliarMeta("Colesterol LDL", ldl, targets.ldl_max, "mg/dL", true);
  const metaFc = avaliarMeta(
    "Batimentos de repouso", restingHr,
    Math.round((targets.resting_hr_min + targets.resting_hr_max) / 2), "bpm", false, 0.15
  );
  const metaPeso = targets.dry_weight_kg
    ? avaliarMeta("Peso", weight.ultimo?.value ?? null, targets.dry_weight_kg, "kg", true, 0.03)
    : null;
  const metaPassos = avaliarMeta("Passos por dia", activity.passosMedia, targets.steps_per_day, "passos", false);
  const metaAtividade = avaliarMeta("Minutos de atividade por semana", activity.mvpaSemana, targets.mvpa_minutes_week, "min", false);
  const metaSono = avaliarMeta("Sono por noite", sleep.mediaMinutos != null ? +(sleep.mediaMinutos / 60).toFixed(1) : null, targets.sleep_hours, "h", false, 0.15);

  const metas = [metaSistolica, metaDiastolica, metaFc, metaLdl, metaPeso, metaPassos, metaAtividade, metaSono]
    .filter((m): m is TargetProgress => !!m);

  return (
    <div className="pb-10">
      <PageHeader title="Minhas metas" subtitle="Definidas pelo seu médico" />

      {ehSugestao && (
        <SurfaceCard className="mb-5 bg-warning-bg border-0">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">
              Estas são metas sugeridas pelo seu perfil, ainda não confirmadas pelo seu médico. Elas podem mudar na próxima consulta.
            </p>
          </div>
        </SurfaceCard>
      )}

      <div className="mb-2">
        <SectionHeader title="Distância até cada meta" icon={Target} />
      </div>
      <div className="space-y-3">
        {metas.map((m) => <MetaCard key={m.label} meta={m} />)}
      </div>
    </div>
  );
}
