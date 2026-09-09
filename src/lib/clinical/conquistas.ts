/**
 * CONQUISTAS — reconhecimento em texto seco, sem medalha e sem mascote.
 *
 * docs/ENGAJAMENTO-CARDIO.md §5: gamificação colorida infantiliza um público
 * de 65+ e lê como desrespeito. O que funciona é o app notar o esforço e
 * dizer isso em uma linha, do jeito que um filho diria.
 *
 * Tudo aqui é derivado do dado — nada é salvo, nada precisa de tabela.
 */

import type { BloodPressureReading, MedicationIntake, ActivityReading, WeightReading } from "@/types/cardio";

export interface Conquista {
  id: string;
  texto: string;
  /** Ordem de exibição: quanto maior, mais relevante. */
  peso: number;
}

const DIA = 86_400_000;

function diaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Dias seguidos, contando a partir de hoje, em que TODAS as doses foram marcadas. */
export function sequenciaDeAdesao(intakes: MedicationIntake[], agora = new Date()): number {
  if (intakes.length === 0) return 0;
  const porDia = new Map<string, { total: number; tomadas: number }>();
  for (const i of intakes) {
    const atual = porDia.get(i.intake_date) ?? { total: 0, tomadas: 0 };
    atual.total += 1;
    if (i.taken) atual.tomadas += 1;
    porDia.set(i.intake_date, atual);
  }

  let dias = 0;
  for (let i = 0; i < 120; i++) {
    const chave = diaISO(new Date(agora.getTime() - i * DIA));
    const d = porDia.get(chave);
    if (!d || d.total === 0) {
      // Hoje ainda pode não ter registro nenhum — não quebra a sequência.
      if (i === 0) continue;
      break;
    }
    if (d.tomadas < d.total) break;
    dias++;
  }
  return dias;
}

/** Dias seguidos com pelo menos uma medida de pressão. */
export function sequenciaDeMedidas(readings: BloodPressureReading[], agora = new Date()): number {
  const dias = new Set(readings.map((r) => r.recorded_at.slice(0, 10)));
  let n = 0;
  for (let i = 0; i < 120; i++) {
    const chave = diaISO(new Date(agora.getTime() - i * DIA));
    if (dias.has(chave)) n++;
    else if (i > 0) break;
  }
  return n;
}

export interface FonteConquistas {
  intakes: MedicationIntake[];
  bloodPressure: BloodPressureReading[];
  activity: ActivityReading[];
  weight: WeightReading[];
  passosMeta: number;
  tempoNoAlvo: number | null;
  agora?: Date;
}

export function conquistasDe(f: FonteConquistas): Conquista[] {
  const agora = f.agora ?? new Date();
  const lista: Conquista[] = [];

  const adesao = sequenciaDeAdesao(f.intakes, agora);
  if (adesao >= 3) {
    lista.push({
      id: "adesao",
      texto:
        adesao >= 30
          ? `${adesao} dias seguidos sem esquecer nenhum remédio. Isso é o que mais protege o seu coração.`
          : `${adesao} dias seguidos sem esquecer nenhum remédio.`,
      peso: 100,
    });
  }

  const medidas = sequenciaDeMedidas(f.bloodPressure, agora);
  if (medidas >= 3) {
    lista.push({ id: "medidas", texto: `${medidas} dias seguidos medindo a pressão.`, peso: 80 });
  }

  const diasComMeta = f.activity
    .slice(0, 7)
    .filter((a) => (a.steps ?? 0) >= f.passosMeta).length;
  if (diasComMeta >= 3) {
    lista.push({ id: "passos", texto: `Você bateu a sua meta de passos em ${diasComMeta} dos últimos 7 dias.`, peso: 70 });
  }

  if (f.tempoNoAlvo != null && f.tempoNoAlvo >= 70) {
    lista.push({ id: "alvo", texto: `Sua pressão ficou no alvo em ${f.tempoNoAlvo}% das medidas do mês.`, peso: 90 });
  }

  const pesos = f.weight.slice(0, 30);
  if (pesos.length >= 10) {
    const variacao = Math.max(...pesos.map((p) => p.value)) - Math.min(...pesos.map((p) => p.value));
    if (variacao <= 1.5) {
      lista.push({ id: "peso-estavel", texto: "Seu peso está estável há semanas — é exatamente o que se procura.", peso: 60 });
    }
  }

  return lista.sort((a, b) => b.peso - a.peso);
}
