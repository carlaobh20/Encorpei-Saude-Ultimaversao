/**
 * "Seu cuidado de hoje" — o único bloco azul da tela inicial.
 *
 * ── Por que ele é um só, e por que é este ─────────────────────────────
 * O azul cheio é o recurso visual mais caro da página: quem olha de longe vê
 * primeiro a mancha de cor e só depois o texto. Gastá-lo em duas coisas é o
 * mesmo que não gastar em nenhuma. Então ele carrega exatamente a pergunta
 * que o paciente veio responder — "o que eu preciso fazer agora" — e nada
 * mais (ver `CartaoDestaque` em shell/Primitivos).
 *
 * ── A duplicação que NÃO repetimos ────────────────────────────────────
 * A referência de design coloca a tarefa prioritária numa linha clicável E
 * repete a mesma ação num botão grande logo abaixo. São dois alvos para o
 * mesmo destino: o paciente hesita ("são coisas diferentes?"), o leitor de
 * tela anuncia a ação duas vezes, e o segundo botão rouba a hierarquia do
 * primeiro. Aqui a linha inteira É o botão, e o retângulo à direita é a
 * affordance visual dele — um `<span>`, não um segundo controle (botão
 * dentro de botão, além de tudo, é HTML inválido).
 *
 * Nada aqui decide conduta: o QUE é cobrado vem de `usePendenciasDeHoje()`,
 * e a origem do plano (médico ou sugestão do app) é dita em letra visível —
 * atribuir ao cardiologista um plano que ele não escreveu é o tipo de mentira
 * pequena que destrói a confiança no resto da tela.
 */

import {
  CheckCircle2, ChevronRight, CalendarCheck, Gauge, Scale, HeartPulse,
  Activity, Droplet, Pill, Stethoscope, Footprints, Salad, Moon, Smile,
  type LucideIcon,
} from "lucide-react";
import { CartaoDestaque, BarraProgresso } from "@/components/shell";
import {
  ROTULO_METRICA, type MetricaPlano, type Pendencia,
} from "@/hooks/usePlanoMonitoramento";

/** Só ícone — nenhum juízo clínico mora neste mapa. */
const ICONE_DA_METRICA: Record<MetricaPlano, LucideIcon> = {
  bp: Gauge,
  weight: Scale,
  hr: HeartPulse,
  spo2: Activity,
  glucose: Droplet,
  steps: Footprints,
  sleep: Moon,
  symptoms: Stethoscope,
  medication: Pill,
  sodium: Salad,
  wellbeing: Smile,
  walk: Footprints,
};

export interface CuidadoDeHojeProps {
  /** Verdadeiro quando o plano veio do médico; falso quando é sugestão do app. */
  prescrito: boolean;
  total: number;
  concluidasCount: number;
  prioritaria: Pendencia | null;
  demaisAbertas: Pendencia[];
  concluidas: Pendencia[];
  /** Rótulo do botão da tarefa prioritária ("Medir a pressão"). */
  rotuloAcao: string;
  onResolver: (metric: MetricaPlano) => void;
}

export function CuidadoDeHoje({
  prescrito, total, concluidasCount, prioritaria, demaisAbertas, concluidas,
  rotuloAcao, onResolver,
}: CuidadoDeHojeProps) {
  const origem = prescrito
    ? "Plano definido pelo seu cardiologista"
    : "Sugestão do app — seu médico ainda não definiu um plano";

  const Icone = prioritaria ? ICONE_DA_METRICA[prioritaria.metric] : CalendarCheck;

  return (
    <CartaoDestaque>
      <h2 className="font-display text-xl md:text-2xl font-semibold leading-tight">
        Seu cuidado de hoje
      </h2>
      {/* A origem do plano fica logo abaixo do título, no mesmo bloco: se
          descesse para o rodapé, seria lida depois da ação — tarde demais
          para mudar o entendimento de quem pediu aquilo. */}
      <p className="text-base text-white/85 mt-1 leading-relaxed">{origem}</p>

      {/* Progresso só existe quando há combinado. Com total 0 a barra seria
          uma régua vazia sugerindo dever que ninguém marcou. */}
      {total > 0 && (
        <div className="mt-4">
          <BarraProgresso feitos={concluidasCount} total={total} />
          <p className="text-base text-white/90 mt-2">
            {concluidasCount} de {total} cuidados concluídos
          </p>
        </div>
      )}

      {prioritaria ? (
        <>
          {/* UM alvo clicável: ícone à esquerda, o que fazer no meio, a
              affordance de ação à direita. 64px de altura mínima cobre o
              alvo de toque com folga mesmo no iPhone SE. */}
          <button
            type="button"
            onClick={() => onResolver(prioritaria.metric)}
            className="mt-4 w-full min-h-[64px] rounded-2xl bg-white text-foreground
                       px-4 py-3 flex items-center gap-3 text-left shadow-sm
                       transition-shadow hover:shadow-md"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <Icone className="h-6 w-6" strokeWidth={1.75} aria-hidden />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug">
                {ROTULO_METRICA[prioritaria.metric]}
                {prioritaria.esperados > 1
                  ? ` — ${prioritaria.feitos} de ${prioritaria.esperados} hoje`
                  : ""}
              </span>
              {prioritaria.instrucao && (
                <span className="block text-sm text-muted-foreground mt-0.5 leading-relaxed">
                  {prioritaria.instrucao}
                </span>
              )}
            </span>

            {/* Parece botão, não é botão: quem clica em qualquer ponto da
                linha cai no mesmo lugar. No celular só a seta sobrevive —
                o rótulo inteiro estouraria a largura em 360px. */}
            <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-base font-semibold text-primary-foreground">
              {rotuloAcao}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-primary sm:hidden" aria-hidden />
          </button>

          {/* O resto do combinado continua visível — esconder viraria a lista
              paralela que a auditoria matou —, mas em peso menor: uma coisa
              de cada vez, e as outras ao alcance. */}
          {demaisAbertas.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-white/80 mb-2">Também combinado para hoje</p>
              <ul className="flex flex-wrap gap-2">
                {demaisAbertas.map((p) => (
                  <li key={p.metric}>
                    <button
                      type="button"
                      onClick={() => onResolver(p.metric)}
                      className="min-h-[44px] rounded-full bg-white/15 px-4 py-2 text-base font-medium
                                 text-white transition-colors hover:bg-white/25"
                    >
                      {ROTULO_METRICA[p.metric]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        /* Dois estados finais diferentes, e a diferença importa: "não falta
           nada" é conquista; "nada foi combinado" é ausência de plano. */
        <div className="mt-4 rounded-2xl bg-white/15 px-4 py-4 flex items-start gap-3">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-white" aria-hidden />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-snug">
              {total > 0 ? "Tudo registrado por hoje." : "Nada combinado para hoje."}
            </p>
            <p className="text-base text-white/85 mt-1 leading-relaxed">
              {total > 0
                ? "Até amanhã — seu médico consegue ver o que você registrou."
                : "Quando houver algo a registrar, ele aparece aqui."}
            </p>
          </div>
        </div>
      )}

      {/* Os concluídos viram marcador, não linha de lista: já não pedem ação,
          e o único papel deles é mostrar que o esforço do dia ficou registrado. */}
      {concluidas.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {concluidas.map((p) => (
            <li key={p.metric} className="flex items-center gap-1.5 text-base text-white/85">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-white" aria-hidden />
              <span>{ROTULO_METRICA[p.metric]}</span>
            </li>
          ))}
        </ul>
      )}
    </CartaoDestaque>
  );
}
