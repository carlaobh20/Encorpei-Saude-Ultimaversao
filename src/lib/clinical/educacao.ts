/**
 * APRENDER — micro-lições puxadas pelo caso do próprio paciente.
 * docs/ENGAJAMENTO-CARDIO.md §3.4
 *
 * Não é uma biblioteca de artigos sobre "o coração". É um conjunto de lições
 * curtas que só aparecem quando o dado do paciente as torna relevantes: o eco
 * dele registrou FEVE 45% → a lição sobre fração de ejeção aparece, com o
 * número dele dentro da frase.
 *
 * REGRA: explicar não é prescrever. Nenhuma lição diz o que fazer com
 * remédio, dose ou dieta. Termina em "converse com seu médico" quando for o
 * caso (MAPEAMENTO-CARDIO.md §6).
 */

import type { CardioExam, CardioMedication, CardioPatient, LabResult } from "@/types/cardio";
import { MED_CLASS_LABEL } from "@/hooks/useCardioMedications";

export interface Licao {
  id: string;
  titulo: string;
  /** ~40 segundos de leitura. Linguagem de paciente. */
  corpo: string;
  /** De onde saiu a relevância: "seu eco de 12/07", "sua receita". */
  origem: string;
  categoria: "exame" | "remedio" | "condicao" | "habito";
  /** Quanto mais alto, mais cedo aparece. */
  prioridade: number;
}

interface FonteDeLicoes {
  patient: CardioPatient | null;
  exams: CardioExam[];
  labs: LabResult[];
  medications: CardioMedication[];
}

function fmtData(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

/** Explicações por classe de medicamento — o que ele faz, em português comum. */
const EXPLICACAO_CLASSE: Record<string, { oQueFaz: string; oQueEsperar: string }> = {
  arb: {
    oQueFaz: "relaxa os vasos sanguíneos, o que faz o sangue circular com menos pressão",
    oQueEsperar: "a pressão cai aos poucos, ao longo de semanas — não de um dia para o outro",
  },
  acei: {
    oQueFaz: "relaxa os vasos sanguíneos e diminui o esforço do coração",
    oQueEsperar: "uma tosse seca persistente é o efeito mais comum dessa classe; se aparecer, comente com seu médico",
  },
  arni: {
    oQueFaz: "combina dois efeitos para diminuir o esforço do coração em quem tem insuficiência cardíaca",
    oQueEsperar: "seu médico costuma pedir exames de sangue depois de começar ou mudar a dose",
  },
  beta_blocker: {
    oQueFaz: "faz o coração bater mais devagar e com menos esforço",
    oQueEsperar: "cansaço nos primeiros dias é comum e costuma melhorar; seus batimentos em repouso ficam mais baixos de propósito",
  },
  sglt2: {
    oQueFaz: "ajuda o corpo a eliminar açúcar e líquido pela urina, e protege coração e rins",
    oQueEsperar: "você pode urinar um pouco mais no começo; beber água ao longo do dia ajuda",
  },
  mra: {
    oQueFaz: "ajuda a eliminar líquido sem perder potássio",
    oQueEsperar: "seu médico acompanha o potássio no sangue enquanto você usa",
  },
  loop_diuretic: {
    oQueFaz: "tira o líquido que se acumula no corpo",
    oQueEsperar: "você urina mais nas horas seguintes à dose; por isso costuma ser tomado de manhã",
  },
  statin: {
    oQueFaz: "reduz a produção de colesterol pelo fígado",
    oQueEsperar: "dor muscular persistente não é esperada — se aparecer, avise seu médico",
  },
  antiplatelet: {
    oQueFaz: "deixa o sangue menos propenso a formar coágulos dentro das artérias",
    oQueEsperar: "pequenos hematomas e sangramento na gengiva podem aparecer com mais facilidade",
  },
  anticoagulant: {
    oQueFaz: "reduz a chance de formar coágulos que podem entupir um vaso",
    oQueEsperar: "sangramento que não para precisa de avaliação; avise qualquer dentista ou cirurgião que você usa",
  },
  ccb: {
    oQueFaz: "relaxa a parede das artérias, reduzindo a pressão",
    oQueEsperar: "inchaço nos tornozelos no fim do dia é o efeito mais comum dessa classe",
  },
  nitrate: {
    oQueFaz: "dilata os vasos e alivia o aperto no peito",
    oQueEsperar: "dor de cabeça nos primeiros dias é comum",
  },
  antiarrhythmic: {
    oQueFaz: "ajuda o coração a manter um ritmo regular",
    oQueEsperar: "seu médico costuma acompanhar exames de tireoide e do fígado durante o uso",
  },
};

/** Gera a fila de lições relevantes para este paciente, agora. */
export function licoesPara({ patient, exams, labs, medications }: FonteDeLicoes): Licao[] {
  const licoes: Licao[] = [];

  // ── A partir dos exames ──
  const eco = exams.find((e) => e.exam_type === "echocardiogram");
  const fevi = eco?.findings?.fevi;
  if (eco && typeof fevi === "number") {
    licoes.push({
      id: "licao-fevi",
      titulo: "O que é fração de ejeção",
      corpo:
        `A cada batida, seu coração enche de sangue e joga uma parte para fora. A fração de ejeção é essa parte — ` +
        `quanto ele consegue bombear a cada batida. No seu ecocardiograma ela ficou em ${fevi}%. ` +
        (fevi >= 50
          ? "Entre 50% e 70% é a faixa considerada normal."
          : fevi >= 40
          ? "Abaixo de 50% quer dizer que o coração está bombeando com menos força do que o esperado — é o que o tratamento busca melhorar ou estabilizar, e é por isso que seu médico acompanha de perto."
          : "Abaixo de 40% quer dizer que o coração bombeia com bem menos força do que o esperado. É o número que o seu tratamento existe para melhorar ou estabilizar.") +
        " Ele não muda de um mês para o outro: é acompanhado de exame em exame.",
      origem: `Seu ecocardiograma de ${fmtData(eco.performed_at)}`,
      categoria: "exame",
      prioridade: 90,
    });
  }

  const holter = exams.find((e) => e.exam_type === "holter");
  if (holter) {
    licoes.push({
      id: "licao-holter",
      titulo: "O que o Holter viu",
      corpo:
        "O Holter grava o seu coração por 24 horas seguidas, incluindo o sono. Ele mostra os batimentos mais lentos e " +
        "os mais rápidos do dia e captura batidas fora de hora — que quase todo mundo tem, em maior ou menor quantidade. " +
        "Batidas isoladas são comuns e costumam não ter importância; o que interessa ao seu médico é o conjunto e se elas " +
        "coincidem com algum sintoma que você sentiu.",
      origem: `Seu Holter de ${fmtData(holter.performed_at)}`,
      categoria: "exame",
      prioridade: 60,
    });
  }

  // ── A partir do laboratório ──
  const ldl = labs.find((l) => l.marker_key === "ldl");
  if (ldl?.value_num != null) {
    licoes.push({
      id: "licao-ldl",
      titulo: "Por que o seu LDL tem um alvo diferente do vizinho",
      corpo:
        `O LDL é o colesterol que se deposita na parede das artérias. O seu último resultado foi ${ldl.value_num} mg/dL. ` +
        "O alvo não é igual para todo mundo: quem já teve um problema no coração precisa de um número mais baixo do que " +
        "quem nunca teve, porque a artéria já mostrou que se machuca. Por isso o valor que seu médico definiu para você " +
        "pode ser bem menor do que o 'normal' que aparece impresso no exame.",
      origem: `Seu exame de ${fmtData(ldl.collected_at)}`,
      categoria: "exame",
      prioridade: 80,
    });
  }

  const bnp = labs.find((l) => l.marker_key === "nt_probnp");
  if (bnp?.value_num != null) {
    licoes.push({
      id: "licao-bnp",
      titulo: "O que o NT-proBNP mede",
      corpo:
        `É uma substância que o coração libera quando está trabalhando sob esforço maior que o normal. O seu último valor ` +
        `foi ${bnp.value_num} pg/mL. Ele sobe quando há acúmulo de líquido e costuma cair quando o tratamento está ` +
        "funcionando — por isso é repetido de tempos em tempos, para comparar com você mesmo, não com uma tabela.",
      origem: `Seu exame de ${fmtData(bnp.collected_at)}`,
      categoria: "exame",
      prioridade: 70,
    });
  }

  // ── A partir das medicações ──
  for (const med of medications.filter((m) => m.status === "active")) {
    const exp = EXPLICACAO_CLASSE[med.med_class];
    if (!exp) continue;
    licoes.push({
      id: `licao-med-${med.id}`,
      titulo: `Para que serve ${med.name}`,
      corpo:
        `${med.name} é ${MED_CLASS_LABEL[med.med_class] ?? "um medicamento"} e ${exp.oQueFaz}. ` +
        `O que costuma acontecer: ${exp.oQueEsperar}. ` +
        "Não mude a dose nem pare por conta própria — quem ajusta isso é o seu médico.",
      origem: "Sua receita",
      categoria: "remedio",
      prioridade: 75,
    });
  }

  // ── A partir das condições ──
  if (patient?.history?.heart_failure) {
    licoes.push({
      id: "licao-peso-ic",
      titulo: "Por que pesar todo dia importa tanto no seu caso",
      corpo:
        "Na insuficiência cardíaca, o líquido começa a se acumular no corpo antes de aparecer inchaço ou falta de ar. " +
        "A balança percebe isso primeiro: um ganho rápido de peso em poucos dias quase sempre é líquido, não gordura. " +
        "É por isso que o peso da manhã, sempre no mesmo horário e antes do café, vale mais no seu acompanhamento do que " +
        "qualquer outro número do dia.",
      origem: "Seu diagnóstico",
      categoria: "condicao",
      prioridade: 95,
    });
  }
  if (patient?.comorbidities?.hypertension) {
    licoes.push({
      id: "licao-mrpa",
      titulo: "Como medir a pressão de um jeito que serve para o médico",
      corpo:
        "Uma medida solta diz pouco. O que o seu cardiologista usa é a média de várias medidas feitas em casa, sempre do " +
        "mesmo jeito: sentado, com as costas apoiadas e os pés no chão, cinco minutos de descanso antes, braço apoiado na " +
        "altura do coração, sem falar durante a medida. Duas medidas de manhã e duas à noite, por alguns dias antes da " +
        "consulta, valem mais do que trinta medidas aleatórias.",
      origem: "Seu diagnóstico",
      categoria: "habito",
      prioridade: 85,
    });
  }
  if (patient?.comorbidities?.sleep_apnea) {
    licoes.push({
      id: "licao-apneia",
      titulo: "A relação entre o seu sono e a sua pressão",
      corpo:
        "Quando a respiração para por alguns segundos durante o sono, o corpo entende aquilo como um susto: libera " +
        "adrenalina, acelera o coração e sobe a pressão — várias vezes por noite. Por isso apneia do sono e pressão alta " +
        "costumam andar juntas, e por isso o app acompanha a sua oxigenação durante a noite.",
      origem: "Seu diagnóstico",
      categoria: "condicao",
      prioridade: 65,
    });
  }
  if (patient?.history?.atrial_fibrillation) {
    licoes.push({
      id: "licao-fa",
      titulo: "O que é fibrilação atrial",
      corpo:
        "É quando a parte de cima do coração passa a bater de forma irregular, sem ritmo certo. Muita gente sente como " +
        "um coração 'descompassado'; outras pessoas não sentem nada. O cuidado principal é evitar a formação de coágulos " +
        "— é essa a razão do anticoagulante, e é por isso que ele não pode ser esquecido nem interrompido por conta própria.",
      origem: "Seu diagnóstico",
      categoria: "condicao",
      prioridade: 88,
    });
  }
  if (patient?.smoking_status === "current") {
    licoes.push({
      id: "licao-tabagismo",
      titulo: "O que acontece com o coração quando se para de fumar",
      corpo:
        "A frequência cardíaca e a pressão começam a cair já nas primeiras horas. Em algumas semanas a circulação melhora " +
        "e o esforço para caminhar diminui. Em cerca de um ano, o risco de infarto cai de forma expressiva. É a mudança " +
        "isolada com maior efeito sobre o seu risco — e existe tratamento para ajudar; converse com seu médico.",
      origem: "Seu cadastro",
      categoria: "habito",
      prioridade: 92,
    });
  }

  // Lições de base, para quem ainda tem pouco dado.
  licoes.push({
    id: "licao-sal",
    titulo: "Onde o sal se esconde",
    corpo:
      "A maior parte do sal que a gente come não vem do saleiro: vem de pão, embutidos, queijos, temperos prontos, " +
      "caldos em cubo, molhos, congelados e enlatados. Por isso trocar o sal da panela por temperos naturais ajuda, mas " +
      "quem faz a maior diferença é reduzir esses industrializados. Uma colher de chá rasa de sal por dia, no total, é a " +
      "referência mais usada.",
    origem: "Cuidado geral",
    categoria: "habito",
    prioridade: 40,
  });

  return licoes.sort((a, b) => b.prioridade - a.prioridade);
}
