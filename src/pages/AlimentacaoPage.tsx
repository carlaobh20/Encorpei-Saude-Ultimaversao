/**
 * AlimentacaoPage — sódio, uma pergunta por refeição.
 *
 * docs/ENGAJAMENTO-CARDIO.md §5: nada de contagem de calorias ou dieta
 * prescrita. O paciente escolhe o que mais se parece com o que comeu; o app
 * estima e devolve tendência, não julgamento.
 */
import { useMemo } from "react";
import { UtensilsCrossed, Info, CheckCircle2 } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { cn } from "@/lib/utils";
import { useSodio } from "@/hooks/useEngajamento";
import {
  REFEICOES, OPCOES_REFEICAO, totalDoDia, type ChaveRefeicao,
} from "@/lib/clinical/sodio";
import { DOMAIN_COLORS } from "@/theme/colors";

const ONDE_SE_ESCONDE = [
  "Pão e massas prontas",
  "Frios e embutidos (presunto, salsicha, linguiça)",
  "Queijos amarelos",
  "Temperos prontos e caldos em tablete",
  "Molhos industrializados",
  "Congelados e enlatados",
];

function fmtDiaCurto(diaIso: string): string {
  const d = new Date(diaIso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function AlimentacaoPage() {
  const { registros, hoje, alvo, leitura, mediaSemana, isLoading, registrar } = useSodio();

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
      <div>
        <PageHeader title="Alimentação" />
        <TabPageSkeleton />
      </div>
    );
  }

  const percentualBarra = Math.min(100, leitura.percentual);

  return (
    <div className="pb-10">
      <PageHeader title="Alimentação" subtitle="Uma pergunta por refeição — sem tabela, sem contagem de calorias" />

      {/* ── Total do dia ──────────────────────────────────────────── */}
      <SurfaceCard className={cn("mb-6 border-0", leitura.tom === "atencao" ? "bg-warning-bg" : "bg-cardio-50")}>
        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: leitura.tom === "atencao" ? "hsl(var(--warning))" : "hsl(var(--primary))" }}>
          Hoje
        </p>
        <p className="text-sm text-foreground leading-relaxed mb-3">{leitura.frase}</p>
        <div className="h-2.5 rounded-full bg-white/60 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", leitura.tom === "atencao" ? "bg-warning" : "bg-primary")}
            style={{ width: `${percentualBarra}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">Referência: {alvo} mg de sódio por dia</p>
      </SurfaceCard>

      {/* ── Uma pergunta por refeição ─────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="O que você comeu hoje?" icon={UtensilsCrossed} />
        <div className="space-y-5">
          {REFEICOES.map((refeicao) => {
            const selecionada = escolhaDoDia(refeicao.chave);
            return (
              <div key={refeicao.chave}>
                <p className="text-sm font-semibold text-foreground mb-2">{refeicao.rotulo}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {OPCOES_REFEICAO.map((opcao) => {
                    const marcado = selecionada === opcao.chave;
                    return (
                      <button
                        key={opcao.chave}
                        type="button"
                        onClick={() => escolher(refeicao.chave, opcao.chave, opcao.sodioMg)}
                        className={cn(
                          "text-left rounded-2xl border p-3.5 transition-colors",
                          marcado ? "border-primary bg-cardio-50" : "border-border bg-card"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm font-semibold", marcado ? "text-primary" : "text-foreground")}>{opcao.rotulo}</p>
                          {marcado && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{opcao.exemplo}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Média da semana ───────────────────────────────────────── */}
      <SurfaceCard className="mb-6">
        <p className="text-xs font-medium text-muted-foreground mb-1">Média dos últimos 7 dias</p>
        <p className="text-3xl font-bold text-foreground">
          {mediaSemana != null ? `${mediaSemana} mg` : "—"}
        </p>
      </SurfaceCard>

      {/* ── Gráfico 10 dias ───────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Últimos 10 dias" />
        <SurfaceCard>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chart10d} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <ReferenceLine y={alvo} stroke="hsl(var(--success))" strokeDasharray="4 4" />
              <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v} mg`, "Sódio"]} />
              <Bar dataKey="mg" fill={DOMAIN_COLORS.metabolico} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 text-center">A linha tracejada é a referência diária ({alvo} mg).</p>
        </SurfaceCard>
      </div>

      {/* ── Onde o sal se esconde ─────────────────────────────────── */}
      <div>
        <SectionHeader title="Onde o sal se esconde" icon={Info} />
        <SurfaceCard>
          <ul className="space-y-2">
            {ONDE_SE_ESCONDE.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-3">
            A maior parte do sódio do dia costuma vir daí — não do saleiro à mesa.
          </p>
        </SurfaceCard>
      </div>
    </div>
  );
}
