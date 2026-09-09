/**
 * RemediosPage — a tela mais usada no dia a dia.
 *
 * Doses de hoje com botão enorme de "tomei", lista dos remédios ativos em
 * linguagem leiga, adesão dos últimos 7/14/30 dias e aviso de adesão baixa.
 * Nunca sugere mudar dose (regra 1 do contrato).
 */
import { useMemo } from "react";
import { Pill, Check, Clock, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCardioMedications, MED_CLASS_LABEL } from "@/hooks/useCardioMedications";
import { ALERT_RULES } from "@/lib/clinical/cardioAlertRules";
import type { MedClass } from "@/types/cardio";

/** Para que serve cada classe, em linguagem de paciente — nunca conduta. */
const MED_CLASS_PARA_QUE_SERVE: Record<MedClass, string> = {
  acei: "Controla a pressão e protege o coração e os rins.",
  arb: "Controla a pressão e protege o coração e os rins.",
  arni: "Fortalece o coração na insuficiência cardíaca.",
  beta_blocker: "Deixa o coração bater mais devagar e com menos esforço.",
  ccb: "Relaxa os vasos sanguíneos para baixar a pressão.",
  sglt2: "Protege o coração e os rins, e ajuda a controlar o açúcar no sangue.",
  mra: "Ajuda a tirar o excesso de líquido e protege o coração.",
  loop_diuretic: "Tira o excesso de líquido do corpo — o \"diurético\".",
  thiazide: "Tira o excesso de líquido e ajuda a controlar a pressão.",
  statin: "Baixa o colesterol para proteger as artérias.",
  ezetimibe: "Ajuda a baixar o colesterol.",
  pcsk9: "Baixa bastante o colesterol quando os outros remédios não bastam.",
  antiplatelet: "Deixa o sangue menos propenso a formar coágulos.",
  anticoagulant: "Afina o sangue para prevenir coágulos.",
  antiarrhythmic: "Ajuda o coração a manter o ritmo certo.",
  nitrate: "Alivia a dor no peito abrindo os vasos do coração.",
  other: "Faz parte do seu tratamento — pergunte ao seu médico se tiver dúvida.",
};

function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export default function RemediosPage() {
  const { ativas, dosesDeHoje, adesao, isLoading, marcarDose } = useCardioMedications();

  const porHorario = useMemo(() => {
    const grupos = new Map<string, typeof dosesDeHoje>();
    for (const d of dosesDeHoje) {
      const lista = grupos.get(d.hora) ?? [];
      lista.push(d);
      grupos.set(d.hora, lista);
    }
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dosesDeHoje]);

  const adesaoBaixa = adesao != null && adesao.d14 != null && adesao.d14 < 0.8;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Remédios" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Remédios" subtitle="Suas doses de hoje" />

      {adesaoBaixa && (
        <SurfaceCard className="mb-5 bg-warning-bg border-0">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <p className="text-sm text-foreground leading-relaxed">{ALERT_RULES.adesao_baixa.patientMessage}</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Doses de hoje ────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Hoje" icon={Clock} />
        {porHorario.length === 0 ? (
          <EmptyState icon={Pill} title="Nenhum remédio cadastrado" description="Quando seu médico prescrever, seus horários aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-5">
            {porHorario.map(([hora, doses]) => (
              <div key={hora}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{hora}</p>
                <div className="space-y-2.5">
                  {doses.map((d) => (
                    <SurfaceCard key={`${d.med.id}-${d.hora}`} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-foreground truncate">{d.med.name}</p>
                        <p className="text-xs text-muted-foreground">{d.med.dose} · {MED_CLASS_LABEL[d.med.med_class]}</p>
                      </div>
                      <Button
                        size="xl"
                        variant={d.taken ? "secondary" : "default"}
                        className={cn("shrink-0 gap-2", d.taken && "bg-success-bg text-success hover:bg-success-bg")}
                        disabled={marcarDose.isPending}
                        onClick={() =>
                          marcarDose.mutate({ medicationId: d.med.id, hora: d.hora, taken: !d.taken })
                        }
                      >
                        <Check className="h-5 w-5" />
                        {d.taken ? "Tomei" : "Marcar"}
                      </Button>
                    </SurfaceCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Adesão ───────────────────────────────────────────────── */}
      {adesao && (
        <div className="mb-6">
          <SectionHeader title="Sua constância" />
          <SurfaceCard>
            <div className="space-y-4">
              {[
                { label: "Últimos 7 dias", valor: adesao.d7 },
                { label: "Últimos 14 dias", valor: adesao.d14 },
                { label: "Últimos 30 dias", valor: adesao.d30 },
              ].map((linha) => (
                <div key={linha.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{linha.label}</span>
                    <span className="font-semibold text-foreground">{pct(linha.valor)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", (linha.valor ?? 1) < 0.8 ? "bg-warning" : "bg-success")}
                      style={{ width: `${Math.round((linha.valor ?? 0) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {/* ── Remédios ativos ──────────────────────────────────────── */}
      <div>
        <SectionHeader title="Seus remédios" />
        {ativas.length === 0 ? (
          <EmptyState icon={Pill} title="Nenhum remédio ativo" description="Seus remédios prescritos aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-3">
            {ativas.map((m) => (
              <SurfaceCard key={m.id}>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                    <Pill className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground mb-1.5">{m.dose} · {m.schedule.join(", ")}</p>
                    <p className="text-sm text-foreground leading-relaxed">{MED_CLASS_PARA_QUE_SERVE[m.med_class]}</p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
