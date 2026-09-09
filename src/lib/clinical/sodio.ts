/**
 * SÓDIO — uma pergunta por refeição, não uma tabela nutricional.
 *
 * docs/ENGAJAMENTO-CARDIO.md §5: diário alimentar com contagem de calorias
 * tem abandono altíssimo e não é o que muda desfecho cardiovascular. Sódio,
 * sim — sobretudo em hipertensão e insuficiência cardíaca.
 *
 * O paciente escolhe o que mais se parece com o que comeu. O app estima. É
 * grosseiro de propósito: exatidão aqui não muda conduta, tendência muda.
 */

export interface OpcaoRefeicao {
  chave: string;
  rotulo: string;
  exemplo: string;
  /** mg de sódio estimados. */
  sodioMg: number;
}

export const OPCOES_REFEICAO: OpcaoRefeicao[] = [
  {
    chave: "caseira_sem_sal",
    rotulo: "Comida de casa, com pouco sal",
    exemplo: "arroz, feijão, carne ou frango, salada — temperada com alho, cebola e ervas",
    sodioMg: 400,
  },
  {
    chave: "caseira_normal",
    rotulo: "Comida de casa, sal normal",
    exemplo: "o mesmo prato, com o sal de sempre e um caldo ou tempero pronto",
    sodioMg: 900,
  },
  {
    chave: "restaurante",
    rotulo: "Restaurante ou marmita",
    exemplo: "self-service, prato feito, refeição do trabalho",
    sodioMg: 1400,
  },
  {
    chave: "embutidos",
    rotulo: "Pão com frios, queijo ou embutido",
    exemplo: "sanduíche, pão com presunto e queijo, salsicha, linguiça",
    sodioMg: 1200,
  },
  {
    chave: "industrializado",
    rotulo: "Congelado, enlatado ou macarrão instantâneo",
    exemplo: "lasanha congelada, sopa de pacote, atum em lata, miojo",
    sodioMg: 1600,
  },
  {
    chave: "fastfood",
    rotulo: "Lanche de rua ou fast-food",
    exemplo: "hambúrguer, pastel, pizza, salgado de padaria",
    sodioMg: 1800,
  },
  {
    chave: "leve",
    rotulo: "Fruta, café, lanche leve",
    exemplo: "fruta, iogurte, café com leite, torrada sem sal",
    sodioMg: 120,
  },
];

export const REFEICOES = [
  { chave: "cafe", rotulo: "Café da manhã" },
  { chave: "almoco", rotulo: "Almoço" },
  { chave: "lanche", rotulo: "Lanche" },
  { chave: "jantar", rotulo: "Jantar" },
] as const;

export type ChaveRefeicao = (typeof REFEICOES)[number]["chave"];

export interface RegistroSodio {
  id: string;
  patient_user_id: string;
  dia: string;
  refeicao: ChaveRefeicao;
  opcao: string;
  sodio_mg: number;
  created_at: string;
}

/** Referência mais usada: cerca de 2.000 mg de sódio ao dia (5 g de sal). */
export const SODIO_ALVO_PADRAO = 2000;

export function totalDoDia(registros: RegistroSodio[], dia: string): number {
  return registros.filter((r) => r.dia === dia).reduce((s, r) => s + r.sodio_mg, 0);
}

export interface LeituraSodio {
  total: number;
  alvo: number;
  percentual: number;
  /** Descritiva, sem prescrever dieta. */
  frase: string;
  tom: "bom" | "atencao";
}

export function lerSodioDoDia(total: number, alvo = SODIO_ALVO_PADRAO): LeituraSodio {
  const percentual = Math.round((total / alvo) * 100);
  if (total === 0) {
    return { total, alvo, percentual: 0, frase: "Nenhuma refeição registrada hoje.", tom: "bom" };
  }
  if (total <= alvo) {
    return {
      total, alvo, percentual,
      frase: `Cerca de ${total} mg de sódio hoje — dentro da referência de ${alvo} mg.`,
      tom: "bom",
    };
  }
  return {
    total, alvo, percentual,
    frase: `Cerca de ${total} mg de sódio hoje, acima da referência de ${alvo} mg. A maior parte costuma vir de industrializados, não do saleiro.`,
    tom: "atencao",
  };
}

/** Média dos últimos N dias — é a tendência que interessa, não o dia isolado. */
export function mediaSemanal(registros: RegistroSodio[], dias = 7, agora = new Date()): number | null {
  const porDia = new Map<string, number>();
  for (let i = 0; i < dias; i++) {
    const dia = new Date(agora.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const total = totalDoDia(registros, dia);
    if (total > 0) porDia.set(dia, total);
  }
  if (porDia.size === 0) return null;
  return Math.round([...porDia.values()].reduce((a, b) => a + b, 0) / porDia.size);
}
