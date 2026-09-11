/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * REGISTRO RÁPIDO — o botão do meio da barra inferior
 * ══════════════════════════════════════════════════════════════════════
 *
 * A tese: o paciente cardíaco abandona o app quando registrar dá trabalho.
 * Então registrar não pode custar mais que três toques, e o que o médico
 * pediu hoje precisa estar em cima, marcado, sem o paciente ter que lembrar.
 *
 * O que fica AQUI DENTRO (registro direto, sem trocar de tela):
 *   pressão, peso, batimentos, oxigenação, glicemia, como me sinto (0–10).
 * O que LEVA PARA A TELA (precisa de contexto que não cabe num campo):
 *   remédios, sintomas, caminhada, alimentação, sono.
 *
 * REGRA CLÍNICA: nenhuma linha aqui interpreta o número para o paciente.
 * Valor perigoso não vira diagnóstico — vira o caminho para /como-estou,
 * que é a tela escrita para isso. Ver docs/CONTRATO-DE-CODIGO.md.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, Droplets, HeartPulse, Pill, Scale, Smile, Footprints,
  Stethoscope, Utensils, Moon, Check, ChevronLeft,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useBloodPressure, useWeight, useHeartRate, useSpo2, useGlucose } from "@/hooks/useCardioReadings";
import { useCheckins } from "@/hooks/useEngajamento";
import { usePendenciasDeHoje, type MetricaPlano } from "@/hooks/usePlanoMonitoramento";

type Destino =
  | { tipo: "inline"; chave: "bp" | "weight" | "hr" | "spo2" | "glucose" | "wellbeing" }
  | { tipo: "rota"; path: string };

interface Atalho {
  metric: MetricaPlano;
  rotulo: string;
  icone: typeof Scale;
  destino: Destino;
}

const ATALHOS: Atalho[] = [
  { metric: "bp",         rotulo: "Pressão",       icone: Activity,    destino: { tipo: "inline", chave: "bp" } },
  { metric: "weight",     rotulo: "Peso",          icone: Scale,       destino: { tipo: "inline", chave: "weight" } },
  { metric: "medication", rotulo: "Remédios",      icone: Pill,        destino: { tipo: "rota", path: "/remedios" } },
  { metric: "wellbeing",  rotulo: "Como me sinto", icone: Smile,       destino: { tipo: "inline", chave: "wellbeing" } },
  { metric: "hr",         rotulo: "Batimentos",    icone: HeartPulse,  destino: { tipo: "inline", chave: "hr" } },
  { metric: "spo2",       rotulo: "Oxigenação",    icone: Droplets,    destino: { tipo: "inline", chave: "spo2" } },
  { metric: "glucose",    rotulo: "Glicemia",      icone: Droplets,    destino: { tipo: "inline", chave: "glucose" } },
  { metric: "symptoms",   rotulo: "Sintoma",       icone: Stethoscope, destino: { tipo: "rota", path: "/sintomas" } },
  { metric: "walk",       rotulo: "Caminhada",     icone: Footprints,  destino: { tipo: "rota", path: "/caminhada" } },
  { metric: "sodium",     rotulo: "Alimentação",   icone: Utensils,    destino: { tipo: "rota", path: "/alimentacao" } },
  { metric: "sleep",      rotulo: "Sono",          icone: Moon,        destino: { tipo: "rota", path: "/sono" } },
];

export function RegistroRapido({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const navigate = useNavigate();
  const [form, setForm] = useState<Destino | null>(null);
  const { pendencias, abertas, concluidas, total, prescrito } = usePendenciasDeHoje();

  const pendente = (m: MetricaPlano) => abertas.some((p) => p.metric === m);
  const noPlano = (m: MetricaPlano) => pendencias.some((p) => p.metric === m);

  // O que o médico pediu vem primeiro; o resto continua acessível abaixo.
  const ordenados = [...ATALHOS].sort((a, b) => {
    const peso = (m: MetricaPlano) => (pendente(m) ? 0 : noPlano(m) ? 1 : 2);
    return peso(a.metric) - peso(b.metric);
  });

  function fechar() {
    setForm(null);
    onFechar();
  }

  function abrir(a: Atalho) {
    if (a.destino.tipo === "rota") {
      fechar();
      navigate(a.destino.path);
      return;
    }
    setForm(a.destino);
  }

  return (
    <Sheet open={aberto} onOpenChange={(v) => (v ? null : fechar())}>
      {/* `leitura-paciente` (index.css) precisa vir aqui também: a folha é
          renderizada num portal, fora da casca do app, e sem a classe o texto
          voltaria à escala pequena justamente na tela onde o paciente digita
          número (auditoria §5). */}
      {/* `sm:max-w-2xl mx-auto`: a folha continua encostada embaixo, mas no
          monitor de 1440px ela deixa de esticar um quadrado de uma palavra até
          470px de largura. A coluna centralizada é a mesma largura de leitura
          dos formulários do paciente. */}
      <SheetContent
        side="bottom"
        className="leitura-paciente mx-auto sm:max-w-2xl rounded-t-2xl max-h-[88vh] overflow-y-auto pb-8"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            {form ? (
              <button
                type="button"
                onClick={() => setForm(null)}
                aria-label="Voltar para a lista do que registrar"
                className="inline-flex items-center gap-1 min-h-[44px] text-primary"
              >
                <ChevronLeft className="h-5 w-5" /> Registrar
              </button>
            ) : (
              "Registrar"
            )}
          </SheetTitle>
        </SheetHeader>

        {form ? (
          <FormularioInline chave={(form as any).chave} onPronto={fechar} />
        ) : (
          <>
            <div className="mt-1 mb-4 rounded-xl bg-muted/50 px-3 py-2.5">
              <p className="text-sm font-medium">
                {total === 0
                  ? "Nada combinado para hoje."
                  : abertas.length === 0
                  ? "Tudo que era para hoje já está registrado."
                  : `Faltam ${abertas.length} de ${total} registros de hoje.`}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {prescrito
                  ? "Este é o plano que seu médico definiu."
                  : "Sugestão do app — seu médico ainda não definiu um plano."}
                {concluidas > 0 ? ` ${concluidas} já feito${concluidas > 1 ? "s" : ""}.` : ""}
              </p>
            </div>

            {/* Duas colunas abaixo de 420px — o mesmo corte de `GradeOpcoes`.
                Com três colunas em 360–390px o quadrado fica com ~100px de área
                útil e "Oxigenação"/"Alimentação" partiam no meio da palavra. */}
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-2.5">
              {ordenados.map((a) => {
                const falta = pendente(a.metric);
                const feito = noPlano(a.metric) && !falta;
                return (
                  <button
                    key={a.metric}
                    onClick={() => abrir(a)}
                    className={cn(
                      // 88px de alvo: o dedo de quem tem 70 anos erra um quadrado
                      // de 60px — e errar AQUI não custa um toque, custa registrar
                      // a medida errada. Alvo grande é regra, não estética.
                      "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-4 min-h-[88px] transition active:scale-[0.97]",
                      falta ? "border-primary/60 bg-primary/5" : "border-border bg-card"
                    )}
                  >
                    {feito ? (
                      <span className="absolute top-1.5 right-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-success text-white">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    ) : null}
                    <a.icone className={cn("h-6 w-6", falta ? "text-primary" : "text-muted-foreground")} strokeWidth={1.75} />
                    {/* `w-full break-words` é só a rede de segurança: com a grade
                        de duas colunas em telas estreitas nenhum rótulo chega a
                        precisar dela, mas um rótulo novo mais longo fica dentro
                        do quadrado em vez de vazar pela borda. */}
                    <span className="w-full text-base font-medium leading-tight text-center break-words">
                      {a.rotulo}
                    </span>
                    {/* "pedido hoje" é informação que o paciente PRECISA ler —
                        nunca abaixo de 12px (estava em 10px). */}
                    {falta ? <span className="text-sm text-primary font-semibold">pedido hoje</span> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Formulários curtos ───────────────────────────────────────────────

function Campo({ label, sufixo, ...props }: any) {
  return (
    <label className="block">
      <span className="text-base font-medium">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <Input
          inputMode="numeric"
          className="h-14 text-2xl font-semibold tabular-nums text-center"
          {...props}
        />
        {sufixo ? <span className="text-base text-muted-foreground w-14 shrink-0">{sufixo}</span> : null}
      </div>
    </label>
  );
}

function FormularioInline({ chave, onPronto }: { chave: string; onPronto: () => void }) {
  const bp = useBloodPressure();
  const weight = useWeight();
  const hr = useHeartRate();
  const spo2 = useSpo2();
  const glucose = useGlucose();
  const checkins = useCheckins();

  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [nota, setNota] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      if (chave === "bp") {
        const sis = Number(a), dia = Number(b), pulso = c ? Number(c) : undefined;
        if (!sis || !dia) throw new Error("Preencha os dois números da pressão.");
        // Hora do dia define o contexto: é isso que faz a medida valer para a
        // média domiciliar (MRPA) que o médico usa.
        const h = new Date().getHours();
        await (bp.registrar as any).mutateAsync({
          systolic: sis, diastolic: dia, pulse: pulso,
          context: h < 12 ? "morning" : h >= 17 ? "evening" : "random",
          cuff_validated: true,
        });
      } else if (chave === "weight") {
        const v = Number(a.replace(",", "."));
        if (!v) throw new Error("Digite seu peso.");
        await (weight.registrar as any).mutateAsync({ value: v });
      } else if (chave === "hr") {
        const v = Number(a);
        if (!v) throw new Error("Digite os batimentos.");
        await (hr.registrar as any).mutateAsync({ bpm: v, context: "resting" });
      } else if (chave === "spo2") {
        const v = Number(a);
        if (!v) throw new Error("Digite a oxigenação.");
        await (spo2.registrar as any).mutateAsync({ value: v, context: "spot" });
      } else if (chave === "glucose") {
        const v = Number(a);
        if (!v) throw new Error("Digite a glicemia.");
        await (glucose.registrar as any).mutateAsync({ value: v, context: "random" });
      } else if (chave === "wellbeing") {
        if (nota === null) throw new Error("Escolha um número de 0 a 10.");
        await (checkins.registrar as any).mutateAsync({
          desfecho: "registrar", alarmes: [], como_se_sente: nota,
        });
        toast.success("Registrado.");
      }
      onPronto();
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-2 space-y-4">
      {chave === "bp" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Número maior" value={a} onChange={(e: any) => setA(e.target.value)} placeholder="120" autoFocus />
            <Campo label="Número menor" value={b} onChange={(e: any) => setB(e.target.value)} placeholder="80" />
          </div>
          <Campo label="Batimentos (se o aparelho mostrar)" value={c} onChange={(e: any) => setC(e.target.value)} placeholder="70" sufixo="bpm" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sente-se, apoie o braço na mesa e espere cinco minutos parado antes de medir.
          </p>
        </>
      )}

      {chave === "weight" && (
        <>
          <Campo label="Peso de hoje" value={a} onChange={(e: any) => setA(e.target.value)} placeholder="78,5" sufixo="kg" autoFocus />
          <p className="text-sm text-muted-foreground leading-relaxed">
            De manhã, depois de ir ao banheiro e antes de comer — sempre do mesmo jeito.
            É a comparação entre os dias que interessa ao seu médico.
          </p>
        </>
      )}

      {chave === "hr" && <Campo label="Batimentos em repouso" value={a} onChange={(e: any) => setA(e.target.value)} placeholder="68" sufixo="bpm" autoFocus />}
      {chave === "spo2" && <Campo label="Oxigenação no dedo" value={a} onChange={(e: any) => setA(e.target.value)} placeholder="97" sufixo="%" autoFocus />}
      {chave === "glucose" && <Campo label="Glicemia" value={a} onChange={(e: any) => setA(e.target.value)} placeholder="98" sufixo="mg/dL" autoFocus />}

      {chave === "wellbeing" && (
        <div>
          <p className="text-base font-medium">De 0 a 10, como você está hoje?</p>
          <p className="text-sm text-muted-foreground mb-3">0 é o pior dia que você já teve; 10 é o melhor.</p>
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={nota === n}
                aria-label={`Nota ${n} de 10`}
                onClick={() => setNota(n)}
                className={cn(
                  "h-12 min-w-[44px] rounded-lg border text-base font-semibold tabular-nums transition",
                  nota === n ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      <Button onClick={salvar} disabled={salvando} className="w-full h-12 text-base">
        {salvando ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}
