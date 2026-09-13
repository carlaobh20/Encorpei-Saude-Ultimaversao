/**
 * AtividadePage — passos, minutos ativos e exercício.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhuma meta, nenhum cálculo, nenhum texto sobre o que conta como atividade
 * moderada. Mudou:
 *
 *  · "Passos hoje" e "Meta diária" estavam lado a lado como dois indicadores
 *    de mesmo peso, e não são: um é o que o paciente fez, o outro é a régua.
 *    A régua desceu para onde ela serve de fato — o subtítulo do gráfico e a
 *    linha tracejada, agora com legenda escrita.
 *
 *  · Ausência deixou de virar traço solto: sem dado da pulseira o cartão diz
 *    "sem registro", como nos outros cartões de medida do app.
 *
 *  · A barra de minutos da semana passou a `BarraProporcao`, com o valor e a
 *    meta em texto ao lado — a barra sozinha não informa quem não enxerga
 *    cor nem consegue medir comprimento a olho.
 */
import { useMemo } from "react";
import { Footprints, Flame, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { CartaoMedida, type MedidaExibida } from "@/components/shell";
import {
  TelaPaciente, TituloSecao, BarraProporcao, Lista, ItemLista, NotaGrafico,
  AreaGrafico, LegendaGrafico, usePrefereMenosMovimento,
  gradeGrafico, eixoX, eixoY, dicaGrafico, COR_SERIE, COR_REFERENCIA,
} from "@/components/shell";
import { numero, porcentagem, diaCurto } from "@/lib/formato";
import { useActivity } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";

function fmtDia(iso: string): string {
  return diaCurto(iso) ?? "—";
}

export default function AtividadePage() {
  const activity = useActivity();
  const { targets, isLoading: loadingTargets } = useTargets();
  const reduzirMovimento = usePrefereMenosMovimento();

  const isLoading = activity.isLoading || loadingTargets;

  const chart14d = useMemo(() => {
    return [...activity.records]
      .slice(0, 14)
      .reverse()
      .map((r) => ({ dia: fmtDia(r.activity_date), passos: r.steps ?? 0 }));
  }, [activity.records]);

  /**
   * Mesmo erro que o sódio cometia, do lado de cá: a barra e o texto usavam o
   * percentual SATURADO, e a semana de 207 min contra uma meta de 150 min
   * aparecia como "207 min / 100% de 150 min". Os dois números estão na mesma
   * linha e se contradizem — e o "100%" é o que o olho pega. A barra continua
   * saturando (é o comprimento máximo que existe); o texto diz 138%.
   */
  const mvpaSemana = activity.mvpaSemana;
  const metaMvpa = targets.mvpa_minutes_week;
  const pctMvpaReal = Math.round((mvpaSemana / Math.max(1, metaMvpa)) * 100);
  const pctMvpaBarra = Math.min(100, pctMvpaReal);
  const passouDaMeta = pctMvpaReal > 100;

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Atividade" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  const passosHoje: MedidaExibida = {
    rotulo: "Passos hoje",
    icone: Footprints,
    valor: activity.hoje?.steps != null ? activity.hoje.steps.toLocaleString("pt-BR") : null,
    unidade: "passos",
    quando: activity.hoje?.activity_date ? "Hoje" : null,
    origem: activity.hoje ? "Pulseira" : null,
  };

  return (
    <TelaPaciente>
      <PageHeader title="Atividade" subtitle="Passos e exercício" />

      {/* ── Resumo ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
        <CartaoMedida m={passosHoje} />
        <SurfaceCard className="bg-cardio-50 border-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">Sua meta diária</p>
          {/* Mesma quebra do CartaoMedida: em 390px "10.000passos" não tinha
              ponto de quebra e a unidade vazava para fora do cartão. */}
          <p className="flex flex-wrap items-baseline gap-x-1 text-[28px] leading-none font-semibold tabular-nums text-foreground">
            <span>{targets.steps_per_day.toLocaleString("pt-BR")}</span>
            <span className="text-base font-medium text-muted-foreground">passos</span>
          </p>
        </SurfaceCard>
      </div>

      {/* ── Gráfico de passos 14 dias ────────────────────────────── */}
      <section>
        <TituloSecao titulo="Passos — 14 dias" subtitulo={`meta ${targets.steps_per_day.toLocaleString("pt-BR")}/dia`} />
        {chart14d.length === 0 ? (
          <EmptyState icon={Footprints} title="Sem passos registrados" description="Conecte a pulseira para ver seus passos aqui." variant="card" />
        ) : (
          <SurfaceCard>
            <AreaGrafico altura={220}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart14d} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                  {gradeGrafico()}
                  {eixoX("dia")}
                  {eixoY({ unidade: "passos", largura: 60 })}
                  <ReferenceLine y={targets.steps_per_day} stroke={COR_REFERENCIA} strokeDasharray="4 4" />
                  {dicaGrafico((v: never) => [`${Number(v).toLocaleString("pt-BR")} passos`, "Passos"])}
                  <Bar
                    dataKey="passos" name="Passos" fill={COR_SERIE} radius={[6, 6, 0, 0]}
                    isAnimationActive={!reduzirMovimento}
                  />
                </BarChart>
              </ResponsiveContainer>
            </AreaGrafico>
            <LegendaGrafico
              itens={[
                { cor: COR_SERIE, rotulo: "Passos por dia" },
                { cor: COR_REFERENCIA, rotulo: `Meta diária (${targets.steps_per_day.toLocaleString("pt-BR")})` },
              ]}
            />
          </SurfaceCard>
        )}
      </section>

      {/* ── Minutos ativos na semana ─────────────────────────────── */}
      <section>
        <TituloSecao titulo="Minutos de exercício nesta semana" />
        <SurfaceCard>
          <p className="text-3xl font-bold text-foreground tabular-nums">
            {mvpaSemana} <span className="text-base font-normal text-muted-foreground">min</span>
          </p>
          <BarraProporcao
            className="mt-3"
            rotulo={passouDaMeta ? "Acima da meta semanal" : "Da meta semanal"}
            valor={`${porcentagem(pctMvpaReal)} de ${numero(metaMvpa)} min`}
            percentual={pctMvpaBarra}
          />
          {passouDaMeta && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              A barra chega ao fim em {numero(metaMvpa)} min; esta semana você passou disso.
            </p>
          )}
        </SurfaceCard>
      </section>

      {/* ── O que conta como atividade moderada ──────────────────── */}
      <SurfaceCard className="bg-cardio-50 border-0">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-card grid place-items-center shrink-0">
            <Flame className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">O que conta como atividade moderada?</p>
            <p className="text-base text-muted-foreground mt-1 leading-relaxed">
              Caminhar rápido, pedalar tranquilo, dançar, nadar devagar — qualquer coisa que aumente sua respiração,
              mas ainda dá para conversar enquanto faz. Se você não consegue mais falar frases inteiras, já é intenso, não moderado.
            </p>
          </div>
        </div>
      </SurfaceCard>

      {/* ── Histórico ────────────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Histórico" />
        {activity.records.length === 0 ? (
          <EmptyState icon={Footprints} title="Sem histórico" description="Seus dias de atividade aparecem aqui." variant="card" />
        ) : (
          <SurfaceCard>
            <Lista>
              {activity.records.slice(0, 14).map((r) => (
                <ItemLista key={r.id}>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{fmtDia(r.activity_date)}</p>
                    <p className="text-sm text-muted-foreground">
                      {(r.moderate_minutes ?? 0) + (r.vigorous_minutes ?? 0)} min ativos
                      {r.distance_km ? ` · ${numero(r.distance_km, 1)} km` : ""}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-foreground tabular-nums shrink-0">
                    {(r.steps ?? 0).toLocaleString("pt-BR")}
                  </p>
                </ItemLista>
              ))}
            </Lista>
          </SurfaceCard>
        )}
        <NotaGrafico className="flex items-start gap-1.5">
          <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          Dados vindos da pulseira — passos e minutos são estimativas de sensor, dentro da margem normal para uso diário.
        </NotaGrafico>
      </section>
    </TelaPaciente>
  );
}
