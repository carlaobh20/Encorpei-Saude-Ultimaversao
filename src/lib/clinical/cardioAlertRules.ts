/**
 * ══════════════════════════════════════════════════════════════════════
 * RÉGUA DE ALERTAS CARDIOLÓGICOS
 * ══════════════════════════════════════════════════════════════════════
 *
 * Fonte única dos limiares. Tabela espelhada em docs/MAPEAMENTO-CARDIO.md §2.6.
 *
 * DUAS REGRAS QUE NÃO PODEM SER QUEBRADAS:
 *
 * 1. Nenhum texto de alerta prescreve conduta. Todo alerta termina em
 *    "avise seu médico" / "procure atendimento". Software que sugere conduta
 *    é dispositivo médico regulado (ANVISA RDC 657/2022) — ver docs §6.
 *
 * 2. Leitura com validation_status "estimated" (PA estimada por PPG da
 *    pulseira) NUNCA dispara alerta de pressão. Ver docs §4.
 */

import type { Severity, ValidationStatus } from "@/types/cardio";

export interface AlertRuleDef {
  code: string;
  label: string;
  severity: Severity;
  /** Texto mostrado ao PACIENTE. Nunca prescreve conduta. */
  patientMessage: string;
  /** Texto mostrado ao MÉDICO no painel. */
  doctorMessage: string;
  /** Limiar padrão — o cardiologista pode sobrepor por paciente. */
  defaultThreshold: string;
}

export const ALERT_RULES: Record<string, AlertRuleDef> = {
  pa_crise: {
    code: "pa_crise",
    label: "Pressão muito alta",
    severity: "critical",
    patientMessage:
      "Sua pressão está muito acima do normal. Sente-se, descanse 5 minutos e meça de novo. Se repetir ou se sentir dor no peito, falta de ar, dor de cabeça forte ou alteração na visão, procure atendimento agora.",
    doctorMessage: "Crise hipertensiva registrada em casa.",
    defaultThreshold: "PAS ≥ 180 ou PAD ≥ 110 mmHg",
  },
  pa_alta_sustentada: {
    code: "pa_alta_sustentada",
    label: "Pressão alta repetida",
    severity: "warning",
    patientMessage:
      "Suas últimas medidas de pressão vieram acima do seu alvo. Continue medindo e avise seu médico na próxima consulta.",
    doctorMessage: "3+ medidas acima do alvo em 7 dias — considerar reavaliação.",
    defaultThreshold: "3 medidas ≥ alvo em 7 dias",
  },
  pa_baixa: {
    code: "pa_baixa",
    label: "Pressão baixa",
    severity: "critical",
    patientMessage:
      "Sua pressão está baixa. Se estiver com tontura, fraqueza ou vontade de desmaiar, deite-se com as pernas elevadas e avise seu médico.",
    doctorMessage: "Hipotensão registrada — avaliar dose de anti-hipertensivo/diurético.",
    defaultThreshold: "PAS < 90 mmHg",
  },
  fc_taqui_repouso: {
    code: "fc_taqui_repouso",
    label: "Coração acelerado em repouso",
    severity: "warning",
    patientMessage:
      "Seu coração está batendo mais rápido do que o habitual em repouso. Se vier acompanhado de falta de ar, dor no peito ou tontura, procure atendimento.",
    doctorMessage: "Taquicardia de repouso sustentada.",
    defaultThreshold: "> 100 bpm por mais de 30 min",
  },
  fc_bradi: {
    code: "fc_bradi",
    label: "Coração muito lento",
    severity: "critical",
    patientMessage:
      "Seus batimentos estão abaixo do esperado. Avise seu médico — e, se sentir tontura, desmaio ou muito cansaço, procure atendimento.",
    doctorMessage: "Bradicardia — revisar betabloqueador/antiarrítmico.",
    defaultThreshold: "< 45 bpm (ou < 50 com sintoma)",
  },
  ritmo_irregular: {
    code: "ritmo_irregular",
    label: "Ritmo irregular detectado",
    severity: "warning",
    patientMessage:
      "Seu dispositivo detectou batimentos irregulares. Isso é um rastreio, não um diagnóstico — seu médico foi avisado.",
    doctorMessage: "Rastreio de irregularidade recorrente pelo wearable — considerar ECG/Holter.",
    defaultThreshold: "≥ 3 episódios em 7 dias",
  },
  peso_ic_dia: {
    code: "peso_ic_dia",
    label: "Ganho rápido de peso",
    severity: "critical",
    patientMessage:
      "Você ganhou peso rápido em pouco tempo, o que pode indicar retenção de líquido. Avise seu médico hoje e siga as orientações que ele já te deu.",
    doctorMessage: "Ganho > 1,5 kg/24h — possível descompensação de IC.",
    defaultThreshold: "> 1,5 kg em 24 h",
  },
  peso_ic_semana: {
    code: "peso_ic_semana",
    label: "Peso subindo na semana",
    severity: "warning",
    patientMessage: "Seu peso subiu ao longo da semana. Avise seu médico.",
    doctorMessage: "Ganho > 2 kg/7 dias — avaliar volemia.",
    defaultThreshold: "> 2,0 kg em 7 dias",
  },
  spo2_baixa: {
    code: "spo2_baixa",
    label: "Oxigenação baixa",
    severity: "critical",
    patientMessage:
      "Sua oxigenação está abaixo do esperado. Se estiver com falta de ar, procure atendimento.",
    doctorMessage: "SpO₂ < 90% sustentada.",
    defaultThreshold: "< 90% por mais de 10 min",
  },
  spo2_noturna: {
    code: "spo2_noturna",
    label: "Oxigenação caindo durante o sono",
    severity: "warning",
    patientMessage:
      "Sua oxigenação caiu várias vezes durante o sono. Comente com seu médico — pode valer investigar seu sono.",
    doctorMessage: "Dessaturação noturna significativa — rastrear apneia do sono.",
    defaultThreshold: "≥ 5% do sono com SpO₂ < 90%",
  },
  dor_toracica_repouso: {
    code: "dor_toracica_repouso",
    label: "Dor no peito em repouso",
    severity: "emergency",
    patientMessage:
      "Dor no peito em repouso que não passa é emergência. Ligue 192 (SAMU) ou vá ao pronto-socorro mais próximo agora. Não dirija.",
    doctorMessage: "Paciente relatou dor torácica em repouso > 10 min — orientado a buscar emergência.",
    defaultThreshold: "dor em repouso > 10 min",
  },
  sincope: {
    code: "sincope",
    label: "Desmaio",
    severity: "critical",
    patientMessage:
      "Desmaio precisa ser avaliado. Avise seu médico hoje e evite dirigir até essa conversa.",
    doctorMessage: "Episódio de síncope relatado.",
    defaultThreshold: "qualquer episódio",
  },
  dispneia_piora: {
    code: "dispneia_piora",
    label: "Falta de ar piorando",
    severity: "warning",
    patientMessage: "Sua falta de ar piorou em relação ao seu padrão. Avise seu médico.",
    doctorMessage: "Piora de classe funcional (NYHA).",
    defaultThreshold: "subida de 1 classe NYHA",
  },
  adesao_baixa: {
    code: "adesao_baixa",
    label: "Remédios em atraso",
    severity: "warning",
    patientMessage:
      "Você deixou de marcar várias doses nas últimas semanas. Se está com dificuldade para tomar, fale com seu médico — quase sempre dá para ajustar.",
    doctorMessage: "Adesão < 80% em 14 dias.",
    defaultThreshold: "< 80% das doses em 14 dias",
  },
  sem_dados: {
    code: "sem_dados",
    label: "Sem registros",
    severity: "info",
    patientMessage: "Faz alguns dias que não recebemos nenhuma medida sua.",
    doctorMessage: "Paciente sem qualquer registro há 10 dias.",
    defaultThreshold: "10 dias sem registro",
  },
  ldl_fora_alvo: {
    code: "ldl_fora_alvo",
    label: "Colesterol acima do alvo",
    severity: "warning",
    patientMessage: "Seu LDL está acima do alvo definido pelo seu médico. Leve o exame na consulta.",
    doctorMessage: "LDL acima do alvo do paciente — considerar intensificação.",
    defaultThreshold: "LDL > alvo individual",
  },
  k_alterado: {
    code: "k_alterado",
    label: "Potássio alterado",
    severity: "critical",
    patientMessage: "Um exame seu veio com alteração que seu médico precisa ver. Ele foi avisado.",
    doctorMessage: "K⁺ fora de 3,5–5,5 mEq/L — revisar IECA/BRA/ARM/diurético.",
    defaultThreshold: "< 3,5 ou > 5,5 mEq/L",
  },
  tfg_queda: {
    code: "tfg_queda",
    label: "Função renal em queda",
    severity: "critical",
    patientMessage: "Um exame seu veio com alteração que seu médico precisa ver. Ele foi avisado.",
    doctorMessage: "Queda > 30% da TFG basal.",
    defaultThreshold: "queda > 30% vs. basal",
  },
};

export type AlertRuleCode = keyof typeof ALERT_RULES;

/** Peso de cada severidade no cálculo do semáforo. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  info: 1,
  warning: 4,
  critical: 10,
  emergency: 20,
};

/**
 * A regra do §4 em uma linha de código: só medida validada dispara alerta
 * clínico. Estimativa de pulseira entra no gráfico, não no alerta.
 */
export function podeDispararAlerta(status: ValidationStatus): boolean {
  return status === "validated";
}

/* ═══════════════════════════════════════════════════════════════════════
 * PONTE ENTRE AS DUAS NOMENCLATURAS DE ALERTA
 * ═══════════════════════════════════════════════════════════════════════
 *
 * O produto tem DOIS emissores de alerta e eles nunca falaram a mesma língua:
 *
 *  · `ALERT_RULES` acima — códigos em português, calculados no cliente por
 *    `avaliarRisco()`. Servem ao semáforo da fila e ao cartão do paciente.
 *    Nunca são gravados em lugar nenhum.
 *
 *  · `cardio_alerts.rule_code` — códigos em inglês, gravados pelos gatilhos
 *    do banco (migração 20260911000000_integracao §3). São o que o médico
 *    realmente vê na tela de alertas, e o que sobrevive ao fechamento do app.
 *
 * Até a auditoria, nenhuma tela traduzia o segundo grupo: o médico via
 * `spo2_borderline` e o paciente via `symptom_chest_pain_rest`. A tradução
 * passa a morar AQUI, num lugar só, e chega às telas pelos hooks
 * (`useCardioAlerts`, `useProfessionalAlerts`), que devolvem cada alerta já
 * com `rotulo` preenchido. Quem renderiza não precisa saber que existem duas
 * nomenclaturas — que é exatamente o ponto.
 */

/** Um alerta descreve o coração do paciente, ou a relação dele com o tratamento. */
export type ClasseDeAlerta = "clinico" | "operacional";

export interface RegraDoBanco {
  /** Nome legível — o mesmo para o paciente e para o médico. */
  label: string;
  classe: ClasseDeAlerta;
  /** Regra equivalente no motor do cliente, quando existe. */
  equivalente?: AlertRuleCode;
}

/**
 * Os códigos que o BANCO realmente emite. Esta lista é o espelho exato dos
 * `perform public.registrar_alerta(...)` das migrações — se um gatilho novo
 * nascer lá, ele nasce aqui no mesmo commit, senão a tela volta a mostrar
 * código cru.
 */
export const REGRA_DO_BANCO: Record<string, RegraDoBanco> = {
  bp_crisis:        { label: "Pressão muito alta",                 classe: "clinico", equivalente: "pa_crise" },
  bp_hypotension:   { label: "Pressão baixa",                      classe: "clinico", equivalente: "pa_baixa" },
  bp_above_target:  { label: "Pressão acima do alvo",              classe: "clinico", equivalente: "pa_alta_sustentada" },
  hr_bradycardia:   { label: "Batimentos muito lentos",            classe: "clinico", equivalente: "fc_bradi" },
  hr_tachycardia:   { label: "Batimentos muito rápidos",           classe: "clinico", equivalente: "fc_taqui_repouso" },
  hr_above_target:  { label: "Batimentos de repouso acima do alvo", classe: "clinico" },
  hr_irregular:     { label: "Ritmo irregular detectado",          classe: "clinico", equivalente: "ritmo_irregular" },
  spo2_low:         { label: "Oxigenação baixa",                   classe: "clinico", equivalente: "spo2_baixa" },
  spo2_borderline:  { label: "Oxigenação no limite",               classe: "clinico" },
  weight_gain_3d:   { label: "Ganho rápido de peso",               classe: "clinico", equivalente: "peso_ic_dia" },
  weight_loss:      { label: "Perda de peso relevante",            classe: "clinico" },

  // Atraso operacional: não descreve o coração, descreve a relação do paciente
  // com o tratamento e com o app. Emitidos por
  // `public.registrar_alertas_operacionais()` (migração 20260917000000).
  no_data:          { label: "Sem registros há dias",              classe: "operacional", equivalente: "sem_dados" },
  adherence_low:    { label: "Doses em atraso",                    classe: "operacional", equivalente: "adesao_baixa" },
};

/**
 * Sintomas: o gatilho grava `symptom_<tipo>` e, para dor no peito, distingue
 * repouso de esforço no próprio código (`symptom_chest_pain_rest`). A lista
 * canônica de tipos vive em `SymptomType` (@/types/cardio) e está repetida em
 * comentário na migração 20260917000000 — os três lugares mudam juntos.
 */
export const SINTOMA_ROTULO_ALERTA: Record<string, string> = {
  chest_pain: "Dor no peito",
  chest_pain_rest: "Dor no peito em repouso",
  dyspnea: "Falta de ar",
  dyspnea_rest: "Falta de ar em repouso",
  palpitations: "Palpitação",
  edema: "Inchaço nas pernas",
  syncope: "Desmaio",
  presyncope: "Quase desmaiou",
  claudication: "Dor na perna ao andar",
  dry_cough: "Tosse seca",
  fatigue: "Cansaço fora do comum",
  dizziness: "Tontura",
};

/**
 * `rule_code` → frase legível, venha o código de onde vier.
 *
 * Ordem de busca: regra do banco → regra do motor do cliente → sintoma →
 * o código com os sublinhados trocados por espaço. O último caso nunca deveria
 * acontecer; existe para que um código novo apareça feio em vez de sumir.
 */
export function rotuloDaRegra(ruleCode: string | null | undefined): string {
  if (!ruleCode) return "Alerta";
  const doBanco = REGRA_DO_BANCO[ruleCode];
  if (doBanco) return doBanco.label;

  const doMotor = ALERT_RULES[ruleCode];
  if (doMotor) return doMotor.label;

  if (ruleCode.startsWith("symptom_")) {
    const tipo = ruleCode.slice("symptom_".length);
    return SINTOMA_ROTULO_ALERTA[tipo] ?? `Sintoma relatado: ${tipo.replace(/_/g, " ")}`;
  }
  return ruleCode.replace(/_/g, " ");
}

/**
 * Risco clínico × atraso operacional.
 *
 * Sintoma é sempre clínico. Códigos desconhecidos caem em `clinico` de
 * propósito: errar para o lado de mostrar ao médico custa uma linha na fila;
 * errar para o outro esconde um alerta.
 */
export function classeDaRegra(ruleCode: string | null | undefined): ClasseDeAlerta {
  if (!ruleCode) return "clinico";
  const doBanco = REGRA_DO_BANCO[ruleCode];
  if (doBanco) return doBanco.classe;
  if (ruleCode === "sem_dados" || ruleCode === "adesao_baixa") return "operacional";
  return "clinico";
}

/* ═══════════════════════════════════════════════════════════════════════
 * QUALIFICADORES DE SINTOMA — nomenclatura canônica
 * ═══════════════════════════════════════════════════════════════════════
 *
 * `symptom_reports.qualifiers` é jsonb livre, e era lido com uma chave no
 * motor (`trigger`, `nyha_change`) e gravado com outra na tela (`gatilho`,
 * `nyha`). As duas regras mais graves do motor — dor torácica em repouso e
 * piora de dispneia — nunca dispararam com dado real por causa disso.
 *
 * A nomenclatura escolhida é a da TELA, em português, por dois motivos:
 *  1. é a que já está gravada no banco dos pacientes em produção — mudar o
 *     leitor conserta o histórico, mudar o escritor abandonaria o histórico;
 *  2. o gatilho `alerta_sintoma` no Postgres também lê estas chaves, e SQL não
 *     importa constante de TypeScript — quanto menos tradução no caminho,
 *     menos chance de divergirem de novo.
 *
 * Quem grava: SintomasPage. Quem lê: cardioRiskEngine e o gatilho
 * `public.alerta_sintoma()` (migração 20260917000000). Os três mudam juntos.
 */
export const QUALIFICADOR = {
  /** Dor no peito: o que estava acontecendo quando começou. */
  GATILHO: "gatilho",
  /** Classe NYHA ABSOLUTA (1–4) no momento do relato — não a variação. */
  NYHA: "nyha",
} as const;

/** Valores aceitos em `qualifiers.gatilho`. */
export const GATILHO = {
  ESFORCO: "esforco",
  REPOUSO: "repouso",
  EMOCAO: "emocao",
} as const;

export type GatilhoDaDor = (typeof GATILHO)[keyof typeof GATILHO];

/**
 * Leitura tolerante do gatilho.
 *
 * Aceita o valor canônico em português E o valor inglês que a tela gravou
 * antes desta correção (`rest`/`effort`/`emotion`). Registro clínico antigo
 * não se reescreve — se lê com cuidado.
 */
export function gatilhoDaDor(
  qualifiers: Record<string, unknown> | null | undefined
): GatilhoDaDor | null {
  const bruto = qualifiers?.[QUALIFICADOR.GATILHO];
  if (typeof bruto !== "string" || !bruto) return null;
  switch (bruto) {
    case "repouso":
    case "rest":
      return GATILHO.REPOUSO;
    case "esforco":
    case "effort":
      return GATILHO.ESFORCO;
    case "emocao":
    case "emotion":
      return GATILHO.EMOCAO;
    default:
      return null;
  }
}

/** Classe NYHA absoluta gravada no relato, quando houver. */
export function nyhaDoRelato(
  qualifiers: Record<string, unknown> | null | undefined
): number | null {
  const bruto = qualifiers?.[QUALIFICADOR.NYHA];
  const n = typeof bruto === "string" ? Number(bruto) : bruto;
  return typeof n === "number" && Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
}
