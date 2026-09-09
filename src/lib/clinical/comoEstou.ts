/**
 * ══════════════════════════════════════════════════════════════════════
 * "COMO ESTOU AGORA" — o botão contra o medo
 * ══════════════════════════════════════════════════════════════════════
 *
 * docs/ENGAJAMENTO-CARDIO.md §3.2
 *
 * A necessidade emocional número um do paciente cardíaco é tranquilização —
 * e hoje ela é atendida pelo Google às três da manhã, o que é péssimo. Este
 * módulo assume esse papel dentro de limites rígidos.
 *
 * O QUE ELE FAZ
 *  1. Triagem de sinais de alarme → rota de emergência, sem rodeio.
 *  2. Espelho: mostra os NÚMEROS DO PRÓPRIO PACIENTE de hoje comparados ao
 *     padrão dele — não a uma tabela de população.
 *  3. Registra tudo para o médico ver.
 *
 * O QUE ELE NUNCA FAZ
 *  - Nunca diz "você está bem", "não é nada", "pode ficar tranquilo".
 *    Um sintoma cardíaco tranquilizado por software é exatamente o caso em
 *    que alguém morre em casa. O app descreve; quem conclui é o médico.
 *  - Nunca dá conduta ("tome", "aumente", "espere", "não precisa ir").
 *  - Nunca conclui diagnóstico.
 *
 * Se este arquivo for editado, releia MAPEAMENTO-CARDIO.md §6 antes.
 */

import type {
  BloodPressureReading, CardioTargets, HeartRateReading, SleepReading,
  Spo2Reading, WeightReading,
} from "@/types/cardio";
import { mediaMrpa } from "./cardioRiskEngine";

// ── Sinais de alarme ─────────────────────────────────────────────────

export interface SinalDeAlarme {
  chave: string;
  pergunta: string;
  /** Detalhe que ajuda o paciente a reconhecer. */
  ajuda?: string;
}

/**
 * A lista que leva direto ao 192. Escrita como o paciente sente, não como o
 * livro descreve — "aperto que não passa" funciona; "angina em repouso" não.
 */
export const SINAIS_DE_ALARME: SinalDeAlarme[] = [
  {
    chave: "dor_peito",
    pergunta: "Dor, aperto ou peso no peito agora",
    ajuda: "Pode subir para o braço, o pescoço, o queixo ou as costas.",
  },
  {
    chave: "falta_ar_subita",
    pergunta: "Falta de ar que começou de repente ou que não passa em repouso",
  },
  {
    chave: "desmaio",
    pergunta: "Desmaiou, ou sentiu que ia desmaiar agora",
  },
  {
    chave: "sinais_avc",
    pergunta: "Boca torta, fala enrolada, ou fraqueza em um lado do corpo",
    ajuda: "Mesmo que tenha passado rápido.",
  },
  {
    chave: "suor_frio",
    pergunta: "Suor frio junto com enjoo ou mal-estar forte",
  },
  {
    chave: "palpitacao_com_sintoma",
    pergunta: "Coração disparado ou descompassado junto com tontura ou falta de ar",
  },
];

export interface RespostaTriagem {
  /** Chaves de SINAIS_DE_ALARME marcadas pelo paciente. */
  alarmes: string[];
  /** Como ele se sente, 0 = muito mal, 10 = muito bem. */
  comoSeSente?: number | null;
  observacao?: string | null;
}

export type DesfechoTriagem = "emergencia" | "avisar_medico" | "registrar";

export interface ResultadoComoEstou {
  desfecho: DesfechoTriagem;
  /** Título curto da tela de resposta. */
  titulo: string;
  /** Corpo. Descritivo. Nunca veredito, nunca conduta. */
  mensagem: string;
  /** Leituras do próprio paciente, para o espelho. */
  espelho: LinhaEspelho[];
  /** Sinais que dispararam a emergência, para registrar. */
  alarmesMarcados: SinalDeAlarme[];
}

export interface LinhaEspelho {
  rotulo: string;
  valor: string;
  /** Comparação com o padrão do próprio paciente. */
  contexto: string;
  tom: "neutro" | "atencao";
  /** Quando o dado é estimativa de sensor (pulseira), a tela precisa marcar. */
  estimativa?: boolean;
}

export interface ContextoDoPaciente {
  targets: CardioTargets;
  bloodPressure: BloodPressureReading[];
  heartRate: HeartRateReading[];
  weight: WeightReading[];
  spo2: Spo2Reading[];
  sleep: SleepReading[];
  agora?: Date;
}

const DIA = 86_400_000;

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

function dentroDe(iso: string, agora: Date, dias: number): boolean {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && agora.getTime() - t <= dias * DIA;
}

/**
 * Monta o espelho: cada linha compara um número de HOJE com o padrão das
 * últimas semanas DESTE paciente. É o que transforma "138/86" em informação.
 */
export function montarEspelho(ctx: ContextoDoPaciente): LinhaEspelho[] {
  const agora = ctx.agora ?? new Date();
  const linhas: LinhaEspelho[] = [];

  // Pressão — só manguito validado (MAPEAMENTO §4).
  const paValidas = ctx.bloodPressure.filter((r) => r.cuff_validated && r.validation_status === "validated");
  const ultimaPa = paValidas[0];
  if (ultimaPa && dentroDe(ultimaPa.recorded_at, agora, 2)) {
    const ref = mediaMrpa(paValidas, agora, 30);
    const acimaDoAlvo =
      ultimaPa.systolic > ctx.targets.bp_systolic_max || ultimaPa.diastolic > ctx.targets.bp_diastolic_max;
    linhas.push({
      rotulo: "Sua pressão",
      valor: `${ultimaPa.systolic}/${ultimaPa.diastolic}`,
      contexto: ref
        ? `Sua média das últimas semanas é ${ref.systolic}/${ref.diastolic}. Seu alvo é ${ctx.targets.bp_systolic_max}/${ctx.targets.bp_diastolic_max}.`
        : `Seu alvo é ${ctx.targets.bp_systolic_max}/${ctx.targets.bp_diastolic_max}.`,
      tom: acimaDoAlvo ? "atencao" : "neutro",
    });
  }

  // Batimentos de repouso.
  const repouso = ctx.heartRate.filter((r) => r.context === "resting");
  const ultimaFc = repouso[0];
  if (ultimaFc && dentroDe(ultimaFc.recorded_at, agora, 2)) {
    const habitual = media(
      repouso.filter((r) => dentroDe(r.recorded_at, agora, 30)).map((r) => r.bpm)
    );
    const fora = ultimaFc.bpm > ctx.targets.resting_hr_max || ultimaFc.bpm < ctx.targets.resting_hr_min;
    linhas.push({
      rotulo: "Seus batimentos em repouso",
      valor: `${ultimaFc.bpm} bpm`,
      contexto: habitual
        ? `O seu normal costuma ser perto de ${Math.round(habitual)} bpm.`
        : "Ainda estamos aprendendo qual é o seu normal.",
      tom: fora ? "atencao" : "neutro",
      estimativa: ultimaFc.source_type === "device" && ultimaFc.validation_status === "estimated",
    });
  }

  // Peso — relevante sobretudo em insuficiência cardíaca.
  const pesos = ctx.weight.filter((r) => dentroDe(r.recorded_at, agora, 10));
  if (pesos.length >= 2) {
    const atual = pesos[0];
    const antigo = pesos[pesos.length - 1];
    const delta = +(atual.value - antigo.value).toFixed(1);
    linhas.push({
      rotulo: "Seu peso",
      valor: `${atual.value} kg`,
      contexto:
        delta === 0
          ? "Estável nos últimos dias."
          : delta > 0
          ? `Subiu ${delta} kg nos últimos dias.`
          : `Caiu ${Math.abs(delta)} kg nos últimos dias.`,
      tom: delta >= 1.5 ? "atencao" : "neutro",
    });
  }

  // Oxigenação.
  const ultimaSpo2 = ctx.spo2[0];
  if (ultimaSpo2 && dentroDe(ultimaSpo2.recorded_at, agora, 2)) {
    linhas.push({
      rotulo: "Sua oxigenação",
      valor: `${ultimaSpo2.value}%`,
      contexto: ultimaSpo2.value >= 94 ? "Dentro da faixa habitual." : "Abaixo do que costuma ser o seu normal.",
      tom: ultimaSpo2.value < 92 ? "atencao" : "neutro",
      estimativa: ultimaSpo2.source_type === "device",
    });
  }

  // Sono — entra porque noite ruim explica muita sensação estranha de manhã.
  const ultimoSono = ctx.sleep[0];
  if (ultimoSono && dentroDe(ultimoSono.recorded_at, agora, 2)) {
    const h = Math.floor(ultimoSono.total_minutes / 60);
    const m = ultimoSono.total_minutes % 60;
    const habitual = media(ctx.sleep.slice(0, 14).map((s) => s.total_minutes));
    linhas.push({
      rotulo: "Seu sono da última noite",
      valor: `${h}h${m.toString().padStart(2, "0")}`,
      contexto: habitual
        ? `Sua média costuma ser ${Math.floor(habitual / 60)}h${Math.round(habitual % 60).toString().padStart(2, "0")}.`
        : "Ainda estamos aprendendo o seu padrão de sono.",
      tom: "neutro",
      estimativa: true,
    });
  }

  return linhas;
}

/**
 * O motor. Recebe a triagem e o contexto; devolve desfecho + texto.
 *
 * A ordem importa: alarme vence tudo. Nenhum número "compensa" um sinal de
 * alarme — pressão normal com dor no peito continua sendo emergência.
 */
export function avaliarComoEstou(resposta: RespostaTriagem, ctx: ContextoDoPaciente): ResultadoComoEstou {
  const alarmesMarcados = SINAIS_DE_ALARME.filter((s) => resposta.alarmes.includes(s.chave));
  const espelho = montarEspelho(ctx);

  if (alarmesMarcados.length > 0) {
    return {
      desfecho: "emergencia",
      titulo: "Isso precisa de atendimento agora",
      mensagem:
        "O que você marcou é um sinal que precisa ser avaliado por um profissional agora, não pelo aplicativo. Ligue 192 ou vá ao pronto-socorro mais próximo. Não dirija — peça para alguém levar você ou chame o socorro.",
      espelho,
      alarmesMarcados,
    };
  }

  const temAtencao = espelho.some((l) => l.tom === "atencao");
  const seSenteMal = (resposta.comoSeSente ?? 10) <= 4;

  if (temAtencao || seSenteMal) {
    return {
      desfecho: "avisar_medico",
      titulo: "Registrei, e seu médico vai ver",
      mensagem:
        "Você não marcou nenhum sinal de emergência. Alguns dos seus números de hoje estão diferentes do seu padrão — eles estão logo abaixo, e ficam disponíveis para o seu cardiologista. Se algo piorar, ou se aparecer dor no peito, falta de ar forte ou tontura, procure atendimento.",
      espelho,
      alarmesMarcados: [],
    };
  }

  return {
    desfecho: "registrar",
    titulo: "Registrei como você está",
    mensagem:
      "Você não marcou nenhum sinal de emergência, e os seus números de hoje estão parecidos com o seu padrão das últimas semanas. Isso não é um diagnóstico — é o seu retrato de hoje, e ele fica guardado para o seu médico. Se algo mudar, volte aqui e registre de novo.",
    espelho,
    alarmesMarcados: [],
  };
}
