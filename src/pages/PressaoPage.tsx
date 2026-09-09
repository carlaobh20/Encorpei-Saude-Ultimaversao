/**
 * PressaoPage — pressão arterial e coração.
 *
 * Registro grande de pressão, gráfico de 30 dias com a faixa-alvo, média de
 * MRPA (só medidas válidas de manguito — ver docs §4), histórico com badge
 * de proveniência, e frequência cardíaca de repouso.
 */
import { useMemo, useState } from "react";
import { Gauge, HeartPulse, Info } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceArea,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBloodPressure, useHeartRate } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import { DOMAIN_COLORS } from "@/theme/colors";
import type { BpContext } from "@/types/cardio";

const CONTEXTO_LABEL: Record<BpContext, string> = {
  morning: "Manhã",
  evening: "Noite",
  random: "Outro horário",
  symptom: "Por sintoma",
  office: "No consultório",
};

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtDiaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PressaoPage() {
  const bp = useBloodPressure();
  const hr = useHeartRate();
  const { targets, isLoading: loadingTargets } = useTargets();

  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [context, setContext] = useState<BpContext>("morning");
  const [arm, setArm] = useState<"left" | "right">("right");
  const [cuffValidated, setCuffValidated] = useState<boolean | null>(null);

  const isLoading = bp.isLoading || loadingTargets;

  const chartData30d = useMemo(() => {
    const corte = Date.now() - 30 * 86_400_000;
    return [...bp.readings]
      .filter((r) => r.cuff_validated && +new Date(r.recorded_at) >= corte)
      .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at))
      .map((r) => ({ dia: fmtDia(r.recorded_at), sistolica: r.systolic, diastolica: r.diastolic }));
  }, [bp.readings]);

  const mrpa = useMemo(() => mediaMrpa(bp.readings, new Date(), 7), [bp.readings]);

  const hrChartData = useMemo(() => {
    const corte = Date.now() - 30 * 86_400_000;
    return [...hr.repouso]
      .filter((r) => +new Date(r.recorded_at) >= corte)
      .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at))
      .map((r) => ({ dia: fmtDia(r.recorded_at), bpm: r.bpm }));
  }, [hr.repouso]);

  const podeSalvar =
    systolic.trim() !== "" && diastolic.trim() !== "" && cuffValidated !== null;

  const salvar = () => {
    if (!podeSalvar) return;
    bp.registrar.mutate({
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      pulse: pulse.trim() ? Number(pulse) : null,
      context,
      arm,
      cuff_validated: cuffValidated!,
    });
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setCuffValidated(null);
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Pressão e coração" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Pressão e coração" subtitle="Registre e acompanhe sua pressão" />

      {/* ── Registro ─────────────────────────────────────────────── */}
      <SurfaceCard className="mb-5">
        <SectionHeader title="Registrar pressão" icon={Gauge} />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <Label htmlFor="sistolica" className="text-xs text-muted-foreground">Sistólica (o número maior)</Label>
            <Input
              id="sistolica" inputMode="numeric" placeholder="ex.: 128" value={systolic}
              onChange={(e) => setSystolic(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-2xl font-bold text-center mt-1"
            />
          </div>
          <div>
            <Label htmlFor="diastolica" className="text-xs text-muted-foreground">Diastólica (o número menor)</Label>
            <Input
              id="diastolica" inputMode="numeric" placeholder="ex.: 82" value={diastolic}
              onChange={(e) => setDiastolic(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-2xl font-bold text-center mt-1"
            />
          </div>
        </div>

        <div className="mb-3">
          <Label htmlFor="pulso" className="text-xs text-muted-foreground">Pulso (opcional)</Label>
          <Input
            id="pulso" inputMode="numeric" placeholder="ex.: 70" value={pulse}
            onChange={(e) => setPulse(e.target.value.replace(/\D/g, ""))}
            className="h-11 mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <Label className="text-xs text-muted-foreground">Quando mediu</Label>
            <Select value={context} onValueChange={(v) => setContext(v as BpContext)}>
              <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTEXTO_LABEL) as BpContext[]).map((c) => (
                  <SelectItem key={c} value={c}>{CONTEXTO_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Braço</Label>
            <Select value={arm} onValueChange={(v) => setArm(v as "left" | "right")}>
              <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Direito</SelectItem>
                <SelectItem value="left">Esquerdo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-1">
          <Label className="text-xs text-muted-foreground">Você mediu com aparelho de braço?</Label>
          <div className="grid grid-cols-2 gap-3 mt-1.5">
            <button
              type="button"
              onClick={() => setCuffValidated(true)}
              className={cn(
                "h-12 rounded-xl border text-sm font-semibold transition-colors",
                cuffValidated === true ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground"
              )}
            >
              Sim, aparelho de braço
            </button>
            <button
              type="button"
              onClick={() => setCuffValidated(false)}
              className={cn(
                "h-12 rounded-xl border text-sm font-semibold transition-colors",
                cuffValidated === false ? "bg-secondary text-foreground border-border-strong" : "border-border bg-card text-foreground"
              )}
            >
              Não / outro tipo
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Só a medida com aparelho de braço entra na média que seu médico usa e pode gerar alerta — aparelho de pulso ou de dedo não é confiável para isso.
          </p>
        </div>

        <Button
          size="xl"
          className="w-full mt-4"
          disabled={!podeSalvar || bp.registrar.isPending}
          onClick={salvar}
        >
          {bp.registrar.isPending ? "Salvando..." : "Salvar pressão"}
        </Button>
      </SurfaceCard>

      {/* ── Média de MRPA ────────────────────────────────────────── */}
      <SurfaceCard className="mb-5 bg-cardio-50 border-0">
        <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Média dos últimos 7 dias</p>
        {mrpa ? (
          <>
            <p className="text-3xl font-bold text-foreground">{mrpa.systolic}/{mrpa.diastolic} <span className="text-base font-normal text-muted-foreground">mmHg</span></p>
            <p className="text-xs text-muted-foreground mt-1">Calculada com {mrpa.n} medida{mrpa.n > 1 ? "s" : ""} válida{mrpa.n > 1 ? "s" : ""} de manhã e à noite, com manguito.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Ainda não há medidas suficientes (mínimo 2, de manhã ou à noite, com aparelho de braço) para calcular a média.</p>
        )}
      </SurfaceCard>

      {/* ── Gráfico 30 dias ──────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Últimos 30 dias" subtitle="faixa em verde é o seu alvo" />
        {chartData30d.length === 0 ? (
          <EmptyState icon={Gauge} title="Sem medidas ainda" description="Registre sua pressão para ver o gráfico." variant="card" />
        ) : (
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData30d} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                <ReferenceArea y1={0} y2={targets.bp_diastolic_max} fill="hsl(var(--success))" fillOpacity={0.06} ifOverflow="extendDomain" />
                <ReferenceArea y1={0} y2={targets.bp_systolic_max} fill="hsl(var(--success))" fillOpacity={0.06} ifOverflow="extendDomain" />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="sistolica" stroke={DOMAIN_COLORS.pressao} strokeWidth={2.5} dot={false} name="Sistólica" />
                <Line type="monotone" dataKey="diastolica" stroke={DOMAIN_COLORS.atividade} strokeWidth={2.5} dot={false} name="Diastólica" />
              </LineChart>
            </ResponsiveContainer>
          </SurfaceCard>
        )}
      </div>

      {/* ── Histórico ────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Últimas leituras" />
        {bp.readings.length === 0 ? (
          <EmptyState icon={Gauge} title="Nenhuma leitura registrada" description="Suas medidas aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-2.5">
            {bp.readings.slice(0, 12).map((r) => {
              const prov = rotuloProveniencia(r.source_type, r.validation_status, r.source_device_name);
              return (
                <SurfaceCard key={r.id} className={cn("flex items-center justify-between gap-3", prov.tone === "warning" && "opacity-70")}>
                  <div>
                    <p className={cn("text-lg font-bold", prov.tone === "warning" ? "text-muted-foreground" : "text-foreground")}>
                      {r.systolic}/{r.diastolic} <span className="text-xs font-normal text-muted-foreground">mmHg</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{fmtDiaHora(r.recorded_at)} · {CONTEXTO_LABEL[r.context]}</p>
                  </div>
                  <span className={cn(
                    "text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0",
                    prov.tone === "warning" ? "bg-muted text-muted-foreground" : "bg-cardio-50 text-primary"
                  )}>
                    {prov.label}
                  </span>
                </SurfaceCard>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          Leituras em cinza são estimativas da pulseira — não usadas para decisão clínica.
        </p>
      </div>

      {/* ── Frequência cardíaca de repouso ───────────────────────── */}
      <div>
        <SectionHeader title="Batimentos de repouso" icon={HeartPulse} />
        {hrChartData.length === 0 ? (
          <EmptyState icon={HeartPulse} title="Sem dados de batimentos" description="Conecte a pulseira ou registre manualmente." variant="card" />
        ) : (
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={hrChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["dataMin - 10", "dataMax + 10"]} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v} bpm`, "Batimentos"]} />
                <Line type="monotone" dataKey="bpm" stroke={DOMAIN_COLORS.coracao} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </SurfaceCard>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          Variabilidade de batimentos (HRV) aparece aqui quando sua pulseira envia esse dado.
        </p>
      </div>
    </div>
  );
}
