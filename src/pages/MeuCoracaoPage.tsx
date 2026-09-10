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
 */
import { useNavigate } from "react-router-dom";
import {
  HeartPulse, Gauge, Activity, Info, ChevronRight, Footprints,
  Timer, HeartCrack,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import {
  useIdadeDoCoracao, useTempoNoAlvo, useCapacidade, useConquistas,
} from "@/hooks/useEngajamento";
import {
  MINIMO_DE_MEDIDAS, ROTULO_MEDIDAS_NA_META, rotuloPeriodo,
} from "@/lib/clinical/timeInRange";
import { DOMAIN_COLORS } from "@/theme/colors";

const ROTA_DO_QUE_FALTA: Record<string, { label: string; rota: string }> = {
  "colesterol total": { label: "Registrar exame de colesterol", rota: "/exames" },
  "HDL": { label: "Registrar exame de colesterol", rota: "/exames" },
  "uma medida de pressão com aparelho de braço": { label: "Medir pressão", rota: "/pressao" },
  "data de nascimento": { label: "Completar cadastro", rota: "/conta" },
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

  const isLoading = idadeCoracao.isLoading || tempoNoAlvo.isLoading || capacidade.isLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Minha evolução" />
        <TabPageSkeleton />
      </div>
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

  return (
    <div>
      <PageHeader title="Minha evolução" subtitle="A prova de que o esforço está funcionando" />

      {/* ── Medidas de pressão dentro da meta ─────────────────────────
          Primeiro lugar porque é o único dos três números que responde ao
          que o paciente faz esta semana. */}
      <div className="mb-6">
        <SectionHeader title={ROTULO_MEDIDAS_NA_META} icon={Gauge} />
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
                {meta.dentro} de {meta.total} medidas (n={meta.total}) · {rotuloPeriodo(meta.dias)}
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
                Você tem {meta.total} medida{meta.total === 1 ? "" : "s"} (n={meta.total}) com aparelho de braço {rotuloPeriodo(meta.dias)}.
                A partir de {MINIMO_DE_MEDIDAS} medidas o app mostra o seu percentual.
              </p>
              <Button className="w-full mt-4 h-12 text-base" onClick={() => navigate("/pressao")}>
                Medir a pressão
              </Button>
            </div>
          )}
        </SurfaceCard>

        {temSerie && (
          <SurfaceCard>
            <p className="text-base font-medium text-foreground mb-3">Semana a semana</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={serieMedidas} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="semana" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RTooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 14 }}
                  formatter={(v: number, _n, item) => [`${v}% (n=${item?.payload?.total ?? 0})`, "Dentro da meta"]}
                />
                <Bar dataKey="percentual" fill={DOMAIN_COLORS.pressao} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-2">
              Semana sem medida não aparece como zero — aparece vazia.
            </p>
          </SurfaceCard>
        )}
      </div>

      {/* ── Capacidade ────────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Capacidade" icon={Activity} />
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
        <Button variant="outline" className="w-full h-12 text-base" onClick={() => navigate("/caminhada")}>
          Fazer ou refazer os testes
        </Button>
      </div>

      {/* ══ EVOLUÇÃO ══════════════════════════════════════════════════
          A curva primeiro (o que mudou ao longo do tempo), e a Idade do
          Coração como um cartão DENTRO desta seção — não como manchete do
          app. É aqui que o número tem contexto: ao lado da explicação do
          que ele é, e logo acima do que efetivamente o move. */}
      <div className="mb-6">
        <SectionHeader title="Evolução" icon={HeartPulse} />

        {idadeCoracao.aplicavel && historico.length >= 2 && (
          <SurfaceCard className="mb-3">
            <p className="text-base font-medium text-foreground mb-3">Idade do coração ao longo do tempo</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historico} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 14 }} />
                <Line type="monotone" dataKey="idadeDoCoracao" name="Idade do coração" stroke={DOMAIN_COLORS.coracao} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="idadeReal" name="Idade real" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
                  <Button key={f} variant="outline" className="justify-between h-12 text-base" onClick={() => navigate(info.rota)}>
                    {info.label} <ChevronRight className="h-5 w-5" aria-hidden="true" />
                  </Button>
                );
              })}
            </div>
          </SurfaceCard>
        )}

        {/* O que muda o número — a parte acionável, logo depois do número. */}
        {idadeCoracao.resultado && idadeCoracao.resultado.fatores.length > 0 && (
          <div className="space-y-3">
            <p className="text-base font-semibold text-foreground">O que muda o meu número</p>
            {idadeCoracao.resultado.fatores.map((f) => (
              <SurfaceCard key={f.chave}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{f.rotulo}</p>
                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">{f.descricao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-primary tabular-nums">-{f.anosQuePodeGanhar}</p>
                    <p className="text-sm text-muted-foreground">anos no cálculo</p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
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
      </div>

      {/* ── Conquistas ────────────────────────────────────────────── */}
      {conquistas.length > 0 && (
        <div>
          <SectionHeader title="Conquistas" />
          <SurfaceCard>
            <ul className="space-y-3">
              {conquistas.map((c) => (
                <li key={c.id} className="text-base text-foreground leading-relaxed pl-3 border-l-2 border-border">
                  {c.texto}
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
}
