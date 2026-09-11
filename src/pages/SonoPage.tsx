/**
 * SonoPage — sono da pulseira.
 *
 * Duração por noite contra a meta, composição do sono, eficiência,
 * despertares, batimentos e oxigenação mínimos. Dessaturação recorrente
 * (§2.6 spo2_noturna) gera um cartão de atenção com o texto do paciente.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * O limiar de 90% de SpO2 em 7 noites e o texto de `ALERT_RULES` seguem
 * idênticos. Mudou:
 *
 *  · Os quatro `StatCard` de resumo passaram a cartões de medida na escala do
 *    paciente. `StatCard` continua existindo e continua servindo as telas do
 *    médico — lá o rótulo de 12px dentro de uma grade de oito indicadores é o
 *    desenho certo; aqui ele obrigava a apertar os olhos.
 *
 *  · O gráfico de 14 noites ganhou eixo com unidade (h), legenda dizendo o
 *    que é a linha tracejada (a meta), e animação desligada sob
 *    `prefers-reduced-motion`.
 *
 *  · A composição da noite passou a `BarraProporcao`, que traz o número em
 *    texto ao lado do rótulo: antes, três barras de cores diferentes eram
 *    três barras iguais para quem não distingue as cores.
 */
import { useMemo } from "react";
import { Moon, HeartPulse, Wind } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, BarraProporcao, AvisoDaTela,
  AreaGrafico, LegendaGrafico, usePrefereMenosMovimento,
  gradeGrafico, eixoX, eixoY, dicaGrafico, COR_SERIE, COR_SERIE_APOIO, COR_REFERENCIA,
} from "@/components/shell";
import { useSleep } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { ALERT_RULES } from "@/lib/clinical/cardioAlertRules";

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function horas(min: number): string {
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

/**
 * Um número da noite. `valor: null` vira "sem registro" — nunca zero: zero
 * despertares e "a pulseira não mandou nada" são coisas diferentes, e trocar
 * uma pela outra é mentir com aparência de dado.
 */
function MedidaDaNoite({
  rotulo, valor, icone: Icone,
}: {
  rotulo: string;
  valor: string | null;
  icone: typeof Moon;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <Icone className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="text-sm font-medium text-muted-foreground truncate">{rotulo}</span>
      </div>
      {valor === null ? (
        <p className="text-base text-muted-foreground">Sem registro</p>
      ) : (
        <p className="text-[28px] leading-none font-semibold tabular-nums text-foreground">{valor}</p>
      )}
    </div>
  );
}

export default function SonoPage() {
  const sleep = useSleep();
  const { targets, isLoading: loadingTargets } = useTargets();
  const reduzirMovimento = usePrefereMenosMovimento();

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
      <TelaPaciente>
        <PageHeader title="Sono" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Sono" subtitle="O que a pulseira registrou à noite" />

      {sleep.records.length === 0 ? (
        <EmptyState
          icon={Moon}
          title="Sem dados de sono"
          description="Conecte sua pulseira para acompanhar o sono aqui."
          variant="card"
        />
      ) : (
        <>
          {/* ── Dessaturação — cartão de atenção ───────────────────── */}
          {temDessaturacao && (
            <AvisoDaTela tom="atencao" titulo={ALERT_RULES.spo2_noturna.label}>
              {ALERT_RULES.spo2_noturna.patientMessage}
            </AvisoDaTela>
          )}

          {/* ── Resumo da última noite ───────────────────────────── */}
          <section>
            <TituloSecao titulo="Sua última noite" />
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
              <MedidaDaNoite rotulo="Tempo dormindo" valor={ultima ? horas(ultima.total_minutes) : null} icone={Moon} />
              <MedidaDaNoite rotulo="Eficiência" valor={ultima?.efficiency_pct != null ? `${ultima.efficiency_pct}%` : null} icone={Moon} />
              <MedidaDaNoite rotulo="Despertares" valor={ultima?.awakenings != null ? String(ultima.awakenings) : null} icone={Moon} />
              <MedidaDaNoite rotulo="Batimentos mínimos" valor={ultima?.min_heart_rate ? `${ultima.min_heart_rate} bpm` : null} icone={HeartPulse} />
              <MedidaDaNoite rotulo="Oxigenação mínima" valor={ultima?.min_spo2 != null ? `${ultima.min_spo2}%` : null} icone={Wind} />
            </div>
          </section>

          {/* ── Gráfico 14 dias contra a meta ─────────────────────── */}
          <section>
            <TituloSecao titulo="Duração — 14 noites" subtitulo={`meta ${targets.sleep_hours}h`} />
            <SurfaceCard>
              <AreaGrafico altura={220}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart14d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    {gradeGrafico()}
                    {eixoX("dia")}
                    {eixoY({ unidade: "horas" })}
                    <ReferenceLine y={targets.sleep_hours} stroke={COR_REFERENCIA} strokeDasharray="4 4" />
                    {dicaGrafico((v: never) => [`${v} h`, "Sono"])}
                    <Bar
                      dataKey="horas" name="Sono" fill={COR_SERIE} radius={[6, 6, 0, 0]}
                      isAnimationActive={!reduzirMovimento}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </AreaGrafico>
              <LegendaGrafico
                itens={[
                  { cor: COR_SERIE, rotulo: "Horas dormidas por noite" },
                  { cor: COR_REFERENCIA, rotulo: `Meta combinada (${targets.sleep_hours}h)` },
                ]}
              />
            </SurfaceCard>
          </section>

          {/* ── Composição do sono ────────────────────────────────── */}
          {ultima && (ultima.deep_minutes != null || ultima.light_minutes != null || ultima.rem_minutes != null) && (
            <section>
              <TituloSecao titulo="Composição da última noite" />
              <SurfaceCard>
                <div className="space-y-4">
                  {[
                    { label: "Sono profundo", min: ultima.deep_minutes, cor: COR_SERIE },
                    { label: "Sono leve", min: ultima.light_minutes, cor: COR_SERIE_APOIO },
                    { label: "REM", min: ultima.rem_minutes, cor: "hsl(var(--brand-cardio-light))" },
                  ].filter((x) => x.min != null).map((x) => {
                    const pct = Math.round(((x.min ?? 0) / Math.max(1, ultima.total_minutes)) * 100);
                    return (
                      <BarraProporcao
                        key={x.label}
                        rotulo={x.label}
                        valor={`${horas(x.min ?? 0)} · ${pct}%`}
                        percentual={pct}
                        cor={x.cor}
                      />
                    );
                  })}
                </div>
              </SurfaceCard>
            </section>
          )}
        </>
      )}
    </TelaPaciente>
  );
}
