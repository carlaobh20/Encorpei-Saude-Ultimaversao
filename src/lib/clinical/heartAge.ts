/**
 * ══════════════════════════════════════════════════════════════════════
 * IDADE DO CORAÇÃO
 * ══════════════════════════════════════════════════════════════════════
 *
 * A métrica-espinha do app do paciente (docs/ENGAJAMENTO-CARDIO.md §2.1).
 *
 * O QUE É [Certo]
 * A idade que uma pessoa com fatores de risco IDEAIS precisaria ter para
 * carregar o mesmo risco cardiovascular em 10 anos que este paciente tem
 * hoje. É o conceito de "heart age" / idade vascular, derivado do escore de
 * risco global de Framingham — o mesmo que já está em `scores.ts`.
 *
 * POR QUE EXISTE
 * "LDL 78 mg/dL" não muda o comportamento de ninguém. "Seu coração tem 74
 * anos e você tem 68" muda. E, quando o paciente melhora, o número CAI — é a
 * única métrica do app em que o esforço vira recompensa visível.
 *
 * LIMITES QUE A TELA PRECISA RESPEITAR
 * - É estimativa populacional, não medida do coração dele. A tela diz isso.
 * - Framingham é para PREVENÇÃO PRIMÁRIA. Em quem já teve infarto, AVC ou
 *   tem IC, o escore não se aplica — `calcularIdadeDoCoracao` devolve
 *   `aplicavel: false` e a tela mostra Tempo no Alvo e Capacidade no lugar.
 * - Não é conduta. Nenhuma frase daqui manda fazer nada.
 */

import { framinghamRisco10a, idadeEmAnos, type FraminghamInput } from "./scores";
import type { CardioPatient } from "@/types/cardio";

/** Perfil "ideal" de referência — o denominador da conta. */
const PERFIL_IDEAL = {
  totalCholesterol: 180,
  hdl: 45,
  systolic: 125,
  treatedForHypertension: false,
  smoker: false,
  diabetes: false,
} as const;

export interface EntradaIdadeCoracao {
  idade: number;
  sexo: "male" | "female";
  colesterolTotal: number;
  hdl: number;
  sistolica: number;
  emTratamentoPressao: boolean;
  fumante: boolean;
  diabetes: boolean;
}

export interface ResultadoIdadeCoracao {
  aplicavel: boolean;
  /** Bateu no teto de IDADE_CORACAO_MAX — a tela mostra "85+". */
  noTeto?: boolean;
  /** Motivo, quando não se aplica. */
  motivo?: string;
  idadeReal: number;
  idadeDoCoracao: number;
  /** Positivo = coração mais velho que a pessoa. */
  diferenca: number;
  riscoPercentual: number;
  /** O que mais pesa, em ordem — base da tela "o que muda o meu número". */
  fatores: FatorDeRisco[];
  calculadoEm: string;
}

export interface FatorDeRisco {
  chave: "pressao" | "colesterol" | "hdl" | "tabagismo" | "diabetes";
  rotulo: string;
  /** Quantos anos da idade do coração somem se este fator for ao ideal. */
  anosQuePodeGanhar: number;
  /** Descrição em linguagem de paciente. Nunca prescreve conduta. */
  descricao: string;
}

/** Risco de quem tem tudo ideal, na idade dada. */
function riscoIdeal(idade: number, sexo: "male" | "female"): number | null {
  const r = framinghamRisco10a({ age: idade, sex: sexo, ...PERFIL_IDEAL } as FraminghamInput);
  return r ? r.score : null;
}

/**
 * Teto do número exibido.
 *
 * Acima de 85 a conta deixa de ser informação e vira susto: o modelo não foi
 * validado nessa faixa, e um "seu coração tem 96 anos" faz o paciente
 * descartar a métrica inteira em vez de agir sobre ela. Quando bate no teto, a
 * tela mostra "85+" — ver `noTeto` no resultado.
 */
export const IDADE_CORACAO_MAX = 85;

/**
 * Busca a idade cujo risco IDEAL é igual ao risco atual do paciente.
 * Varre em passos de 0,5 ano — precisão de meio ano é mais do que suficiente
 * para um número que a tela arredonda.
 */
function idadeEquivalente(riscoAtual: number, sexo: "male" | "female"): number {
  let melhorIdade = 30;
  let menorDiferenca = Number.POSITIVE_INFINITY;

  for (let idade = 30; idade <= IDADE_CORACAO_MAX; idade += 0.5) {
    const ref = riscoIdeal(Math.min(idade, 79), sexo);
    if (ref == null) continue;
    // Acima de 79 o modelo não vale; extrapolamos linearmente para não
    // travar o número em 79 em quem tem risco muito alto.
    const ajustado = idade > 79 ? ref * (1 + (idade - 79) * 0.06) : ref;
    const d = Math.abs(ajustado - riscoAtual);
    if (d < menorDiferenca) {
      menorDiferenca = d;
      melhorIdade = idade;
    }
  }
  return Math.round(melhorIdade);
}

export function calcularIdadeDoCoracao(e: EntradaIdadeCoracao): ResultadoIdadeCoracao | null {
  const atual = framinghamRisco10a({
    age: e.idade,
    sex: e.sexo,
    totalCholesterol: e.colesterolTotal,
    hdl: e.hdl,
    systolic: e.sistolica,
    treatedForHypertension: e.emTratamentoPressao,
    smoker: e.fumante,
    diabetes: e.diabetes,
  });
  if (!atual) return null;

  const idadeCoracao = idadeEquivalente(atual.score, e.sexo);

  // Quanto cada fator, sozinho, custa em anos de coração.
  const fatores: FatorDeRisco[] = [];
  const testar = (
    chave: FatorDeRisco["chave"],
    rotulo: string,
    descricao: string,
    mudanca: Partial<EntradaIdadeCoracao>
  ) => {
    const melhorado = framinghamRisco10a({
      age: e.idade,
      sex: e.sexo,
      totalCholesterol: mudanca.colesterolTotal ?? e.colesterolTotal,
      hdl: mudanca.hdl ?? e.hdl,
      systolic: mudanca.sistolica ?? e.sistolica,
      treatedForHypertension: mudanca.emTratamentoPressao ?? e.emTratamentoPressao,
      smoker: mudanca.fumante ?? e.fumante,
      diabetes: mudanca.diabetes ?? e.diabetes,
    });
    if (!melhorado) return;
    const novaIdade = idadeEquivalente(melhorado.score, e.sexo);
    const ganho = idadeCoracao - novaIdade;
    if (ganho >= 1) fatores.push({ chave, rotulo, anosQuePodeGanhar: ganho, descricao });
  };

  if (e.sistolica > PERFIL_IDEAL.systolic) {
    testar("pressao", "Pressão no alvo", "Levar a pressão para perto de 125 é o que mais mexe neste número.", {
      sistolica: PERFIL_IDEAL.systolic,
    });
  }
  if (e.colesterolTotal > PERFIL_IDEAL.totalCholesterol) {
    testar("colesterol", "Colesterol no alvo", "Colesterol total mais baixo reduz a idade do seu coração.", {
      colesterolTotal: PERFIL_IDEAL.totalCholesterol,
    });
  }
  if (e.hdl < PERFIL_IDEAL.hdl) {
    testar("hdl", "HDL mais alto", "O HDL costuma subir com atividade física regular.", { hdl: PERFIL_IDEAL.hdl });
  }
  if (e.fumante) {
    testar("tabagismo", "Parar de fumar", "É a mudança isolada com maior efeito sobre o seu risco.", { fumante: false });
  }
  if (e.diabetes) {
    testar("diabetes", "Diabetes controlado", "Glicemia sob controle reduz o risco cardiovascular.", { diabetes: false });
  }

  fatores.sort((a, b) => b.anosQuePodeGanhar - a.anosQuePodeGanhar);

  return {
    aplicavel: true,
    noTeto: idadeCoracao >= IDADE_CORACAO_MAX,
    idadeReal: e.idade,
    idadeDoCoracao: idadeCoracao,
    diferenca: idadeCoracao - e.idade,
    riscoPercentual: atual.score,
    fatores,
    calculadoEm: new Date().toISOString(),
  };
}

/**
 * Projeção honesta: se o paciente levar a pressão ao alvo e mantiver, qual
 * seria a idade do coração. Não promete prazo — projeta o cenário.
 */
export function projetarIdadeDoCoracao(
  e: EntradaIdadeCoracao,
  cenario: { sistolicaAlvo?: number; pararDeFumar?: boolean; colesterolAlvo?: number }
): number | null {
  const r = calcularIdadeDoCoracao({
    ...e,
    sistolica: cenario.sistolicaAlvo ?? e.sistolica,
    fumante: cenario.pararDeFumar ? false : e.fumante,
    colesterolTotal: cenario.colesterolAlvo ?? e.colesterolTotal,
  });
  return r?.idadeDoCoracao ?? null;
}

/**
 * Framingham é de prevenção primária. Quem já tem doença estabelecida sai
 * do escopo — e a tela precisa saber disso para mostrar outra coisa.
 */
export function idadeCoracaoSeAplica(p: CardioPatient | null | undefined): { aplicavel: boolean; motivo?: string } {
  if (!p) return { aplicavel: false, motivo: "Cadastro incompleto." };
  const h = p.history ?? {};
  if (h.previous_mi || h.stroke_tia || h.heart_failure || h.pci || h.cabg || h.pad) {
    return {
      aplicavel: false,
      motivo:
        "Você já tem um diagnóstico cardiológico estabelecido. Neste caso a Idade do Coração não é a melhor medida — o que conta é o seu Tempo no Alvo e a sua Capacidade.",
    };
  }
  const idade = idadeEmAnos(p.birth_date);
  if (idade == null || idade < 30 || idade > 79) {
    return { aplicavel: false, motivo: "A estimativa é validada para idades entre 30 e 79 anos." };
  }
  if (!p.sex) return { aplicavel: false, motivo: "Falta o sexo biológico no seu cadastro." };
  return { aplicavel: true };
}
