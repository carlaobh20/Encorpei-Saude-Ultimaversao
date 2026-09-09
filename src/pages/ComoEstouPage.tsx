/**
 * ComoEstouPage — "Como estou agora": o botão contra o medo.
 *
 * docs/ENGAJAMENTO-CARDIO.md §3.2 · docs/MAPEAMENTO-CARDIO.md §6.
 *
 * É a tela que o paciente abre às três da manhã com medo de estar infartando.
 * Por isso o telefone de emergência fica visível ANTES de qualquer pergunta,
 * a triagem de sinais de alarme vence tudo, e o app nunca diz "você está
 * bem" — descreve os números do paciente e devolve a decisão ao médico.
 *
 * Se este arquivo for editado, releia comoEstou.ts e MAPEAMENTO-CARDIO.md §6.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PhoneCall, AlertTriangle, CheckCircle2, Circle, HeartPulse,
  ArrowRight, History as HistoryIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { EMERGENCIA_TELEFONE } from "@/lib/config";
import { useCheckins, useContextoComoEstou } from "@/hooks/useEngajamento";
import {
  SINAIS_DE_ALARME, avaliarComoEstou, type LinhaEspelho, type ResultadoComoEstou,
} from "@/lib/clinical/comoEstou";
import type { WellbeingCheckin } from "@/types/cardio";

type Passo = "alarme" | "sentir" | "resultado";

const DESFECHO_ROTULO: Record<WellbeingCheckin["desfecho"], string> = {
  emergencia: "Emergência",
  avisar_medico: "Atenção registrada",
  registrar: "Registrado",
};

function fmtDiaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Bloco de emergência, sempre visível ──────────────────────────────

function BlocoEmergencia({ tamanho = "compacto" }: { tamanho?: "compacto" | "grande" }) {
  return (
    <SurfaceCard className="bg-error-bg border-0 mb-6 text-center py-6">
      <AlertTriangle className="h-7 w-7 text-error mx-auto mb-2" />
      <p className="text-sm font-semibold text-error mb-4">Se você está passando mal agora</p>
      <a
        href={`tel:${EMERGENCIA_TELEFONE}`}
        className={cn(
          "inline-flex items-center justify-center gap-3 w-full rounded-3xl bg-error text-white font-bold shadow-lg active:scale-[0.98] transition-transform",
          tamanho === "grande" ? "h-20 text-3xl" : "h-16 text-2xl"
        )}
      >
        <PhoneCall className="h-7 w-7" />
        Ligar {EMERGENCIA_TELEFONE}
      </a>
      <p className="text-xs text-error/80 mt-3">Não é preciso responder nada antes de ligar.</p>
    </SurfaceCard>
  );
}

// ── Espelho ───────────────────────────────────────────────────────────

function CartaoEspelho({ linha }: { linha: LinhaEspelho }) {
  return (
    <SurfaceCard className={cn(linha.tom === "atencao" && "bg-warning-bg border-0")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{linha.rotulo}</p>
        {linha.estimativa && (
          <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0">
            estimativa
          </span>
        )}
      </div>
      <p className={cn("text-2xl font-bold mt-1", linha.tom === "atencao" ? "text-warning" : "text-foreground")}>
        {linha.valor}
      </p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{linha.contexto}</p>
    </SurfaceCard>
  );
}

export default function ComoEstouPage() {
  const [passo, setPasso] = useState<Passo>("alarme");
  const [alarmes, setAlarmes] = useState<string[]>([]);
  const [comoSeSente, setComoSeSente] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");
  const [resultado, setResultado] = useState<ResultadoComoEstou | null>(null);
  const [registrado, setRegistrado] = useState(false);

  const ctx = useContextoComoEstou();
  const { checkins, isLoading, registrar } = useCheckins();

  const alternarAlarme = (chave: string) => {
    setAlarmes((prev) => (prev.includes(chave) ? prev.filter((c) => c !== chave) : [...prev, chave]));
  };

  const verResultado = () => {
    const r = avaliarComoEstou({ alarmes, comoSeSente, observacao: observacao.trim() || null }, ctx);
    setResultado(r);
    setPasso("resultado");
  };

  // Registra assim que o resultado aparece — inclusive em emergência, para o
  // médico ver depois. Falha de gravação nunca trava a tela (regra do hook).
  useEffect(() => {
    if (!resultado || registrado) return;
    setRegistrado(true);
    registrar.mutate({
      desfecho: resultado.desfecho,
      alarmes: resultado.alarmesMarcados.map((a) => a.chave),
      como_se_sente: comoSeSente,
      observacao: observacao.trim() || null,
      espelho: { linhas: resultado.espelho },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultado, registrado]);

  const recomecar = () => {
    setPasso("alarme");
    setAlarmes([]);
    setComoSeSente(null);
    setObservacao("");
    setResultado(null);
    setRegistrado(false);
  };

  const historico = useMemo(() => checkins.slice(0, 8), [checkins]);

  if (isLoading && !resultado) {
    return (
      <div>
        <PageHeader title="Como estou agora" />
        <TabPageSkeleton />
      </div>
    );
  }

  // ── Passo 3: resultado ────────────────────────────────────────────
  if (passo === "resultado" && resultado) {
    if (resultado.desfecho === "emergencia") {
      return (
        <div className="pb-10">
          <PageHeader title="Como estou agora" />
          <SurfaceCard className="bg-error text-white border-0 mb-6 text-center py-8">
            <AlertTriangle className="h-9 w-9 mx-auto mb-3" />
            <h2 className="text-white text-xl font-bold mb-2">{resultado.titulo}</h2>
            <p className="text-sm leading-relaxed text-white/90 mb-6">{resultado.mensagem}</p>
            <a
              href={`tel:${EMERGENCIA_TELEFONE}`}
              className="inline-flex items-center justify-center gap-3 w-full h-20 rounded-3xl bg-white text-error text-3xl font-bold shadow-lg active:scale-[0.98] transition-transform"
            >
              <PhoneCall className="h-8 w-8" />
              Ligar {EMERGENCIA_TELEFONE}
            </a>
          </SurfaceCard>
          <Link to="/emergencia">
            <Button variant="outline" size="lg" className="w-full gap-2">
              Ver orientação de emergência <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="pb-10">
        <PageHeader title="Como estou agora" />
        <BlocoEmergencia />

        <SurfaceCard
          className={cn(
            "mb-6 border-0",
            resultado.desfecho === "avisar_medico" ? "bg-warning-bg" : "bg-cardio-50"
          )}
        >
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className={cn("h-5 w-5", resultado.desfecho === "avisar_medico" ? "text-warning" : "text-primary")} />
            <h2 className="text-foreground text-lg font-bold">{resultado.titulo}</h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">{resultado.mensagem}</p>
        </SurfaceCard>

        {resultado.espelho.length > 0 && (
          <div className="mb-6">
            <SectionHeader title="Seus números de hoje" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {resultado.espelho.map((linha) => (
                <CartaoEspelho key={linha.rotulo} linha={linha} />
              ))}
            </div>
          </div>
        )}

        <Button size="xl" variant="outline" className="w-full mb-8" onClick={recomecar}>
          Fazer nova avaliação
        </Button>

        <HistoricoCheckins itens={historico} />
      </div>
    );
  }

  // ── Passo 1 e 2 ───────────────────────────────────────────────────
  return (
    <div className="pb-10">
      <PageHeader title="Como estou agora" subtitle="Um retrato de hoje, não um diagnóstico" />
      <BlocoEmergencia tamanho="grande" />

      {passo === "alarme" && (
        <div>
          <SectionHeader title="Você está sentindo algum destes agora?" />
          <div className="space-y-2.5 mb-5">
            {SINAIS_DE_ALARME.map((sinal) => {
              const marcado = alarmes.includes(sinal.chave);
              return (
                <button
                  key={sinal.chave}
                  type="button"
                  onClick={() => alternarAlarme(sinal.chave)}
                  className={cn(
                    "w-full text-left rounded-2xl border p-4 flex items-start gap-3 transition-colors",
                    marcado ? "border-error bg-error-bg" : "border-border bg-card"
                  )}
                >
                  {marcado ? (
                    <CheckCircle2 className="h-6 w-6 text-error shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn("text-base font-semibold", marcado ? "text-error" : "text-foreground")}>
                      {sinal.pergunta}
                    </p>
                    {sinal.ajuda && <p className="text-xs text-muted-foreground mt-1">{sinal.ajuda}</p>}
                  </div>
                </button>
              );
            })}
          </div>

          {alarmes.length > 0 ? (
            <Button size="xl" className="w-full bg-error hover:opacity-90" onClick={verResultado}>
              Ver o que fazer agora
            </Button>
          ) : (
            <Button size="xl" variant="outline" className="w-full" onClick={() => setPasso("sentir")}>
              Nenhum destes
            </Button>
          )}
        </div>
      )}

      {passo === "sentir" && (
        <div>
          <SectionHeader title="Como você se sente agora?" subtitle="0 = muito mal · 10 = muito bem" />
          <SurfaceCard className="mb-5">
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setComoSeSente(n)}
                  className={cn(
                    "h-12 rounded-xl border text-base font-bold transition-colors",
                    comoSeSente === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </SurfaceCard>

          <SectionHeader title="Quer contar mais alguma coisa? (opcional)" />
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: dormi mal essa noite, esqueci o remédio de manhã..."
            className="mb-5 min-h-[90px]"
          />

          <div className="flex gap-3">
            <Button variant="outline" size="xl" className="flex-1" onClick={() => setPasso("alarme")}>
              Voltar
            </Button>
            <Button size="xl" className="flex-1" onClick={verResultado}>
              Ver resultado
            </Button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <HistoricoCheckins itens={historico} />
      </div>
    </div>
  );
}

function HistoricoCheckins({ itens }: { itens: WellbeingCheckin[] }) {
  return (
    <div>
      <SectionHeader title="Seus últimos registros" icon={HistoryIcon} />
      {itens.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="Nenhum registro ainda"
          description="Toda vez que você usar 'Como estou agora', fica guardado aqui e para o seu médico ver."
          variant="card"
        />
      ) : (
        <div className="space-y-2.5">
          {itens.map((c) => (
            <SurfaceCard key={c.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{fmtDiaHora(c.ocorrido_em)}</p>
                {c.como_se_sente != null && (
                  <p className="text-xs text-muted-foreground">Como se sentia: {c.como_se_sente}/10</p>
                )}
              </div>
              <span
                className={cn(
                  "text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0",
                  c.desfecho === "emergencia"
                    ? "bg-error-bg text-error"
                    : c.desfecho === "avisar_medico"
                    ? "bg-warning-bg text-warning"
                    : "bg-cardio-50 text-primary"
                )}
              >
                {DESFECHO_ROTULO[c.desfecho]}
              </span>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
