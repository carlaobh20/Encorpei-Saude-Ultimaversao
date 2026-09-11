/**
 * ══════════════════════════════════════════════════════════════════════
 * GRÁFICOS DO PACIENTE — uma linguagem só
 * ══════════════════════════════════════════════════════════════════════
 *
 * Antes disto, cada tela do paciente desenhava o próprio recharts. O
 * levantamento era desconfortável: sete gráficos, sete tamanhos de tick
 * (10px, 12px, 13px), quatro tracejados de grade diferentes, três paletas
 * (DOMAIN_COLORS, tokens da marca, hex solto), nenhum eixo com unidade, e
 * animação de entrada ligada em todos.
 *
 * Três coisas que este arquivo resolve, e por que cada uma importa:
 *
 * 1. UNIDADE NO EIXO. "128" e "128 mmHg" são a mesma informação para quem
 *    desenhou a tela e coisas diferentes para quem a lê pela primeira vez aos
 *    68 anos. `EixoY` recebe `unidade` e escreve.
 *
 * 2. TICK DE 13px, NÃO DE 10px. O texto do eixo é texto: 10px reprovaria em
 *    qualquer auditoria de legibilidade, e o eixo é justamente onde o
 *    paciente confere se está lendo o dia certo. A escala `leitura-paciente`
 *    (index.css) não alcança SVG, então o piso entra aqui na mão.
 *
 * 3. `prefers-reduced-motion`. Não é preferência estética: em paciente com
 *    vertigem ou enxaqueca vestibular, linha que "cresce" na entrada provoca
 *    sintoma. `usePrefereMenosMovimento()` já existia dentro de
 *    `hoje/MinhaEvolucao`; ficou aqui para as outras telas usarem em vez de
 *    reescrever.
 *
 * ── Paleta ────────────────────────────────────────────────────────────
 * Série principal em `--brand-cardio`, secundária em `--progresso`. Esses
 * dois tokens são os mesmos da tela inicial, e a razão de não usar
 * `DOMAIN_COLORS` nos gráficos do paciente é simples: domínio é taxonomia
 * interna (pressão, sono, metabólico), e o paciente não tem taxonomia — ele
 * tem "a linha de cima" e "a linha de baixo".
 *
 * NADA aqui interpreta número. Não existe faixa verde de "bom" neste arquivo;
 * onde uma tela desenha referência clínica, ela passa a própria cor e o
 * próprio rótulo, e a legenda diz o que a linha é.
 */

import { useEffect, useState, type ReactNode } from "react";
import { CartesianGrid, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

// ── Paleta ───────────────────────────────────────────────────────────

/** A série que responde à pergunta da tela. Uma por gráfico. */
export const COR_SERIE = "hsl(var(--brand-cardio))";
/** A série de apoio (diastólica, meta, comparação). */
export const COR_SERIE_APOIO = "hsl(var(--progresso))";
/** Linha de referência — tracejada, cinza, nunca verde de "você está bom". */
export const COR_REFERENCIA = "hsl(var(--muted-foreground))";

const COR_TEXTO_EIXO = "hsl(var(--muted-foreground))";
const TAMANHO_TICK = 13;

// ── Movimento ────────────────────────────────────────────────────────

/**
 * Verdadeiro quando o sistema pede menos movimento. Quem chama passa
 * `isAnimationActive={!reduzir}` para cada série.
 */
export function usePrefereMenosMovimento(): boolean {
  const [reduzir, setReduzir] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setReduzir(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  return reduzir;
}

// ── Peças do gráfico ─────────────────────────────────────────────────

/**
 * Grade só na horizontal e discreta: ela serve para ler ALTURA. Linha
 * vertical não ajuda a ler valor nenhum e desenha uma gaiola em volta do
 * dado.
 *
 * São funções que devolvem elementos, e não componentes: o recharts inspeciona
 * o tipo dos filhos diretos de `<LineChart>` para saber o que cada um é, e um
 * wrapper próprio some do mapeamento — o eixo simplesmente não aparece.
 */
export function gradeGrafico() {
  return (
    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
  );
}

export function eixoX(dataKey: string) {
  return (
    <XAxis
      dataKey={dataKey}
      tick={{ fontSize: TAMANHO_TICK, fill: COR_TEXTO_EIXO }}
      tickLine={false}
      axisLine={false}
      minTickGap={12}
    />
  );
}

/**
 * `unidade` vira o rótulo girado à esquerda. `largura` de 52px é o que cabe
 * "1.200" sem cortar; abaixo disso o recharts trunca em silêncio.
 */
export function eixoY(opcoes: {
  unidade?: string;
  dominio?: [string | number, string | number];
  largura?: number;
}) {
  const { unidade, dominio, largura = 52 } = opcoes;
  return (
    <YAxis
      width={largura}
      tick={{ fontSize: TAMANHO_TICK, fill: COR_TEXTO_EIXO }}
      tickLine={false}
      axisLine={false}
      domain={dominio}
      label={
        unidade
          ? {
              value: unidade,
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { fontSize: TAMANHO_TICK, fill: COR_TEXTO_EIXO },
            }
          : undefined
      }
    />
  );
}

/** Caixinha do toque/hover. 14px porque ela também é texto que se lê. */
export function dicaGrafico(
  formatar?: (valor: never, nome: string, item: never) => [string, string]
) {
  return (
    <RTooltip
      contentStyle={{
        borderRadius: 12,
        border: "1px solid hsl(var(--border))",
        fontSize: 14,
      }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter={formatar as any}
    />
  );
}

// ── Moldura ──────────────────────────────────────────────────────────

/**
 * A caixa do gráfico.
 *
 * A altura fixa não é estética: `ResponsiveContainer` precisa de um pai com
 * altura resolvida, senão colapsa para zero e o gráfico some sem erro
 * nenhum no console.
 */
export function AreaGrafico({
  altura = 220,
  children,
  className,
}: {
  altura?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)} style={{ height: altura }}>
      {children}
    </div>
  );
}

/**
 * Legenda em texto, sempre. O quadradinho de cor é `aria-hidden` porque ele
 * não carrega informação: quem informa é a palavra ao lado.
 */
export function LegendaGrafico({
  itens,
  className,
}: {
  itens: { cor: string; rotulo: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("mt-3 flex flex-wrap items-center gap-x-5 gap-y-1", className)}>
      {itens.map((i) => (
        <li key={i.rotulo} className="flex items-center gap-2 text-base text-muted-foreground">
          <span
            className="h-2.5 w-6 shrink-0 rounded-full"
            style={{ background: i.cor }}
            aria-hidden
          />
          {i.rotulo}
        </li>
      ))}
    </ul>
  );
}

/**
 * O rodapé do gráfico: quantos pontos e de onde vieram.
 *
 * Uma linha de sete dias desenhada sobre duas medidas tem exatamente a mesma
 * aparência de uma desenhada sobre quatorze. Esta frase é o que separa as
 * duas — e é a única maneira honesta de mostrar poucos pontos sem escondê-los
 * nem fingir que são muitos.
 */
export function NotaGrafico({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("mt-3 text-sm text-muted-foreground leading-relaxed", className)}>
      {children}
    </p>
  );
}
