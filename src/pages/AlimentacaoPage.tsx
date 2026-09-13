/**
 * AlimentacaoPage — sódio, uma pergunta por refeição.
 *
 * docs/ENGAJAMENTO-CARDIO.md §5: nada de contagem de calorias ou dieta
 * prescrita. O paciente escolhe o que mais se parece com o que comeu; o app
 * estima e devolve tendência, não julgamento.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * A frase de `lerSodioDoDia`, o alvo e o tom vêm do hook e estão intactos.
 * Mudou:
 *
 *  · As opções de refeição viraram `OpcaoBotao`, o mesmo controle de escolha
 *    de Pressão, Glicemia e "Como estou". Antes cada tela desenhava o seu, e
 *    esta em particular usava borda de 1px com padding de 3,5 — alvo de toque
 *    apertado para quem escolhe quatro vezes por dia.
 *
 *  · O total do dia deixou de ser um cartão inteiro colorido. Em dia de
 *    atenção, o cartão amarelo cheio ocupava a primeira dobra e empurrava a
 *    pergunta ("o que você comeu hoje?") para baixo — a cor gritava e a ação
 *    sumia. Agora o tom vive na barra e na borda, e o texto continua o mesmo.
 *
 *  · O gráfico de 10 dias ganhou unidade no eixo e legenda escrita para a
 *    linha de referência, que antes era um tracejado sem nome.
 *
 *  · A barra do dia parou de mentir por saturação (auditoria de setembro/2026):
 *    2720 mg com referência de 2000 mg aparecia como "100% de 2000 mg", ao
 *    lado da frase que dizia "acima da referência". Ver o bloco de comentário
 *    em `percentualReal`.
 */
import { useMemo } from "react";
import { UtensilsCrossed, Info } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, OpcaoBotao, GradeOpcoes, BarraProporcao,
  AreaGrafico, LegendaGrafico, usePrefereMenosMovimento,
  gradeGrafico, eixoX, eixoY, dicaGrafico, COR_SERIE, COR_REFERENCIA,
} from "@/components/shell";
import { cn } from "@/lib/utils";
import { numero, porcentagem, diaCurto } from "@/lib/formato";
import { useSodio } from "@/hooks/useEngajamento";
import {
  REFEICOES, OPCOES_REFEICAO, totalDoDia, type ChaveRefeicao,
} from "@/lib/clinical/sodio";

const ONDE_SE_ESCONDE = [
  "Pão e massas prontas",
  "Frios e embutidos (presunto, salsicha, linguiça)",
  "Queijos amarelos",
  "Temperos prontos e caldos em tablete",
  "Molhos industrializados",
  "Congelados e enlatados",
];

/** O dia vem como "2026-09-13"; o T00:00:00 evita o fuso comer um dia. */
function fmtDiaCurto(diaIso: string): string {
  return diaCurto(diaIso + "T00:00:00") ?? "";
}

export default function AlimentacaoPage() {
  const { registros, hoje, alvo, leitura, mediaSemana, isLoading, registrar } = useSodio();
  const reduzirMovimento = usePrefereMenosMovimento();

  const chart10d = useMemo(() => {
    const dias: string[] = [];
    for (let i = 9; i >= 0; i--) {
      dias.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    return dias.map((dia) => ({ dia: fmtDiaCurto(dia), mg: totalDoDia(registros, dia) }));
  }, [registros]);

  const escolhaDoDia = (refeicao: ChaveRefeicao) =>
    registros.find((r) => r.dia === hoje && r.refeicao === refeicao)?.opcao ?? null;

  const escolher = (refeicao: ChaveRefeicao, opcaoChave: string, sodioMg: number) => {
    registrar.mutate({ dia: hoje, refeicao, opcao: opcaoChave, sodio_mg: sodioMg });
  };

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Alimentação" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  /**
   * A barra satura em 100% (é o comprimento máximo que existe); o TEXTO, não.
   *
   * Antes os dois usavam o valor saturado, e a tela dizia duas coisas opostas
   * ao mesmo tempo: a frase "cerca de 2720 mg hoje, acima da referência de
   * 2000 mg" com o rótulo "100% de 2000 mg" logo abaixo. Para quem lê rápido,
   * "100%" é o alvo cumprido — o número que gritava alarme e o número que
   * mostrava tranquilidade eram o mesmo dia. Agora a barra cheia significa
   * "chegou ou passou", e o quanto passou está escrito.
   */
  const percentualReal = Math.round(leitura.percentual);
  const percentualBarra = Math.min(100, percentualReal);
  const emAtencao = leitura.tom === "atencao";
  const passouDaReferencia = percentualReal > 100;

  return (
    <TelaPaciente>
      <PageHeader title="Alimentação" subtitle="Uma pergunta por refeição — sem tabela, sem contagem de calorias" />

      {/* ── Total do dia ──────────────────────────────────────────── */}
      <SurfaceCard className={cn("border-l-4", emAtencao ? "border-l-warning" : "border-l-primary")}>
        <p className={cn("text-sm font-bold uppercase tracking-wide mb-1", emAtencao ? "text-warning" : "text-primary")}>
          Hoje
        </p>
        <p className="text-base text-foreground leading-relaxed mb-3">{leitura.frase}</p>
        <BarraProporcao
          rotulo={passouDaReferencia ? "Acima da referência do dia" : "Do valor de referência do dia"}
          valor={`${porcentagem(percentualReal)} de ${numero(alvo)} mg`}
          percentual={percentualBarra}
          cor={emAtencao ? "hsl(var(--warning))" : "hsl(var(--brand-cardio))"}
        />
        {passouDaReferencia && (
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            A barra chega ao fim em {numero(alvo)} mg; hoje o total passou disso.
          </p>
        )}
      </SurfaceCard>

      {/* ── Uma pergunta por refeição ─────────────────────────────── */}
      <section>
        <TituloSecao titulo="O que você comeu hoje?" icone={UtensilsCrossed} />
        <div className="space-y-5">
          {REFEICOES.map((refeicao) => {
            const selecionada = escolhaDoDia(refeicao.chave);
            return (
              <fieldset key={refeicao.chave}>
                <legend className="text-base font-semibold text-foreground mb-2">{refeicao.rotulo}</legend>
                <GradeOpcoes>
                  {OPCOES_REFEICAO.map((opcao) => (
                    <OpcaoBotao
                      key={opcao.chave}
                      selecionado={selecionada === opcao.chave}
                      onClick={() => escolher(refeicao.chave, opcao.chave, opcao.sodioMg)}
                      titulo={opcao.rotulo}
                      descricao={opcao.exemplo}
                    />
                  ))}
                </GradeOpcoes>
              </fieldset>
            );
          })}
        </div>
      </section>

      {/* ── Média da semana ───────────────────────────────────────── */}
      <SurfaceCard>
        <p className="text-sm font-medium text-muted-foreground mb-1">Média dos últimos 7 dias</p>
        <p className="text-3xl font-bold text-foreground tabular-nums">
          {mediaSemana != null ? `${numero(mediaSemana)} mg` : "Sem registro"}
        </p>
      </SurfaceCard>

      {/* ── Gráfico 10 dias ───────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Últimos 10 dias" />
        <SurfaceCard>
          <AreaGrafico altura={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart10d} margin={{ top: 8, right: 8, left: -4, bottom: 0 }}>
                {gradeGrafico()}
                {eixoX("dia")}
                {eixoY({ unidade: "mg", largura: 56 })}
                <ReferenceLine y={alvo} stroke={COR_REFERENCIA} strokeDasharray="4 4" />
                {dicaGrafico((v: never) => [`${numero(Number(v))} mg`, "Sódio"])}
                <Bar
                  dataKey="mg" name="Sódio" fill={COR_SERIE} radius={[6, 6, 0, 0]}
                  isAnimationActive={!reduzirMovimento}
                />
              </BarChart>
            </ResponsiveContainer>
          </AreaGrafico>
          <LegendaGrafico
            itens={[
              { cor: COR_SERIE, rotulo: "Sódio estimado no dia" },
              { cor: COR_REFERENCIA, rotulo: `Referência diária (${numero(alvo)} mg)` },
            ]}
          />
        </SurfaceCard>
      </section>

      {/* ── Onde o sal se esconde ─────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Onde o sal se esconde" icone={Info} />
        <SurfaceCard>
          <ul className="space-y-2.5">
            {ONDE_SE_ESCONDE.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-base text-foreground leading-relaxed">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            A maior parte do sódio do dia costuma vir daí — não do saleiro à mesa.
          </p>
        </SurfaceCard>
      </section>
    </TelaPaciente>
  );
}
