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
 *
 * ── O que a passada visual mudou, e o que NÃO podia mudar ─────────────
 * NADA do vermelho e nada do encaminhamento. O bloco de emergência continua
 * antes de qualquer pergunta, com o mesmo tamanho, a mesma cor e o mesmo
 * telefone; a tela de desfecho "emergência" continua vermelha cheia com o
 * botão de ligar ocupando a largura toda; nenhuma palavra de `comoEstou.ts`
 * nem desta tela foi tocada. Isso é deliberado: é a tela que alguém abre às
 * três da manhã com medo de estar infartando, e acabamento não vale um
 * milissegundo a mais de hesitação.
 *
 * O que mudou é acabamento fora do caminho crítico:
 *  · títulos de seção na escala de título (valiam 17px, o mesmo do corpo);
 *  · os botões de sinal de alarme e a escala de 0 a 10 ganharam 48px de alvo
 *    e `aria-pressed` — sem ele, quem usa leitor de tela ouvia "Dor no peito,
 *    botão" sem saber se já havia marcado;
 *  · os cartões do espelho e do histórico passaram ao corpo legível, com o
 *    selo "estimativa" em 12px em vez de 10px (o piso da auditoria);
 *  · a tela ganhou a coluna com teto de largura das demais.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  PhoneCall, AlertTriangle, CheckCircle2, Circle, HeartPulse,
  ArrowRight, History as HistoryIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { TelaPaciente, TituloSecao } from "@/components/shell";
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
    // Intocado de propósito: cor, tamanho do botão, ordem e texto são os
    // mesmos. Ver o cabeçalho do arquivo.
    <SurfaceCard className="bg-error-bg border-0 text-center py-6">
      <AlertTriangle className="h-7 w-7 text-error mx-auto mb-2" aria-hidden />
      <p className="text-base font-semibold text-error mb-4">Se você está passando mal agora</p>
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
      <p className="text-sm text-error/80 mt-3">Não é preciso responder nada antes de ligar.</p>
    </SurfaceCard>
  );
}

// ── Espelho ───────────────────────────────────────────────────────────

function CartaoEspelho({ linha }: { linha: LinhaEspelho }) {
  return (
    <SurfaceCard className={cn(linha.tom === "atencao" && "bg-warning-bg border-0")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground min-w-0 break-words">{linha.rotulo}</p>
        {linha.estimativa && (
          <span className="text-xs font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-muted text-muted-foreground shrink-0">
            estimativa
          </span>
        )}
      </div>
      <p className={cn("text-2xl font-bold mt-1 tabular-nums", linha.tom === "atencao" ? "text-warning" : "text-foreground")}>
        {linha.valor}
      </p>
      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{linha.contexto}</p>
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
      <TelaPaciente>
        <PageHeader title="Como estou agora" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  // ── Passo 3: resultado ────────────────────────────────────────────
  if (passo === "resultado" && resultado) {
    if (resultado.desfecho === "emergencia") {
      return (
        <TelaPaciente>
          <PageHeader title="Como estou agora" />
          {/* Desfecho de emergência: idêntico ao que existia. */}
          <SurfaceCard className="bg-error text-white border-0 text-center py-8">
            <AlertTriangle className="h-9 w-9 mx-auto mb-3" aria-hidden />
            <h2 className="text-white text-xl font-bold mb-2">{resultado.titulo}</h2>
            <p className="text-base leading-relaxed text-white/90 mb-6">{resultado.mensagem}</p>
            <a
              href={`tel:${EMERGENCIA_TELEFONE}`}
              className="inline-flex items-center justify-center gap-3 w-full h-20 rounded-3xl bg-white text-error text-3xl font-bold shadow-lg active:scale-[0.98] transition-transform"
            >
              <PhoneCall className="h-8 w-8" />
              Ligar {EMERGENCIA_TELEFONE}
            </a>
          </SurfaceCard>
          <Button asChild variant="outline" size="xl" className="w-full gap-2">
            <Link to="/emergencia">
              Ver orientação de emergência <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          </Button>
        </TelaPaciente>
      );
    }

    return (
      <TelaPaciente>
        <PageHeader title="Como estou agora" />
        <BlocoEmergencia />

        <SurfaceCard
          className={cn(
            "border-0",
            resultado.desfecho === "avisar_medico" ? "bg-warning-bg" : "bg-cardio-50"
          )}
        >
          <div className="flex items-start gap-2 mb-2">
            <CheckCircle2 className={cn("h-6 w-6 shrink-0", resultado.desfecho === "avisar_medico" ? "text-warning" : "text-primary")} aria-hidden />
            <h2 className="font-display text-xl font-semibold text-foreground leading-snug">{resultado.titulo}</h2>
          </div>
          <p className="text-base text-foreground leading-relaxed">{resultado.mensagem}</p>
        </SurfaceCard>

        {resultado.espelho.length > 0 && (
          <section>
            <TituloSecao titulo="Seus números de hoje" />
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
              {resultado.espelho.map((linha) => (
                <CartaoEspelho key={linha.rotulo} linha={linha} />
              ))}
            </div>
          </section>
        )}

        <Button size="xl" variant="outline" className="w-full" onClick={recomecar}>
          Fazer nova avaliação
        </Button>

        <HistoricoCheckins itens={historico} />
      </TelaPaciente>
    );
  }

  // ── Passo 1 e 2 ───────────────────────────────────────────────────
  return (
    <TelaPaciente>
      <PageHeader title="Como estou agora" subtitle="Um retrato de hoje, não um diagnóstico" />
      <BlocoEmergencia tamanho="grande" />

      {passo === "alarme" && (
        <div>
          <TituloSecao titulo="Você está sentindo algum destes agora?" />
          <div className="space-y-2.5 mb-5">
            {SINAIS_DE_ALARME.map((sinal) => {
              const marcado = alarmes.includes(sinal.chave);
              return (
                <button
                  key={sinal.chave}
                  type="button"
                  aria-pressed={marcado}
                  onClick={() => alternarAlarme(sinal.chave)}
                  className={cn(
                    "w-full min-h-[56px] text-left rounded-2xl border p-4 flex items-start gap-3 transition-colors",
                    marcado ? "border-error bg-error-bg" : "border-border bg-card"
                  )}
                >
                  {/* O círculo marcado nunca é o único sinal: a cor do texto
                      muda junto e o `aria-pressed` diz o estado em voz alta. */}
                  {marcado ? (
                    <CheckCircle2 className="h-6 w-6 text-error shrink-0 mt-0.5" aria-hidden />
                  ) : (
                    <Circle className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  )}
                  <div className="min-w-0">
                    <p className={cn("text-base font-semibold leading-snug", marcado ? "text-error" : "text-foreground")}>
                      {sinal.pergunta}
                    </p>
                    {sinal.ajuda && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{sinal.ajuda}</p>}
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
          <TituloSecao titulo="Como você se sente agora?" subtitulo="0 = muito mal · 10 = muito bem" />
          <SurfaceCard className="mb-5">
            <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={comoSeSente === n}
                  aria-label={`${n} de 10`}
                  onClick={() => setComoSeSente(n)}
                  className={cn(
                    "h-12 rounded-xl border text-base font-bold tabular-nums transition-colors",
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

          <TituloSecao titulo="Quer contar mais alguma coisa? (opcional)" />
          <Textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: dormi mal essa noite, esqueci o remédio de manhã..."
            aria-label="Quer contar mais alguma coisa?"
            className="mb-5 min-h-[96px] rounded-xl text-base"
          />

          {/* Um azul por tela: "Ver resultado". "Voltar" é secundário. */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="xl" className="flex-1 min-w-[140px]" onClick={() => setPasso("alarme")}>
              Voltar
            </Button>
            <Button size="xl" className="flex-1 min-w-[140px]" onClick={verResultado}>
              Ver resultado
            </Button>
          </div>
        </div>
      )}

      <div className="pt-3">
        <HistoricoCheckins itens={historico} />
      </div>
    </TelaPaciente>
  );
}

function HistoricoCheckins({ itens }: { itens: WellbeingCheckin[] }) {
  return (
    <div>
      <TituloSecao titulo="Seus últimos registros" icone={HistoryIcon} />
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
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{fmtDiaHora(c.ocorrido_em)}</p>
                {c.como_se_sente != null && (
                  <p className="text-sm text-muted-foreground">Como se sentia: {c.como_se_sente}/10</p>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0",
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
