/**
 * CAPACIDADE FUNCIONAL — o terceiro número da espinha do app.
 * docs/ENGAJAMENTO-CARDIO.md §2.3
 *
 * Três testes que cabem na casa do paciente e que, repetidos, viram curva:
 *  1. Caminhada de 6 minutos (6MWT) — o clássico. Em casa é ESTIMATIVA:
 *     depende de percurso e de contagem de passos, não substitui o teste
 *     feito no corredor do consultório. A tela precisa dizer isso.
 *  2. Sentar-e-levantar em 30 segundos — não precisa de espaço nem de
 *     percurso; excelente para quem mora em apartamento.
 *  3. Recuperação da frequência cardíaca em 1 minuto — [Certo] queda menor
 *     que 12 bpm no primeiro minuto após o esforço é marcador prognóstico
 *     desfavorável. É a medida que a pulseira faz melhor que qualquer coisa.
 *
 * Nada aqui prescreve treino. A faixa de esforço da caminhada guiada vem do
 * médico (ver `zonaDeTreino`).
 */

export type TipoTeste = "walk_6min" | "sit_to_stand_30s" | "hr_recovery";

export interface TesteCapacidade {
  id: string;
  patient_user_id: string;
  tipo: TipoTeste;
  realizado_em: string;
  /** metros (6MWT) · repetições (sentar-levantar) · bpm de queda (recuperação) */
  valor: number;
  /** Esforço percebido ao fim (Borg modificada 0–10). */
  borg?: number | null;
  fc_pico?: number | null;
  fc_final?: number | null;
  interrompido?: boolean | null;
  motivo_interrupcao?: string | null;
  observacao?: string | null;
  created_at: string;
}

// ── Referências ──────────────────────────────────────────────────────

/**
 * Distância prevista no 6MWT em adultos saudáveis (Enright & Sherrill).
 * Serve de referência de contexto, não de meta clínica.
 */
export function distanciaPrevista6min(sexo: "male" | "female", idade: number, alturaCm: number, pesoKg: number): number | null {
  if (!idade || !alturaCm || !pesoKg) return null;
  const d =
    sexo === "male"
      ? 7.57 * alturaCm - 5.02 * idade - 1.76 * pesoKg - 309
      : 2.11 * alturaCm - 5.78 * idade - 2.29 * pesoKg + 667;
  return Math.max(0, Math.round(d));
}

/** Referência de repetições em 30 s de sentar-e-levantar, por faixa etária. */
export function referenciaSentarLevantar(sexo: "male" | "female", idade: number): { min: number; max: number } | null {
  const tabela: { ate: number; m: [number, number]; f: [number, number] }[] = [
    { ate: 64, m: [14, 19], f: [12, 17] },
    { ate: 69, m: [12, 18], f: [11, 16] },
    { ate: 74, m: [12, 17], f: [10, 15] },
    { ate: 79, m: [11, 17], f: [10, 15] },
    { ate: 84, m: [10, 15], f: [9, 14] },
    { ate: 200, m: [8, 14], f: [8, 13] },
  ];
  const linha = tabela.find((l) => idade <= l.ate);
  if (!linha) return null;
  const [min, max] = sexo === "male" ? linha.m : linha.f;
  return { min, max };
}

/** Interpretação da recuperação da FC no 1º minuto. Descritiva, sem conduta. */
export function lerRecuperacaoFc(quedaBpm: number): { rotulo: string; tom: "bom" | "atencao"; texto: string } {
  if (quedaBpm >= 12) {
    return {
      rotulo: "Recuperação esperada",
      tom: "bom",
      texto: `Seu coração desacelerou ${quedaBpm} batimentos no primeiro minuto depois do esforço — dentro do esperado.`,
    };
  }
  return {
    rotulo: "Recuperação lenta",
    tom: "atencao",
    texto: `Seu coração desacelerou ${quedaBpm} batimentos no primeiro minuto. Vale comentar com seu médico na próxima consulta.`,
  };
}

// ── Evolução ─────────────────────────────────────────────────────────

export interface EvolucaoCapacidade {
  atual: number | null;
  anterior: number | null;
  variacao: number | null;
  variacaoPct: number | null;
  frase: string;
  unidade: string;
}

const UNIDADE: Record<TipoTeste, string> = {
  walk_6min: "metros",
  sit_to_stand_30s: "repetições",
  hr_recovery: "bpm",
};

const NOME: Record<TipoTeste, string> = {
  walk_6min: "caminhada de 6 minutos",
  sit_to_stand_30s: "sentar e levantar",
  hr_recovery: "recuperação dos batimentos",
};

export function evolucaoCapacidade(testes: TesteCapacidade[], tipo: TipoTeste): EvolucaoCapacidade {
  const doTipo = testes
    .filter((t) => t.tipo === tipo)
    .sort((a, b) => +new Date(b.realizado_em) - +new Date(a.realizado_em));

  const atual = doTipo[0]?.valor ?? null;
  const anterior = doTipo[1]?.valor ?? null;
  const unidade = UNIDADE[tipo];

  if (atual == null) {
    return { atual: null, anterior: null, variacao: null, variacaoPct: null, unidade, frase: `Você ainda não fez o teste de ${NOME[tipo]}.` };
  }
  if (anterior == null) {
    return {
      atual, anterior: null, variacao: null, variacaoPct: null, unidade,
      frase: `Primeiro registro: ${atual} ${unidade}. Refaça em 4 a 8 semanas para ver a evolução.`,
    };
  }

  const variacao = atual - anterior;
  const variacaoPct = Math.round((variacao / anterior) * 100);
  const frase =
    variacao > 0
      ? `Você melhorou ${variacao} ${unidade} desde o teste anterior (${variacaoPct > 0 ? "+" : ""}${variacaoPct}%).`
      : variacao < 0
      ? `Desta vez foram ${Math.abs(variacao)} ${unidade} a menos que no teste anterior. Um único teste varia bastante — o que conta é a linha ao longo dos meses.`
      : `Mesmo resultado do teste anterior: ${atual} ${unidade}.`;

  return { atual, anterior, variacao, variacaoPct, unidade, frase };
}

// ── Caminhada guiada ─────────────────────────────────────────────────

/**
 * Faixa de frequência da sessão guiada.
 *
 * REGRA (docs/ENGAJAMENTO-CARDIO.md §6.3): a faixa vem do MÉDICO. Sem faixa
 * definida por ele, o app não inventa uma — a sessão roda como caminhada
 * livre, mostrando os batimentos sem alvo. Prescrever intensidade de esforço
 * para cardiopata é conduta clínica, e conduta é do médico.
 */
export interface ZonaDeTreino {
  definidaPeloMedico: boolean;
  min: number | null;
  max: number | null;
  aviso: string;
}

export function zonaDeTreino(targets: { training_hr_min?: number | null; training_hr_max?: number | null } | null): ZonaDeTreino {
  const min = targets?.training_hr_min ?? null;
  const max = targets?.training_hr_max ?? null;
  if (min != null && max != null) {
    return {
      definidaPeloMedico: true,
      min,
      max,
      aviso: `Faixa definida pelo seu médico: ${min} a ${max} batimentos por minuto.`,
    };
  }
  return {
    definidaPeloMedico: false,
    min: null,
    max: null,
    aviso:
      "Seu médico ainda não definiu uma faixa de batimentos para os seus exercícios. Enquanto isso a caminhada fica livre: o app mostra seus batimentos, sem faixa-alvo.",
  };
}

export type EstadoZona = "abaixo" | "dentro" | "acima" | "sem_alvo";

export function estadoNaZona(bpm: number | null, zona: ZonaDeTreino): EstadoZona {
  if (bpm == null || !zona.definidaPeloMedico || zona.min == null || zona.max == null) return "sem_alvo";
  if (bpm < zona.min) return "abaixo";
  if (bpm > zona.max) return "acima";
  return "dentro";
}

export const TEXTO_ZONA: Record<EstadoZona, string> = {
  abaixo: "Você pode acelerar um pouco o passo, se estiver confortável.",
  dentro: "Está na faixa que seu médico definiu.",
  acima: "Está acima da faixa definida pelo seu médico. Diminua o passo.",
  sem_alvo: "Caminhada livre — sem faixa definida.",
};

/** Sinais para encerrar a sessão. Sempre para o mesmo lugar: parar e avaliar. */
export const MOTIVOS_PARA_PARAR = [
  "Dor ou aperto no peito",
  "Falta de ar que não passa ao diminuir o passo",
  "Tontura, enjoo ou vontade de desmaiar",
  "Batimentos irregulares que você sente",
  "Dor em uma das pernas que aperta ao andar",
  "Suor frio",
] as const;
