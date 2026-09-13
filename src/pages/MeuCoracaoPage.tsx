/**
 * MeuCoracaoPage — "estou melhorando?"
 *
 * Responde com os três números da espinha (docs/ENGAJAMENTO-CARDIO.md §2):
 * Medidas de pressão dentro da meta, Capacidade e Idade do Coração. Nenhuma
 * seção prescreve conduta — descreve o que pesa e, quando fizer sentido,
 * projeta um cenário.
 *
 * ── O que a auditoria de setembro/2026 mudou aqui ─────────────────────
 *
 * 1) A IDADE DO CORAÇÃO DESCEU. Ela abria a tela (e também abria a Hoje),
 *    com um número gigante e nenhuma ação atrás dele. Para um paciente de
 *    68 anos, "seu coração tem 80" lido todos os dias não produz mudança de
 *    comportamento: produz medo. Agora ela é um cartão DENTRO da evolução,
 *    com a explicação ao lado do número — não embaixo, não em letra miúda,
 *    ao lado — e depois dela vem o que efetivamente muda o número.
 *    O topo da tela passou a ser a métrica com ação possível: as medidas de
 *    pressão dentro da meta, que dependem do que ele faz esta semana.
 *
 * 2) "TEMPO NO ALVO" VIROU "MEDIDAS DE PRESSÃO DENTRO DA META". A conta
 *    sempre foi sobre amostras, não sobre tempo (ver src/lib/clinical/
 *    timeInRange.ts). Toda exibição agora traz percentual, n=, período e um
 *    estado explícito de "medidas insuficientes".
 *
 * 3) Nada nesta tela promete rejuvenescer coração. Projeção é cenário de
 *    cálculo, escrito como cenário de cálculo.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhum número, nenhum limiar, nenhuma frase — inclusive a ordem das três
 * seções, que é decisão de auditoria e não de layout. Mudou:
 *
 *  · Os dois gráficos passaram às peças comuns (`shell/Grafico`): eixo com
 *    unidade, tick de 13px, e legenda escrita. O gráfico da idade do coração
 *    tinha duas linhas — uma cheia e uma tracejada — sem nada dizendo qual
 *    era a idade real e qual era a do coração. As cores saíram de
 *    `DOMAIN_COLORS` (taxonomia interna: "pressão", "coração") para a paleta
 *    da marca, que é a mesma da tela inicial.
 *
 *  · A animação de entrada das linhas foi desligada sob
 *    `prefers-reduced-motion`.
 *
 *  · Os títulos de seção subiram para a escala de título (antes valiam 17px,
 *    o mesmo do corpo — ou seja, não eram títulos).
 *
 * ── O que a auditoria de DESKTOP (setembro/2026) mudou ────────────────
 * A ordem das três seções continua sendo decisão de auditoria clínica e não
 * mudou; o que mudou foi a coluna em que cada uma cai e o que acontece
 * depois de lê-las:
 *
 *  · Duas colunas a partir de `xl`. À esquerda o número que responde "estou
 *    melhorando?" e a evolução que o explica; à direita capacidade,
 *    conquistas e pontes. A tela tinha 2637px de altura e ~420px de branco
 *    à direita em 1440px.
 *
 *  · Os cartões de "O que muda o meu número" viraram LINKS para a tela que
 *    move cada fator. Antes a seção dizia "isto muda o seu número",
 *    terminava, e não havia onde clicar — a página acabava no nada.
 */
import { Link, useNavigate } from "react-router-dom";
import {
  HeartPulse, Gauge, Activity, Info, ChevronRight, Footprints,
  Timer, HeartCrack, FlaskConical, FileText,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar } from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, AreaGrafico, LegendaGrafico, NotaGrafico,
  usePrefereMenosMovimento, gradeGrafico, eixoX, eixoY, dicaGrafico,
  COR_SERIE, COR_REFERENCIA, LayoutPainel,
} from "@/components/shell";
import { Ponte } from "@/components/shell";
import { Button } from "@/components/ui/button";
import {
  useIdadeDoCoracao, useTempoNoAlvo, useCapacidade, useConquistas,
} from "@/hooks/useEngajamento";
import {
  MINIMO_DE_MEDIDAS, ROTULO_MEDIDAS_NA_META, rotuloPeriodo,
} from "@/lib/clinical/timeInRange";

const ROTA_DO_QUE_FALTA: Record<string, { label: string; rota: string }> = {
  "colesterol total": { label: "Registrar exame de colesterol", rota: "/exames" },
  "HDL": { label: "Registrar exame de colesterol", rota: "/exames" },
  "uma medida de pressão com aparelho de braço": { label: "Medir pressão", rota: "/pressao" },
  "data de nascimento": { label: "Completar cadastro", rota: "/conta" },
};

/**
 * Cada fator de risco leva à tela que o MOVE.
 *
 * Sem isto, "O que muda o meu número" era uma lista de três cartões inertes e
 * a página terminava no nada: o paciente lia "Colesterol no alvo" e não tinha
 * onde clicar. O mapa não decide nada clínico — só diz onde se mexe em cada
 * fator. Fator sem destino conhecido continua sendo cartão, nunca link cego.
 */
const ROTA_DO_FATOR: Record<string, { label: string; rota: string }> = {
  pressao:    { label: "Registrar minha pressão",     rota: "/pressao" },
  colesterol: { label: "Ver meus exames",             rota: "/exames" },
  hdl:        { label: "Ver meus exames",             rota: "/exames" },
  diabetes:   { label: "Registrar minha glicemia",    rota: "/glicemia" },
  tabagismo:  { label: "Aprender sobre parar de fumar", rota: "/aprender" },
};

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function MeuCoracaoPage() {
  const navigate = useNavigate();
  const idadeCoracao = useIdadeDoCoracao();
  const tempoNoAlvo = useTempoNoAlvo();
  const capacidade = useCapacidade();
  const conquistas = useConquistas();
  const reduzirMovimento = usePrefereMenosMovimento();

  const isLoading = idadeCoracao.isLoading || tempoNoAlvo.isLoading || capacidade.isLoading;

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Minha evolução" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  const historico = [...idadeCoracao.historico]
    .sort((a, b) => +new Date(a.calculado_em) - +new Date(b.calculado_em))
    .map((h) => ({ dia: fmtDia(h.calculado_em), idadeDoCoracao: h.idade_coracao, idadeReal: h.idade_real }));

  // A série semanal guarda `percentual: null` para semana sem medida —
  // e null é mantido de propósito: barra ausente é honesta, barra em zero
  // diria "nenhuma medida ficou na meta", que é outra coisa.
  const serieMedidas = tempoNoAlvo.serie.map((s) => ({
    semana: fmtDia(s.semana),
    percentual: s.percentual,
    total: s.total,
  }));
  const temSerie = serieMedidas.some((s) => s.total > 0);

  const meta = tempoNoAlvo.mes;

  /* ── Medidas de pressão dentro da meta ─────────────────────────
     Primeiro lugar porque é o único dos três números que responde ao
     que o paciente faz esta semana. */
  const blocoMeta = (
    <section>
      <TituloSecao titulo={ROTULO_MEDIDAS_NA_META} icone={Gauge} />
      <SurfaceCard className="mb-3">
        {meta.suficiente && meta.percentual != null ? (
          <div className="text-center py-2">
            <p className="text-5xl font-display font-bold text-foreground leading-none tabular-nums">
              {meta.percentual}%
            </p>
            {/* Percentual, número de medidas e período sempre juntos.
                Um percentual sozinho esconde se ele veio de 3 ou de 60
                medidas — e a diferença entre os dois é tudo. */}
            <p className="text-base text-muted-foreground mt-2">
              {meta.dentro} de {meta.total} medidas · {rotuloPeriodo(meta.dias)}
            </p>
            <p className="text-base text-muted-foreground mt-3 leading-relaxed">{meta.frase}</p>
          </div>
        ) : (
          <div className="py-2">
            {/* Estado explícito de amostra pequena (limiar e motivo em
                timeInRange.ts). Nada de percentual grande em cima de
                duas medidas. */}
            <p className="text-xl font-display font-semibold text-foreground">Medidas insuficientes</p>
            <p className="text-base text-muted-foreground mt-2 leading-relaxed">
              Você tem {meta.total} medida{meta.total === 1 ? "" : "s"} com aparelho de braço {rotuloPeriodo(meta.dias)}.
              A partir de {MINIMO_DE_MEDIDAS} medidas o app mostra o seu percentual.
            </p>
            <Button size="xl" className="w-full mt-4" onClick={() => navigate("/pressao")}>
              Medir a pressão
            </Button>
          </div>
        )}
      </SurfaceCard>

      {temSerie && (
        <SurfaceCard>
          <p className="text-base font-medium text-foreground mb-3">Semana a semana</p>
          <AreaGrafico altura={200}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieMedidas} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                {gradeGrafico()}
                {eixoX("semana")}
                {eixoY({ unidade: "%", dominio: [0, 100] })}
                {dicaGrafico((v: never, _n: string, item: never) => [
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  `${v}% (n=${(item as any)?.payload?.total ?? 0})`, "Dentro da meta",
                ])}
                <Bar
                  dataKey="percentual" name="Dentro da meta" fill={COR_SERIE} radius={[6, 6, 0, 0]}
                  isAnimationActive={!reduzirMovimento}
                />
              </BarChart>
            </ResponsiveContainer>
          </AreaGrafico>
          <LegendaGrafico
            itens={[{ cor: COR_SERIE, rotulo: "Medidas dentro da meta na semana" }]}
          />
          <NotaGrafico>
            Semana sem medida não aparece como zero — aparece vazia.
          </NotaGrafico>
        </SurfaceCard>
      )}
    </section>
  );

  /* ── Capacidade ────────────────────────────────────────────── */
  const blocoCapacidade = (
    <section>
      <TituloSecao titulo="Capacidade" icone={Activity} />
      <div className="space-y-3 mb-3">
        <SurfaceCard>
          <div className="flex items-center gap-3 mb-1">
            <Footprints className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">Caminhada de 6 minutos</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {capacidade.evolucao.caminhada.atual != null ? `${capacidade.evolucao.caminhada.atual} m` : "—"}
          </p>
          <p className="text-base text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.caminhada.frase}</p>
        </SurfaceCard>
        <SurfaceCard>
          <div className="flex items-center gap-3 mb-1">
            <Timer className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">Sentar e levantar</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {capacidade.evolucao.sentarLevantar.atual != null ? `${capacidade.evolucao.sentarLevantar.atual} rep.` : "—"}
          </p>
          <p className="text-base text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.sentarLevantar.frase}</p>
        </SurfaceCard>
        <SurfaceCard>
          <div className="flex items-center gap-3 mb-1">
            <HeartCrack className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">Recuperação dos batimentos</p>
          </div>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {capacidade.evolucao.recuperacao.atual != null ? `${capacidade.evolucao.recuperacao.atual} bpm` : "—"}
          </p>
          <p className="text-base text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.recuperacao.frase}</p>
        </SurfaceCard>
      </div>
      <Button variant="outline" size="xl" className="w-full" onClick={() => navigate("/caminhada")}>
        Fazer ou refazer os testes
      </Button>
    </section>
  );

  /* ══ EVOLUÇÃO ══════════════════════════════════════════════════
     A curva primeiro (o que mudou ao longo do tempo), e a Idade do
     Coração como um cartão DENTRO desta seção — não como manchete do
     app. É aqui que o número tem contexto: ao lado da explicação do
     que ele é, e logo acima do que efetivamente o move. */
  const blocoEvolucao = (
    <section>
      <TituloSecao titulo="Evolução" icone={HeartPulse} />

      {idadeCoracao.aplicavel && historico.length >= 2 && (
        <SurfaceCard className="mb-3">
          <p className="text-base font-medium text-foreground mb-3">Idade do coração ao longo do tempo</p>
          <AreaGrafico altura={200}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historico} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                {gradeGrafico()}
                {eixoX("dia")}
                {eixoY({ unidade: "anos" })}
                {dicaGrafico((v: never, nome: string) => [`${v} anos`, nome])}
                <Line
                  type="monotone" dataKey="idadeDoCoracao" name="Idade do coração"
                  stroke={COR_SERIE} strokeWidth={2.5} dot={false}
                  isAnimationActive={!reduzirMovimento}
                />
                <Line
                  type="monotone" dataKey="idadeReal" name="Idade real"
                  stroke={COR_REFERENCIA} strokeWidth={1.5} strokeDasharray="4 4" dot={false}
                  isAnimationActive={!reduzirMovimento}
                />
              </LineChart>
            </ResponsiveContainer>
          </AreaGrafico>
          {/* Duas linhas sem legenda eram duas linhas anônimas: quem lê não
              tinha como saber qual delas é a própria idade. */}
          <LegendaGrafico
            itens={[
              { cor: COR_SERIE, rotulo: "Idade do coração (estimativa)" },
              { cor: COR_REFERENCIA, rotulo: "Sua idade real" },
            ]}
          />
        </SurfaceCard>
      )}

      {/* Cartão da Idade do Coração: número À ESQUERDA, explicação À
          DIREITA, no mesmo bloco visual. Em 360px as duas colunas viram
          uma só (flex-wrap), com a explicação logo abaixo do número —
          nunca separada dele por outro cartão. */}
      {idadeCoracao.aplicavel && idadeCoracao.resultado && (
        <SurfaceCard className="mb-3 bg-primary/5 border border-primary/15">
          <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
            <div className="shrink-0">
              <p className="text-sm font-bold uppercase tracking-wide text-primary mb-1">Idade do coração</p>
              <p className="text-5xl font-display font-bold text-foreground leading-none tabular-nums">
                {idadeCoracao.resultado.idadeDoCoracao}{idadeCoracao.resultado.noTeto ? "+" : ""}
                <span className="text-lg font-medium text-muted-foreground"> anos</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Sua idade: {idadeCoracao.resultado.idadeReal} anos
              </p>
            </div>
            <div className="min-w-[200px] flex-1">
              <p className="text-base text-foreground leading-relaxed">
                {idadeCoracao.resultado.diferenca > 0 && (
                  <>
                    É uma estimativa de risco traduzida em anos: pessoas com os seus fatores de risco
                    costumam ter o risco de quem tem {idadeCoracao.resultado.noTeto ? "mais de " : ""}
                    {idadeCoracao.resultado.idadeDoCoracao} anos.
                  </>
                )}
                {idadeCoracao.resultado.diferenca === 0 && (
                  <>É uma estimativa de risco traduzida em anos — e a sua está igual à sua idade real.</>
                )}
                {idadeCoracao.resultado.diferenca < 0 && (
                  <>
                    É uma estimativa de risco traduzida em anos — a sua está {Math.abs(idadeCoracao.resultado.diferenca)} anos
                    abaixo da sua idade real.
                  </>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                É um cálculo populacional a partir dos seus fatores de risco, não uma medida direta do
                seu coração. Ele se move quando os fatores abaixo se movem.
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {!idadeCoracao.aplicavel && idadeCoracao.motivo && (
        <SurfaceCard className="mb-3 bg-secondary border-0">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-base font-semibold text-foreground">A Idade do Coração não se aplica ao seu caso</p>
              <p className="text-base text-muted-foreground mt-1 leading-relaxed">{idadeCoracao.motivo}</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {idadeCoracao.aplicavel && !idadeCoracao.resultado && idadeCoracao.faltando.length > 0 && (
        <SurfaceCard className="mb-3 bg-secondary border-0">
          <p className="text-base font-semibold text-foreground mb-1">Ainda falta um dado para calcular</p>
          <p className="text-base text-muted-foreground mb-3 leading-relaxed">
            Para mostrar a idade do seu coração, precisamos de: {idadeCoracao.faltando.join(", ")}.
          </p>
          <div className="flex flex-col gap-2">
            {idadeCoracao.faltando.map((f) => {
              const info = ROTA_DO_QUE_FALTA[f];
              if (!info) return null;
              return (
                <Button key={f} variant="outline" size="lg" className="justify-between" onClick={() => navigate(info.rota)}>
                  {info.label} <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* O que muda o número — a parte acionável, logo depois do número.
          E, desde a auditoria de desktop, acionável de verdade: cada cartão
          é um <Link> para a tela que MOVE aquele fator. Antes a seção dizia
          "isto muda o seu número" e terminava no nada — o paciente lia
          "Colesterol no alvo", não tinha onde clicar, e a página acabava. */}
      {idadeCoracao.resultado && idadeCoracao.resultado.fatores.length > 0 && (
        <div className="space-y-3">
          <p className="text-base font-semibold text-foreground">O que muda o meu número</p>
          {idadeCoracao.resultado.fatores.map((f) => {
            const destino = ROTA_DO_FATOR[f.chave];
            const conteudo = (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">{f.rotulo}</p>
                  <p className="text-base text-muted-foreground mt-1 leading-relaxed">{f.descricao}</p>
                  {destino ? (
                    <p className="mt-2 inline-flex items-center gap-1 text-base font-medium text-primary">
                      {destino.label} <ChevronRight className="h-4 w-4" aria-hidden />
                    </p>
                  ) : null}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xl font-bold text-primary tabular-nums">-{f.anosQuePodeGanhar}</p>
                  <p className="text-sm text-muted-foreground">anos no cálculo</p>
                </div>
              </div>
            );

            // Sem destino conhecido o cartão continua sendo um cartão. Link
            // que não sabe para onde vai é pior que cartão que não é link.
            if (!destino) return <SurfaceCard key={f.chave}>{conteudo}</SurfaceCard>;
            return (
              <Link
                key={f.chave}
                to={destino.rota}
                className="block rounded-2xl transition-shadow hover:shadow-md focus-visible:shadow-md"
              >
                <SurfaceCard>{conteudo}</SurfaceCard>
              </Link>
            );
          })}
        </div>
      )}

      {/* Projeção: cenário de cálculo, escrito como cenário de cálculo.
          O app não promete que o coração rejuvenesce — diz o que o MESMO
          cálculo estimaria se aqueles fatores mudassem. */}
      {idadeCoracao.resultado && idadeCoracao.projecao != null && idadeCoracao.projecao < idadeCoracao.resultado.idadeDoCoracao && (
        <SurfaceCard className="mt-3 bg-success-bg border-0">
          <p className="text-sm font-bold uppercase tracking-wide text-success mb-1">Cenário</p>
          <p className="text-base text-foreground leading-relaxed">
            Com a pressão dentro da meta{idadeCoracao.resultado.fatores.some((f) => f.chave === "tabagismo") ? " e sem fumar" : ""},
            este mesmo cálculo passaria a estimar <span className="font-bold">{idadeCoracao.projecao} anos</span>.
          </p>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            É uma simulação do cálculo, não uma promessa de resultado — quem acompanha o seu caso é o seu médico.
          </p>
        </SurfaceCard>
      )}
    </section>
  );

  /* ── Conquistas ────────────────────────────────────────────── */
  const blocoConquistas = conquistas.length > 0 ? (
    <section>
      <TituloSecao titulo="Conquistas" />
      <SurfaceCard>
        <ul className="space-y-3">
          {conquistas.map((c) => (
            <li key={c.id} className="text-base text-foreground leading-relaxed pl-3 border-l-2 border-border">
              {c.texto}
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </section>
  ) : null;

  /** Pontes: a tela de "estou melhorando?" terminava sem dizer por onde. */
  const pontes = (
    <section>
      <TituloSecao titulo="Onde mexo nesses números" />
      <div className="space-y-2">
        <Ponte para="/pressao" icone={Gauge} titulo="Registrar pressão" detalhe="É a medida que move o percentual acima" />
        <Ponte para="/exames" icone={FlaskConical} titulo="Meus exames" detalhe="Colesterol, HDL e o resto do laboratório" />
        <Ponte para="/meu-mes" icone={FileText} titulo="Levar para a consulta" detalhe="O resumo do mês que você mostra ao médico" />
      </div>
    </section>
  );

  return (
    <TelaPaciente largura="painel">
      <PageHeader title="Minha evolução" subtitle="A prova de que o esforço está funcionando" />
      {/* À esquerda o número que responde "estou melhorando?" e a evolução
          que o explica; à direita o que se consulta ao lado dele. Em 1440px
          esta tela tinha 2637px de altura e ~420px de branco na direita. */}
      <LayoutPainel
        principal={<>{blocoMeta}{blocoEvolucao}</>}
        apoio={<>{blocoCapacidade}{blocoConquistas}{pontes}</>}
      />
    </TelaPaciente>
  );
}
