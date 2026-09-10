/**
 * GLICEMIA — a tela que faltava (a tabela e o hook já existiam).
 *
 * Por que glicemia tem tela num app de cardiologia: diabetes é o comorbidade
 * que mais muda a conduta cardiológica — alvo de LDL, escolha de anti-
 * hipertensivo, indicação de iSGLT2. `glucose_readings` e `useGlucose` já
 * estavam prontos desde o baseline; faltava o lugar onde o paciente digita.
 * Até aqui o dado só entrava por importação, ou seja, quase nunca.
 *
 * ══════════════════════════════════════════════════════════════════════
 * REGRA CLÍNICA INEGOCIÁVEL desta tela
 * ══════════════════════════════════════════════════════════════════════
 * A tela NÃO interpreta o número e NÃO sugere conduta. Ela não diz "sua
 * glicemia está alta", não diz "controlada", não classifica em pré-diabetes,
 * não manda comer, não manda corrigir com insulina, não sugere dose.
 *
 * O único julgamento que ela faz é sobre PARA QUEM AVISAR, e ele é
 * deliberadamente grosseiro e conservador:
 *   - valor muito baixo  → orientação de procurar atendimento agora;
 *   - valor fora da faixa de tranquilidade → "avise seu médico";
 *   - dentro da faixa    → nenhum comentário sobre o número. Nenhum.
 *
 * As faixas abaixo NÃO são critério diagnóstico e não estão aqui para
 * classificar ninguém: são um gatilho de encaminhamento. É por isso que o
 * texto nunca nomeia o achado ("hipoglicemia", "hiperglicemia") — nomear já
 * seria dar diagnóstico, e diagnóstico é do médico.
 *
 * Modelo de tela: PesoPage (registro rápido → último valor → histórico).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { Droplet, Phone } from "lucide-react";
import { PageHeader, SurfaceCard, EmptyState, PageLoader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGlucose } from "@/hooks/useCardioReadings";
import { EMERGENCIA_TELEFONE } from "@/lib/config";
import { cn } from "@/lib/utils";
import type { GlucoseReading } from "@/types/cardio";

type Contexto = GlucoseReading["context"];

/**
 * Os contextos são exatamente os quatro que o banco aceita — o check
 * constraint de `glucose_readings` é `context in
 * ('fasting','post_meal','random','bedtime')`.
 *
 * Nota de escopo: "antes da refeição" (pré-prandial) foi pedido no desenho da
 * tela, mas não existe como valor permitido no schema; inserir esse contexto
 * hoje seria rejeitado pelo Postgres. Em vez de escondê-lo dentro de "outro
 * momento" — o que faria o médico ler um pré-prandial como medida avulsa — a
 * opção fica de fora até a migração acrescentar 'pre_meal'. "Em jejum" ganhou
 * a explicação entre parênteses para que quem mede antes de comer de manhã
 * não escolha errado.
 */
const CONTEXTOS: { valor: Contexto; label: string; ajuda: string }[] = [
  { valor: "fasting",   label: "Em jejum",             ajuda: "de manhã, antes de comer qualquer coisa" },
  { valor: "post_meal", label: "Depois da refeição",   ajuda: "cerca de 2 horas depois de comer" },
  { valor: "bedtime",   label: "Antes de dormir",      ajuda: "na hora de deitar" },
  { valor: "random",    label: "Outro momento",        ajuda: "qualquer outra hora do dia" },
];

const CONTEXTO_LABEL: Record<Contexto, string> = {
  fasting: "Em jejum",
  post_meal: "Depois da refeição",
  bedtime: "Antes de dormir",
  random: "Outro momento",
};

/** Limites do próprio campo no banco (`value between 20 and 700`). */
const MIN_VALIDO = 20;
const MAX_VALIDO = 700;

/**
 * Gatilho de encaminhamento — não é classificação clínica.
 *
 * `atendimento`: valor muito baixo. É o único caso em que o app tira o
 * paciente da tela e manda procurar ajuda, porque hipoglicemia grave é
 * questão de minutos e esperar retorno do consultório não serve.
 *
 * `medico`: qualquer coisa fora de uma faixa larga de tranquilidade. A faixa
 * é larga de propósito: aviso que dispara toda hora vira ruído, o paciente
 * para de ler e o aviso que importa passa batido junto.
 */
type Encaminhamento = "atendimento" | "medico" | null;

function encaminhamento(valor: number, contexto: Contexto): Encaminhamento {
  if (valor < 70) return "atendimento";
  // Depois de comer o número sobe por fisiologia normal, então o gatilho sobe
  // junto — senão a tela avisaria o médico todo dia sobre gente que está bem.
  const teto = contexto === "post_meal" ? 250 : 180;
  if (valor > teto) return "medico";
  return null;
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function dataHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function GlicemiaPage() {
  const { readings, registrar, isLoading } = useGlucose();
  const [valor, setValor] = useState("");
  const [contexto, setContexto] = useState<Contexto>("fasting");
  const [salvando, setSalvando] = useState(false);

  const lista = (readings ?? []) as GlucoseReading[];
  const ultimo = lista[0] ?? null;

  /**
   * O aviso é calculado sobre a ÚLTIMA medida registrada, não sobre o que está
   * sendo digitado: enquanto a pessoa digita "1" de "120" o app não pode
   * gritar "procure atendimento".
   */
  const aviso = useMemo(
    () => (ultimo ? encaminhamento(Number(ultimo.value), ultimo.context) : null),
    [ultimo]
  );

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v < MIN_VALIDO || v > MAX_VALIDO) {
      // Mensagem de digitação, não de clínica: fala do aparelho, não do corpo.
      toast.error(`Digite um valor entre ${MIN_VALIDO} e ${MAX_VALIDO} mg/dL, como aparece no aparelho.`);
      return;
    }
    setSalvando(true);
    try {
      await (registrar as any).mutateAsync({ value: Math.round(v), context: contexto });
      setValor("");
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-4 pb-10">
      <PageHeader
        title="Glicemia"
        subtitle="Anote o número como ele aparece no aparelho, sem arredondar."
      />

      {/* ── Registro rápido ───────────────────────────────────────── */}
      <SurfaceCard>
        <Label htmlFor="glicemia" className="block">
          <span className="text-sm font-medium">Glicemia agora</span>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="glicemia"
              inputMode="numeric"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="102"
              className="h-14 text-2xl font-semibold tabular-nums text-center"
            />
            <span className="text-base text-muted-foreground w-16">mg/dL</span>
          </div>
        </Label>

        {/* Contexto: sem ele o número não serve para o médico — 180 em jejum e
            180 depois de comer são conversas diferentes. Botão em vez de select
            porque são quatro opções e a tela é de registro rápido. */}
        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Quando você mediu?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {CONTEXTOS.map((c) => (
              <button
                key={c.valor}
                type="button"
                onClick={() => setContexto(c.valor)}
                aria-pressed={contexto === c.valor}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors touch-target",
                  contexto === c.valor
                    ? "border-primary bg-cardio-50 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-primary/40"
                )}
              >
                <span className="block text-sm font-medium">{c.label}</span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">{c.ajuda}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <Button onClick={salvar} disabled={salvando} className="w-full h-12 mt-4 text-base">
          {salvando ? "Salvando…" : "Registrar glicemia"}
        </Button>
      </SurfaceCard>

      {/* ── Último valor ──────────────────────────────────────────── */}
      {ultimo ? (
        <SurfaceCard>
          <div className="flex items-baseline justify-between">
            <div>
              {/* O número aparece cru, sem cor de semáforo e sem adjetivo.
                  Colorir por faixa já seria interpretar. */}
              <p className="text-3xl font-semibold tabular-nums">
                {Number(ultimo.value)} <span className="text-lg font-normal text-muted-foreground">mg/dL</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {CONTEXTO_LABEL[ultimo.context]} · {dataHora(ultimo.recorded_at)}
              </p>
            </div>
          </div>

          {aviso === "atendimento" ? (
            <div className="mt-4 rounded-xl bg-error/10 px-3 py-3">
              <p className="text-sm font-semibold">Esse valor está muito baixo.</p>
              <p className="text-sm mt-1.5">
                Não fique sozinho e não espere passar. Procure atendimento agora — se estiver
                confuso, tremendo, suando frio ou se sentindo mal, ligue para o {EMERGENCIA_TELEFONE}.
              </p>
              <a
                href={`tel:${EMERGENCIA_TELEFONE}`}
                className="mt-3 inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-error text-white text-base font-semibold touch-target"
              >
                <Phone className="h-4 w-4" /> Ligar {EMERGENCIA_TELEFONE}
              </a>
            </div>
          ) : aviso === "medico" ? (
            <div className="mt-4 rounded-xl bg-warning/10 px-3 py-3">
              <p className="text-sm">
                Esse valor está fora da faixa em que o app fica quieto.{" "}
                <strong>Avise seu médico</strong> — quem diz o que esse número significa para o seu
                tratamento é ele, não o aplicativo.
              </p>
            </div>
          ) : (
            // Dentro da faixa: o app registra e cala. Um "tudo certo!" aqui
            // seria interpretação — e seria interpretação errada num paciente
            // cuja meta o médico pode ter colocado em outro lugar.
            <p className="text-xs text-muted-foreground mt-4">
              Registrado. Seu médico vê esse valor junto com os outros no acompanhamento.
            </p>
          )}
        </SurfaceCard>
      ) : (
        <EmptyState
          icon={Droplet}
          title="Nenhuma glicemia registrada ainda"
          description="Registre a primeira e o histórico começa a aparecer aqui para você mostrar na consulta."
        />
      )}

      {/* ── Histórico ─────────────────────────────────────────────── */}
      {lista.length > 1 ? (
        <SurfaceCard>
          <p className="text-sm font-medium mb-2">Últimos registros</p>
          <ul className="divide-y divide-border">
            {lista.slice(0, 14).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5 gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-muted-foreground">{dataCurta(r.recorded_at)}</span>
                  <span className="text-xs text-muted-foreground/80 ml-2">{CONTEXTO_LABEL[r.context]}</span>
                </div>
                {/* Sem cor por faixa também no histórico: uma coluna colorida
                    é um laudo visual, e o app não dá laudo. */}
                <span className="text-sm font-semibold tabular-nums shrink-0">
                  {Number(r.value)} mg/dL
                </span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}

      <p className="text-xs text-muted-foreground px-1">
        O Encorpei Cardio guarda e organiza seus registros. Ele não interpreta glicemia, não
        ajusta remédio e não substitui a consulta.
      </p>
    </div>
  );
}
