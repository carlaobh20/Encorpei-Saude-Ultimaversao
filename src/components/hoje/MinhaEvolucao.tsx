/**
 * "Minha evolução" — a pressão dos últimos 7 dias, em duas linhas.
 *
 * ── O que o gráfico tem direito de mostrar ────────────────────────────
 * Só medida de manguito validada. Estimativa de pulseira fica de fora da
 * MESMA linha porque as duas não medem a mesma coisa: desenhá-las juntas
 * produziria uma curva que ninguém pode usar e que parece clínica
 * (CONTRATO-DE-CODIGO.md, regra 2 · MAPEAMENTO-CARDIO §4).
 *
 * ── E por que o rodapé conta as medidas ───────────────────────────────
 * Uma linha de sete dias desenhada sobre duas medidas tem exatamente a mesma
 * aparência de uma desenhada sobre quatorze. O "n" e a origem no rodapé são
 * o que separa as duas — e é a única maneira honesta de mostrar poucos
 * pontos sem escondê-los nem fingir que são muitos.
 *
 * O gráfico não interpreta: não há faixa verde, não há rótulo "normal". Quem
 * lê o conjunto é o médico; a tela do paciente mostra o que foi medido.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip,
} from "recharts";
import { EmptyState } from "@/components/shell";
import { Skeleton } from "@/components/ui/skeleton";
import { useBloodPressure } from "@/hooks/useCardioReadings";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import { diaCurto } from "./formato";

const DIAS = 7;

/**
 * `prefers-reduced-motion` não é preferência estética: em paciente com
 * vertigem ou enxaqueca vestibular, linha que "cresce" na entrada provoca
 * sintoma. Quando o sistema pede menos movimento, o recharts desenha o
 * traçado já pronto.
 */
function usePrefereMenosMovimento(): boolean {
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

function Legenda() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3">
      <li className="flex items-center gap-2 text-base text-muted-foreground">
        <span
          className="h-2.5 w-6 rounded-full shrink-0"
          style={{ background: "hsl(var(--brand-cardio))" }}
          aria-hidden
        />
        Sistólica (o número maior)
      </li>
      <li className="flex items-center gap-2 text-base text-muted-foreground">
        <span
          className="h-2.5 w-6 rounded-full shrink-0"
          style={{ background: "hsl(var(--progresso))" }}
          aria-hidden
        />
        Diastólica (o número menor)
      </li>
    </ul>
  );
}

export function MinhaEvolucao() {
  const bp = useBloodPressure();
  const reduzirMovimento = usePrefereMenosMovimento();

  const { dados, origens } = useMemo(() => {
    const corte = Date.now() - DIAS * 86_400_000;
    const elegiveis = bp.readings.filter(
      (r) =>
        r.cuff_validated &&
        r.validation_status === "validated" &&
        +new Date(r.recorded_at) >= corte
    );

    const ordenadas = [...elegiveis].sort(
      (a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at)
    );

    return {
      dados: ordenadas.map((r) => ({
        quando: diaCurto(r.recorded_at),
        sistolica: r.systolic,
        diastolica: r.diastolic,
      })),
      // Origem no plural: o mesmo período pode ter medida digitada em casa e
      // medida trazida do consultório, e o paciente tem direito de saber.
      origens: Array.from(
        new Set(
          ordenadas.map(
            (r) => rotuloProveniencia(r.source_type, r.validation_status, r.source_device_name).label
          )
        )
      ),
    };
  }, [bp.readings]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm">
      {/* `flex-wrap` + `basis-48`: em 360–390px o link da direita ("Ver evolução
          completa") comia a linha inteira e sobrava uma coluna de 130px, onde o
          título quebrava em duas linhas e o subtítulo em três. Agora o link
          desce para a linha de baixo; em tela larga a linha continua única. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-48">
          <h2 className="font-display text-xl font-semibold leading-tight">Minha evolução</h2>
          <p className="text-base text-muted-foreground mt-0.5">
            Pressão nos últimos {DIAS} dias
          </p>
        </div>
        <Link
          to="/meu-coracao"
          className="text-base font-medium text-primary shrink-0 rounded-lg px-1"
        >
          Ver evolução completa
        </Link>
      </div>

      {bp.isLoading ? (
        <div className="mt-4 space-y-3" aria-busy="true">
          <Skeleton className="h-[220px] w-full rounded-xl" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : dados.length === 0 ? (
        <div className="mt-2">
          <EmptyState
            icon={Activity}
            title="Ainda não há medidas para desenhar"
            description={`O gráfico usa as medidas com aparelho de braço dos últimos ${DIAS} dias.`}
            variant="card"
          />
        </div>
      ) : (
        <>
          {/* Altura fixa: o ResponsiveContainer precisa de um pai com altura
              resolvida, senão colapsa para zero e o gráfico some sem erro. */}
          <div className="mt-4 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                {/* Grade só na horizontal e discreta: ela serve para ler
                    altura, não para desenhar uma gaiola em volta do dado. */}
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="quando"
                  tick={{ fontSize: 13, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={12}
                />
                <YAxis
                  width={52}
                  tick={{ fontSize: 13, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 10", "dataMax + 10"]}
                  label={{
                    value: "mmHg",
                    angle: -90,
                    position: "insideLeft",
                    offset: 16,
                    style: { fontSize: 13, fill: "hsl(var(--muted-foreground))" },
                  }}
                />
                <RTooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    fontSize: 14,
                  }}
                  formatter={(v: number, nome: string) => [`${v} mmHg`, nome]}
                />
                <Line
                  type="monotone"
                  dataKey="sistolica"
                  name="Sistólica"
                  stroke="hsl(var(--brand-cardio))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={!reduzirMovimento}
                />
                <Line
                  type="monotone"
                  dataKey="diastolica"
                  name="Diastólica"
                  stroke="hsl(var(--progresso))"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={!reduzirMovimento}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <Legenda />

          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {dados.length} medida{dados.length > 1 ? "s" : ""} no gráfico
            {origens.length > 0 ? ` · ${origens.join(" · ")}` : ""}
          </p>
        </>
      )}
    </section>
  );
}
