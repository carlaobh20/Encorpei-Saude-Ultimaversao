/**
 * MeuCoracaoPage — a tela mais importante do app do paciente.
 *
 * Responde a "estou melhorando?" com os três números da espinha
 * (docs/ENGAJAMENTO-CARDIO.md §2): Idade do Coração, Tempo no Alvo e
 * Capacidade. Nenhuma seção prescreve conduta — descreve o que pesa e,
 * quando fizer sentido, projeta um cenário.
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
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import {
  useIdadeDoCoracao, useTempoNoAlvo, useCapacidade, useConquistas,
} from "@/hooks/useEngajamento";
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
        <PageHeader title="Meu coração" />
        <TabPageSkeleton />
      </div>
    );
  }

  const historico = [...idadeCoracao.historico]
    .sort((a, b) => +new Date(a.calculado_em) - +new Date(b.calculado_em))
    .map((h) => ({ dia: fmtDia(h.calculado_em), idadeDoCoracao: h.idade_coracao, idadeReal: h.idade_real }));

  const chartTempoNoAlvo = tempoNoAlvo.serie.map((s) => ({
    semana: fmtDia(s.semana),
    percentual: s.percentual ?? 0,
  }));

  return (
    <div className="pb-10">
      <PageHeader title="Meu coração" subtitle="A prova de que o esforço está funcionando" />

      {/* ── Idade do Coração ─────────────────────────────────────── */}
      {idadeCoracao.aplicavel && idadeCoracao.resultado && (
        <SurfaceCard className="mb-5 bg-primary/5 border border-primary/15">
          <div className="text-center py-2">
            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Idade do coração</p>
            <p className="text-6xl font-display font-bold text-foreground leading-none">
              {idadeCoracao.resultado.idadeDoCoracao}{idadeCoracao.resultado.noTeto ? "+" : ""}
              <span className="text-xl font-medium text-muted-foreground"> anos</span>
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {idadeCoracao.resultado.diferenca > 0 && (
                <>
                  Seu coração tem {idadeCoracao.resultado.noTeto ? "mais de " : ""}
                  {idadeCoracao.resultado.idadeDoCoracao} anos. Você tem {idadeCoracao.resultado.idadeReal}.
                </>
              )}
              {idadeCoracao.resultado.diferenca === 0 && (
                <>Seu coração tem exatamente a sua idade — {idadeCoracao.resultado.idadeReal} anos.</>
              )}
              {idadeCoracao.resultado.diferenca < 0 && (
                <>Seu coração tem {idadeCoracao.resultado.idadeDoCoracao} anos — {Math.abs(idadeCoracao.resultado.diferenca)} a menos que a sua idade real, {idadeCoracao.resultado.idadeReal}.</>
              )}
            </p>
          </div>
          <div className="flex items-start gap-2 mt-4 pt-4 border-t border-primary/10">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              É uma estimativa populacional, calculada a partir dos seus fatores de risco — não uma medida direta do seu coração.
            </p>
          </div>
        </SurfaceCard>
      )}

      {!idadeCoracao.aplicavel && idadeCoracao.motivo && (
        <SurfaceCard className="mb-5 bg-secondary border-0">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">A Idade do Coração não se aplica ao seu caso</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{idadeCoracao.motivo}</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {idadeCoracao.aplicavel && !idadeCoracao.resultado && idadeCoracao.faltando.length > 0 && (
        <SurfaceCard className="mb-5 bg-secondary border-0">
          <p className="text-sm font-semibold text-foreground mb-1">Ainda falta um dado para calcular</p>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
            Para mostrar a idade do seu coração, precisamos de: {idadeCoracao.faltando.join(", ")}.
          </p>
          <div className="flex flex-col gap-2">
            {idadeCoracao.faltando.map((f) => {
              const info = ROTA_DO_QUE_FALTA[f];
              if (!info) return null;
              return (
                <Button key={f} variant="outline" className="justify-between" onClick={() => navigate(info.rota)}>
                  {info.label} <ChevronRight className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
        </SurfaceCard>
      )}

      {/* ── O que muda o meu número ──────────────────────────────── */}
      {idadeCoracao.resultado && idadeCoracao.resultado.fatores.length > 0 && (
        <div className="mb-5">
          <SectionHeader title="O que muda o meu número" />
          <div className="space-y-3">
            {idadeCoracao.resultado.fatores.map((f) => (
              <SurfaceCard key={f.chave}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{f.rotulo}</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{f.descricao}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-primary">-{f.anosQuePodeGanhar}</p>
                    <p className="text-[10px] text-muted-foreground">anos</p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </div>
      )}

      {/* ── Projeção ──────────────────────────────────────────────── */}
      {idadeCoracao.resultado && idadeCoracao.projecao != null && idadeCoracao.projecao < idadeCoracao.resultado.idadeDoCoracao && (
        <SurfaceCard className="mb-5 bg-success-bg border-0">
          <p className="text-xs font-bold uppercase tracking-wide text-success mb-1">Projeção</p>
          <p className="text-sm text-foreground leading-relaxed">
            Levando a pressão para o alvo{idadeCoracao.resultado.fatores.some((f) => f.chave === "tabagismo") ? " e parando de fumar" : ""}, seu coração ficaria com{" "}
            <span className="font-bold">{idadeCoracao.projecao} anos</span>.
          </p>
          <p className="text-xs text-muted-foreground mt-2">Isto é uma projeção de cenário, não uma promessa de resultado.</p>
        </SurfaceCard>
      )}

      {/* ── Evolução ──────────────────────────────────────────────── */}
      {idadeCoracao.aplicavel && historico.length >= 2 && (
        <div className="mb-5">
          <SectionHeader title="Evolução" icon={HeartPulse} />
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={historico} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                <Line type="monotone" dataKey="idadeDoCoracao" name="Idade do coração" stroke={DOMAIN_COLORS.coracao} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="idadeReal" name="Idade real" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </SurfaceCard>
        </div>
      )}

      {/* ── Tempo no Alvo ─────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Tempo no alvo" icon={Gauge} />
        <SurfaceCard className="mb-3">
          <div className="text-center py-2">
            <p className="text-5xl font-display font-bold text-foreground leading-none">
              {tempoNoAlvo.mes.percentual != null ? `${tempoNoAlvo.mes.percentual}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{tempoNoAlvo.mes.frase}</p>
          </div>
        </SurfaceCard>
        {chartTempoNoAlvo.some((c) => c.percentual > 0) && (
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartTempoNoAlvo} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="semana" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v}%`, "No alvo"]} />
                <Bar dataKey="percentual" fill={DOMAIN_COLORS.pressao} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </SurfaceCard>
        )}
      </div>

      {/* ── Capacidade ────────────────────────────────────────────── */}
      <div className="mb-5">
        <SectionHeader title="Capacidade" icon={Activity} />
        <div className="space-y-3 mb-3">
          <SurfaceCard>
            <div className="flex items-center gap-3 mb-1">
              <Footprints className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">Caminhada de 6 minutos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {capacidade.evolucao.caminhada.atual != null ? `${capacidade.evolucao.caminhada.atual} m` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.caminhada.frase}</p>
          </SurfaceCard>
          <SurfaceCard>
            <div className="flex items-center gap-3 mb-1">
              <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">Sentar e levantar</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {capacidade.evolucao.sentarLevantar.atual != null ? `${capacidade.evolucao.sentarLevantar.atual} rep.` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.sentarLevantar.frase}</p>
          </SurfaceCard>
          <SurfaceCard>
            <div className="flex items-center gap-3 mb-1">
              <HeartCrack className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-sm font-semibold text-foreground">Recuperação dos batimentos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {capacidade.evolucao.recuperacao.atual != null ? `${capacidade.evolucao.recuperacao.atual} bpm` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{capacidade.evolucao.recuperacao.frase}</p>
          </SurfaceCard>
        </div>
        <Button variant="outline" className="w-full" onClick={() => navigate("/caminhada")}>
          Fazer ou refazer os testes
        </Button>
      </div>

      {/* ── Conquistas ────────────────────────────────────────────── */}
      {conquistas.length > 0 && (
        <div>
          <SectionHeader title="Conquistas" />
          <SurfaceCard>
            <ul className="space-y-3">
              {conquistas.map((c) => (
                <li key={c.id} className="text-sm text-foreground leading-relaxed pl-3 border-l-2 border-border">
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
