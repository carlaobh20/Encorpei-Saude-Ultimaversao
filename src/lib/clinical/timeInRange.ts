/**
 * MEDIDAS DE PRESSÃO DENTRO DA META — um número de 0 a 100 que o paciente
 * entende sem explicação e que o cardiologista quer olhar.
 * Ver docs/ENGAJAMENTO-CARDIO.md §2.2.
 *
 * ── Por que o nome mudou (auditoria de setembro/2026) ─────────────────
 * A métrica se chamava "Tempo no Alvo", emprestado do "time in range" da
 * glicemia contínua — onde o sensor mede o tempo TODO e a conta é
 * literalmente tempo. Aqui não: contamos AMOSTRAS. Se o paciente mediu duas
 * vezes no mês e as duas deram dentro da meta, o número dá 100% — e "100% do
 * tempo no alvo" seria uma afirmação falsa sobre 30 dias de pressão que
 * ninguém observou. O nome novo diz exatamente o que a conta faz:
 * **"Medidas de pressão dentro da meta"** (curto: "Medidas na meta").
 *
 * Os NOMES DE FUNÇÃO continuam `calcularTempoNoAlvo` / `serieTempoNoAlvo`
 * porque arquivos fora do escopo desta auditoria os importam (telas do
 * médico, Meu Mês). Renomear identificador é dívida de refactor; renomear
 * o que o paciente lê é correção de honestidade — e essa vem primeiro.
 *
 * Só entram medidas válidas de manguito. Estimativa de pulseira fica de fora,
 * pela mesma razão de sempre (MAPEAMENTO-CARDIO §4).
 */

import type { BloodPressureReading, CardioTargets } from "@/types/cardio";

/** Rótulo oficial da métrica na interface. Use sempre estes dois. */
export const ROTULO_MEDIDAS_NA_META = "Medidas de pressão dentro da meta";
export const ROTULO_MEDIDAS_NA_META_CURTO = "Medidas na meta";

/**
 * Abaixo deste número de medidas o percentual não significa nada e não pode
 * ser mostrado como se significasse.
 *
 * Escolhemos 5 porque: (a) com 1 a 4 medidas o percentual só assume valores
 * grosseiros (100%, 75%, 50%…) e uma única medida ruim derruba o número em
 * 20 pontos ou mais, o que produz susto sem informação; (b) 5 é alcançável
 * em menos de uma semana no plano mínimo do app (pressão 2×/dia), então o
 * estado "medidas insuficientes" é um convite curto a medir, e não uma
 * parede; (c) protocolo de MRPA trabalha com séries de vários dias — abaixo
 * disso nem o médico usaria o número para decidir nada.
 *
 * Não é limiar clínico: é limiar de exibição. Quem decide conduta é o médico.
 */
export const MINIMO_DE_MEDIDAS = 5;

export interface TempoNoAlvo {
  /** 0–100. null quando não há nenhuma medida no período. */
  percentual: number | null;
  /** Quantas medidas ficaram dentro da meta. */
  dentro: number;
  /** Total de medidas elegíveis no período — o "n=" que sempre acompanha o %. */
  total: number;
  /** Tamanho do período em dias, para a interface dizer de quando é o número. */
  dias: number;
  /**
   * `false` quando `total < MINIMO_DE_MEDIDAS`. A interface é obrigada a
   * mostrar o estado "medidas insuficientes" em vez do percentual grande.
   */
  suficiente: boolean;
  /** Variação em pontos percentuais contra o período anterior. */
  variacao: number | null;
  /** Frase pronta para a tela do paciente. Descritiva, nunca conduta. */
  frase: string;
}

const DIA = 86_400_000;

function noAlvo(r: BloodPressureReading, t: CardioTargets): boolean {
  return r.systolic <= t.bp_systolic_max && r.diastolic <= t.bp_diastolic_max;
}

function elegivel(r: BloodPressureReading): boolean {
  return r.cuff_validated && r.validation_status === "validated";
}

function janela(readings: BloodPressureReading[], fim: number, dias: number) {
  const ini = fim - dias * DIA;
  return readings.filter((r) => {
    const t = new Date(r.recorded_at).getTime();
    return elegivel(r) && t > ini && t <= fim;
  });
}

/** Texto do período, para a frase e para o rodapé do cartão. */
export function rotuloPeriodo(dias: number): string {
  if (dias <= 7) return "nos últimos 7 dias";
  if (dias <= 15) return "nos últimos 15 dias";
  if (dias <= 31) return "nos últimos 30 dias";
  return `nos últimos ${dias} dias`;
}

export function calcularTempoNoAlvo(
  readings: BloodPressureReading[],
  targets: CardioTargets,
  dias = 30,
  agora = new Date()
): TempoNoAlvo {
  const fim = agora.getTime();
  const atual = janela(readings, fim, dias);
  const anterior = janela(readings, fim - dias * DIA, dias);

  if (atual.length === 0) {
    return {
      percentual: null,
      dentro: 0,
      total: 0,
      dias,
      suficiente: false,
      variacao: null,
      frase: `Nenhuma medida de pressão com aparelho de braço ${rotuloPeriodo(dias)}. Com ${MINIMO_DE_MEDIDAS} medidas já dá para mostrar o seu percentual.`,
    };
  }

  const dentro = atual.filter((r) => noAlvo(r, targets)).length;
  const percentual = Math.round((dentro / atual.length) * 100);
  const suficiente = atual.length >= MINIMO_DE_MEDIDAS;

  // A comparação com o período anterior só aparece quando os DOIS lados têm
  // medida suficiente — senão a "variação" seria ruído virando notícia.
  let variacao: number | null = null;
  if (suficiente && anterior.length >= MINIMO_DE_MEDIDAS) {
    const pctAnterior = Math.round((anterior.filter((r) => noAlvo(r, targets)).length / anterior.length) * 100);
    variacao = percentual - pctAnterior;
  }

  return {
    percentual,
    dentro,
    total: atual.length,
    dias,
    suficiente,
    variacao,
    frase: frasear(percentual, dentro, variacao, atual.length, dias, suficiente),
  };
}

function frasear(
  pct: number,
  dentro: number,
  variacao: number | null,
  n: number,
  dias: number,
  suficiente: boolean
): string {
  const periodo = rotuloPeriodo(dias);

  // Estado explícito de amostra pequena: mostramos a contagem crua, sem
  // percentual, porque com poucas medidas o percentual engana nos dois
  // sentidos — assusta quem teve um dia ruim e tranquiliza quem mediu só
  // no melhor horário.
  if (!suficiente) {
    return `Você tem ${n} medida${n > 1 ? "s" : ""} ${periodo} — ${dentro} dentro da meta. São poucas para dizer como está o conjunto; a partir de ${MINIMO_DE_MEDIDAS} medidas o app mostra o seu percentual.`;
  }

  const base =
    pct >= 50
      ? `${pct}% das suas ${n} medidas ${periodo} ficaram dentro da meta.`
      : `${pct}% das suas ${n} medidas ${periodo} ficaram dentro da meta — a maior parte ficou acima.`;

  if (variacao == null) return base;
  if (variacao >= 5) return `${base} São ${variacao} pontos a mais que no período anterior.`;
  if (variacao <= -5) return `${base} São ${Math.abs(variacao)} pontos a menos que no período anterior.`;
  return `${base} Praticamente igual ao período anterior.`;
}

/** Série semanal, para o gráfico de evolução. */
export function serieTempoNoAlvo(
  readings: BloodPressureReading[],
  targets: CardioTargets,
  semanas = 12,
  agora = new Date()
): { semana: string; percentual: number | null; total: number }[] {
  const out: { semana: string; percentual: number | null; total: number }[] = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const fim = agora.getTime() - i * 7 * DIA;
    const doPeriodo = janela(readings, fim, 7);
    const total = doPeriodo.length;
    const percentual = total > 0 ? Math.round((doPeriodo.filter((r) => noAlvo(r, targets)).length / total) * 100) : null;
    out.push({ semana: new Date(fim).toISOString().slice(0, 10), percentual, total });
  }
  return out;
}

/**
 * Resposta imediata a uma medida recém-registrada — a regra da reciprocidade
 * (docs/ENGAJAMENTO-CARDIO.md §3.1): toda medida devolve uma frase que só faz
 * sentido para aquele paciente.
 */
export function responderMedida(
  nova: { systolic: number; diastolic: number },
  readings: BloodPressureReading[],
  targets: CardioTargets,
  agora = new Date()
): string {
  const dentroDaMeta = nova.systolic <= targets.bp_systolic_max && nova.diastolic <= targets.bp_diastolic_max;
  const semana = janela(readings, agora.getTime(), 7);
  const acimaNaSemana = semana.filter((r) => !noAlvo(r, targets)).length;
  const mes = calcularTempoNoAlvo(readings, targets, 30, agora);

  if (dentroDaMeta) {
    // Só cita o percentual quando ele tem lastro — mesma regra do cartão.
    if (mes.suficiente && mes.percentual != null && mes.percentual >= 70) {
      return `Dentro da sua meta. No último mês, ${mes.percentual}% das suas ${mes.total} medidas ficaram dentro da meta.`;
    }
    return "Dentro da sua meta. Continue medindo nos mesmos horários — é isso que dá valor ao número.";
  }

  const vezes = acimaNaSemana + 1;
  if (vezes >= 3) {
    return `Acima da sua meta de ${targets.bp_systolic_max}/${targets.bp_diastolic_max}. É a ${vezes}ª medida acima nesta semana — seu médico consegue ver isso.`;
  }
  return `Acima da sua meta de ${targets.bp_systolic_max}/${targets.bp_diastolic_max}. Uma medida isolada acontece; o que conta é o conjunto da semana.`;
}
