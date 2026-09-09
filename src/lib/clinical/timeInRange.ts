/**
 * TEMPO NO ALVO — um número de 0 a 100 que o paciente entende sem explicação
 * e que o cardiologista quer olhar. Ver docs/ENGAJAMENTO-CARDIO.md §2.2.
 *
 * Só entram medidas válidas de manguito. Estimativa de pulseira fica de fora,
 * pela mesma razão de sempre (MAPEAMENTO-CARDIO §4).
 */

import type { BloodPressureReading, CardioTargets } from "@/types/cardio";

export interface TempoNoAlvo {
  /** 0–100. null quando não há medida suficiente no período. */
  percentual: number | null;
  dentro: number;
  total: number;
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
      variacao: null,
      frase: "Ainda não há medidas de pressão suficientes neste período para calcular.",
    };
  }

  const dentro = atual.filter((r) => noAlvo(r, targets)).length;
  const percentual = Math.round((dentro / atual.length) * 100);

  let variacao: number | null = null;
  if (anterior.length >= 3) {
    const pctAnterior = Math.round((anterior.filter((r) => noAlvo(r, targets)).length / anterior.length) * 100);
    variacao = percentual - pctAnterior;
  }

  return { percentual, dentro, total: atual.length, variacao, frase: frasear(percentual, variacao, atual.length) };
}

function frasear(pct: number, variacao: number | null, n: number): string {
  const base =
    pct >= 80
      ? `${pct}% das suas ${n} medidas ficaram dentro do alvo.`
      : pct >= 50
      ? `${pct}% das suas ${n} medidas ficaram dentro do alvo.`
      : `${pct}% das suas ${n} medidas ficaram dentro do alvo — a maior parte ficou acima.`;

  if (variacao == null) return base;
  if (variacao >= 5) return `${base} Subiu ${variacao} pontos em relação ao mês anterior.`;
  if (variacao <= -5) return `${base} Caiu ${Math.abs(variacao)} pontos em relação ao mês anterior.`;
  return `${base} Praticamente igual ao mês anterior.`;
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
  const dentroDoAlvo = nova.systolic <= targets.bp_systolic_max && nova.diastolic <= targets.bp_diastolic_max;
  const semana = janela(readings, agora.getTime(), 7);
  const acimaNaSemana = semana.filter((r) => !noAlvo(r, targets)).length;
  const mes = calcularTempoNoAlvo(readings, targets, 30, agora);

  if (dentroDoAlvo) {
    if (mes.percentual != null && mes.percentual >= 70) {
      return `Dentro do seu alvo. No último mês você ficou no alvo em ${mes.percentual}% das medidas.`;
    }
    return "Dentro do seu alvo. Continue medindo nos mesmos horários — é isso que dá valor ao número.";
  }

  const vezes = acimaNaSemana + 1;
  if (vezes >= 3) {
    return `Acima do seu alvo de ${targets.bp_systolic_max}/${targets.bp_diastolic_max}. É a ${vezes}ª medida acima nesta semana — seu médico consegue ver isso.`;
  }
  return `Acima do seu alvo de ${targets.bp_systolic_max}/${targets.bp_diastolic_max}. Uma medida isolada acontece; o que conta é o conjunto da semana.`;
}
