/**
 * Dados do MODO DEMO — gerados em memória, nunca gravados.
 *
 * Servem a dois públicos: o cardiologista que quer ver o painel cheio antes
 * de cadastrar, e o desenvolvimento de telas sem depender de banco.
 *
 * Os números foram escolhidos para produzir uma fila de risco realista:
 * um paciente vermelho, um amarelo, o resto verde — porque um painel onde
 * todo mundo é vermelho não ensina nada a quem está avaliando o produto.
 */

import type {
  ActivityReading, BloodPressureReading, CardioAlert, CardioExam, CardioMedication,
  CardioTargets, HeartRateReading, LabResult, MedicationIntake, SleepReading,
  Spo2Reading, SymptomReport, WeightReading, RiskLevel,
} from "@/types/cardio";
import { DEV_PATIENT } from "@/contexts/DevBypass";

const DIA = 86_400_000;
const hoje = new Date();

function diasAtras(n: number, hora = 8, minuto = 0): string {
  const d = new Date(hoje.getTime() - n * DIA);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
}
function dataDia(n: number): string {
  return new Date(hoje.getTime() - n * DIA).toISOString().slice(0, 10);
}

/** Ruído determinístico — o demo precisa ser igual a cada abertura. */
function ruido(seed: number, amplitude: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 2 * amplitude;
}

const PACIENTE = DEV_PATIENT.user_id;

const proveniencia = {
  source_type: "manual" as const,
  source_device_id: null,
  source_device_name: null,
  entered_by: "paciente" as const,
  entered_by_user_id: null,
  validation_status: "validated" as const,
  validation_note: null,
  notes: null,
};

const dispositivo = {
  ...proveniencia,
  source_type: "device" as const,
  source_device_name: "Pulseira H59 (Demo)",
  entered_by: "device" as const,
};

// ── Pressão: 14 dias de melhora real ────────────────────────────────────
// A curva desce de ~150/92 para ~125/78. É o que faz o Tempo no Alvo sair de
// quase zero no mês anterior para a maior parte da semana dentro do alvo — o
// demo precisa mostrar a métrica funcionando, não uma linha reta acima da meta.

export const DEMO_BLOOD_PRESSURE: BloodPressureReading[] = Array.from({ length: 28 }, (_, i) => {
  const dia = Math.floor(i / 2);
  const manha = i % 2 === 0;
  // Últimos 10 dias dentro do alvo; antes disso, acima. É a curva que faz o
  // Tempo no Alvo sair de 0% no mês anterior para a maior parte deste mês.
  const acima = dia >= 10;
  const sys = Math.round((acima ? 137 : 125) + ruido(i + 1, acima ? 3 : 2.5) + (manha ? 2 : 0));
  const dias_ = Math.round((acima ? 86 : 76) + ruido(i + 31, 2));
  return {
    id: `demo-bp-${i}`,
    patient_user_id: PACIENTE,
    vital_type: "blood_pressure",
    recorded_at: diasAtras(dia, manha ? 7 : 20, 15),
    created_at: diasAtras(dia, manha ? 7 : 20, 16),
    systolic: sys,
    diastolic: dias_,
    pulse: Math.round(72 + ruido(i + 61, 8)),
    context: manha ? "morning" : "evening",
    position: "seated",
    arm: "left",
    cuff_validated: true,
    ...proveniencia,
  };
});

/** Mês anterior: quase nada no alvo — é o contraste que dá sentido à melhora. */
const DEMO_BP_MES_ANTERIOR: BloodPressureReading[] = Array.from({ length: 20 }, (_, i) => {
  const dia = 32 + Math.floor(i / 2);
  const manha = i % 2 === 0;
  return {
    id: `demo-bp-ant-${i}`,
    patient_user_id: PACIENTE,
    vital_type: "blood_pressure" as const,
    recorded_at: diasAtras(dia, manha ? 7 : 20, 15),
    created_at: diasAtras(dia, manha ? 7 : 20, 16),
    systolic: Math.round(150 + ruido(i + 700, 7)),
    diastolic: Math.round(92 + ruido(i + 730, 5)),
    pulse: Math.round(76 + ruido(i + 760, 6)),
    context: manha ? ("morning" as const) : ("evening" as const),
    position: "seated" as const,
    arm: "left" as const,
    cuff_validated: true,
    ...proveniencia,
  };
});

DEMO_BLOOD_PRESSURE.push(...DEMO_BP_MES_ANTERIOR);

// ── Frequência cardíaca de repouso: da pulseira, diária ────────────────

export const DEMO_HEART_RATE: HeartRateReading[] = Array.from({ length: 21 }, (_, i) => ({
  id: `demo-hr-${i}`,
  patient_user_id: PACIENTE,
  vital_type: "heart_rate",
  recorded_at: diasAtras(i, 6, 30),
  created_at: diasAtras(i, 6, 31),
  bpm: Math.round(68 + ruido(i + 91, 7)),
  context: "resting",
  irregular_flag: i === 2 || i === 5 ? true : false,
  ...dispositivo,
}));

// ── Peso: paciente com IC — a curva importa ────────────────────────────

export const DEMO_WEIGHT: WeightReading[] = Array.from({ length: 21 }, (_, i) => ({
  id: `demo-w-${i}`,
  patient_user_id: PACIENTE,
  vital_type: "weight",
  recorded_at: diasAtras(i, 7, 0),
  created_at: diasAtras(i, 7, 1),
  // Leve tendência de ganho na última semana — é o que faz o gráfico contar história.
  value: +(84.2 + (i < 7 ? (7 - i) * 0.12 : 0) + ruido(i + 121, 0.3)).toFixed(1),
  ...proveniencia,
}));

// ── Oxigenação: pontual + noturna ──────────────────────────────────────

export const DEMO_SPO2: Spo2Reading[] = Array.from({ length: 14 }, (_, i) => ({
  id: `demo-spo2-${i}`,
  patient_user_id: PACIENTE,
  vital_type: "spo2",
  recorded_at: diasAtras(i, 3, 0),
  created_at: diasAtras(i, 3, 1),
  value: Math.round(94 + ruido(i + 151, 2)),
  context: "sleep",
  time_below_90_pct: i % 3 === 0 ? +(4 + ruido(i + 181, 3)).toFixed(1) : 1.2,
  ...dispositivo,
}));

// ── Sono: 21 noites ────────────────────────────────────────────────────

export const DEMO_SLEEP: SleepReading[] = Array.from({ length: 21 }, (_, i) => {
  const total = Math.round(372 + ruido(i + 211, 55));
  const deep = Math.round(total * (0.16 + ruido(i + 241, 0.04)));
  const rem = Math.round(total * (0.19 + ruido(i + 271, 0.04)));
  return {
    id: `demo-sleep-${i}`,
    patient_user_id: PACIENTE,
    vital_type: "sleep",
    recorded_at: diasAtras(i, 7, 0),
    created_at: diasAtras(i, 7, 1),
    sleep_date: dataDia(i),
    total_minutes: total,
    deep_minutes: deep,
    rem_minutes: rem,
    light_minutes: total - deep - rem,
    awake_minutes: Math.round(22 + ruido(i + 301, 12)),
    awakenings: Math.round(3 + ruido(i + 331, 2)),
    efficiency_pct: +(86 + ruido(i + 361, 6)).toFixed(1),
    min_heart_rate: Math.round(56 + ruido(i + 391, 5)),
    min_spo2: Math.round(90 + ruido(i + 421, 3)),
    ...dispositivo,
  };
});

// ── Atividade ──────────────────────────────────────────────────────────

export const DEMO_ACTIVITY: ActivityReading[] = Array.from({ length: 21 }, (_, i) => {
  const passos = Math.max(800, Math.round(5200 + ruido(i + 451, 2600)));
  return {
    id: `demo-act-${i}`,
    patient_user_id: PACIENTE,
    vital_type: "steps",
    recorded_at: diasAtras(i, 21, 0),
    created_at: diasAtras(i, 21, 1),
    activity_date: dataDia(i),
    steps: passos,
    distance_km: +(passos * 0.00072).toFixed(2),
    calories: Math.round(passos * 0.042 + 1500),
    moderate_minutes: Math.max(0, Math.round(passos / 220 + ruido(i + 481, 6))),
    vigorous_minutes: i % 5 === 0 ? 12 : 0,
    avg_heart_rate: Math.round(78 + ruido(i + 511, 6)),
    max_heart_rate: Math.round(118 + ruido(i + 541, 14)),
    ...dispositivo,
  };
});

// ── Metas ──────────────────────────────────────────────────────────────

export const DEMO_TARGETS: CardioTargets = {
  id: "demo-targets-001",
  patient_user_id: PACIENTE,
  professional_id: "demo-pro-001",
  bp_systolic_max: 130,
  bp_diastolic_max: 80,
  ldl_max: 70,
  resting_hr_min: 50,
  resting_hr_max: 80,
  dry_weight_kg: null,
  steps_per_day: 6000,
  mvpa_minutes_week: 150,
  sleep_hours: 7,
  sodium_mg_day: 2000,
  training_hr_min: 90,
  training_hr_max: 110,
  updated_at: diasAtras(38),
};

// ── Medicações e adesão ────────────────────────────────────────────────

export const DEMO_MEDICATIONS: CardioMedication[] = [
  {
    id: "demo-med-1", patient_user_id: PACIENTE, prescribed_by: "demo-pro-001",
    name: "Losartana", med_class: "arb", dose: "50 mg", target_dose: "100 mg",
    schedule: ["08:00", "20:00"], started_at: dataDia(400), suspended_at: null,
    status: "active", titration_blocked_by: null,
    notes: "Trocada de enalapril por tosse.", updated_at: diasAtras(38),
  },
  {
    id: "demo-med-2", patient_user_id: PACIENTE, prescribed_by: "demo-pro-001",
    name: "Anlodipino", med_class: "ccb", dose: "5 mg", target_dose: "10 mg",
    schedule: ["08:00"], started_at: dataDia(120), suspended_at: null,
    status: "active", titration_blocked_by: "Edema de tornozelos no fim do dia",
    notes: null, updated_at: diasAtras(38),
  },
  {
    id: "demo-med-3", patient_user_id: PACIENTE, prescribed_by: "demo-pro-001",
    name: "Hidroclorotiazida", med_class: "thiazide", dose: "25 mg", target_dose: null,
    schedule: ["08:00"], started_at: dataDia(300), suspended_at: null,
    status: "active", titration_blocked_by: null, notes: null, updated_at: diasAtras(38),
  },
  {
    id: "demo-med-5", patient_user_id: PACIENTE, prescribed_by: "demo-pro-001",
    name: "Atorvastatina", med_class: "statin", dose: "40 mg", target_dose: "80 mg",
    schedule: ["20:00"], started_at: dataDia(400), suspended_at: null,
    status: "active", titration_blocked_by: null, notes: null, updated_at: diasAtras(38),
  },
];

/** 14 dias de adesão com algumas falhas — gera o alerta de adesão baixa. */
export const DEMO_INTAKES: MedicationIntake[] = DEMO_MEDICATIONS.flatMap((med) =>
  Array.from({ length: 14 }, (_, dia) =>
    med.schedule.map((hora, j) => {
      const seed = dia * 7 + j + med.id.length;
      const perdeu = ruido(seed, 1) > 0.55;
      return {
        id: `demo-intake-${med.id}-${dia}-${j}`,
        patient_user_id: PACIENTE,
        medication_id: med.id,
        intake_date: dataDia(dia),
        scheduled_time: hora,
        taken: !perdeu,
        taken_at: perdeu ? null : diasAtras(dia, Number(hora.slice(0, 2)), 10),
      } as MedicationIntake;
    })
  ).flat()
);

// ── Sintomas ───────────────────────────────────────────────────────────

export const DEMO_SYMPTOMS: SymptomReport[] = [
  {
    id: "demo-sym-1", patient_user_id: PACIENTE, symptom_type: "dyspnea",
    occurred_at: diasAtras(3, 19), intensity: 5, duration_minutes: 40,
    qualifiers: { nyha: 2, orthopnea: true, pillows: 2, nyha_change: 1 },
    triaged_as: "warning", notes: "Cansaço ao subir a rampa da garagem.",
    created_at: diasAtras(3, 19),
  },
  {
    id: "demo-sym-2", patient_user_id: PACIENTE, symptom_type: "edema",
    occurred_at: diasAtras(2, 21), intensity: 4, duration_minutes: null,
    qualifiers: { location: "tornozelos", pitting: true, period: "fim do dia" },
    triaged_as: "warning", notes: null, created_at: diasAtras(2, 21),
  },
  {
    id: "demo-sym-3", patient_user_id: PACIENTE, symptom_type: "palpitations",
    occurred_at: diasAtras(9, 15), intensity: 3, duration_minutes: 10,
    qualifiers: { onset: "súbito", rhythm: "irregular", syncope: false },
    triaged_as: "info", notes: null, created_at: diasAtras(9, 15),
  },
];

// ── Exames ─────────────────────────────────────────────────────────────

export const DEMO_LABS: LabResult[] = [
  { id: "l0", patient_user_id: PACIENTE, marker_key: "total_cholesterol", marker_label: "Colesterol total", value_num: 190, value_text: null, unit: "mg/dL", reference_text: "< 190", status: "attention", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l1", patient_user_id: PACIENTE, marker_key: "ldl", marker_label: "LDL colesterol", value_num: 78, value_text: null, unit: "mg/dL", reference_text: "Alvo < 70 (risco alto)", status: "attention", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l2", patient_user_id: PACIENTE, marker_key: "hdl", marker_label: "HDL colesterol", value_num: 41, value_text: null, unit: "mg/dL", reference_text: "> 40", status: "normal", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l3", patient_user_id: PACIENTE, marker_key: "triglycerides", marker_label: "Triglicérides", value_num: 186, value_text: null, unit: "mg/dL", reference_text: "< 150", status: "attention", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l4", patient_user_id: PACIENTE, marker_key: "creatinine", marker_label: "Creatinina", value_num: 1.18, value_text: null, unit: "mg/dL", reference_text: "0,7–1,3", status: "normal", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  // "TFG estimada (CKD-EPI)" dizia ao paciente exatamente nada: TFG é sigla e
  // CKD-EPI é o nome da fórmula usada no laboratório — informação de quem
  // calcula, não de quem lê. O nome do que o exame mede vem primeiro.
  { id: "l5", patient_user_id: PACIENTE, marker_key: "egfr", marker_label: "Função dos rins (filtração)", value_num: 68, value_text: null, unit: "mL/min/1,73m²", reference_text: "> 60", status: "normal", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l6", patient_user_id: PACIENTE, marker_key: "potassium", marker_label: "Potássio", value_num: 4.6, value_text: null, unit: "mEq/L", reference_text: "3,5–5,5", status: "normal", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l7", patient_user_id: PACIENTE, marker_key: "hba1c", marker_label: "Hemoglobina glicada", value_num: 5.9, value_text: null, unit: "%", reference_text: "< 5,7", status: "attention", collected_at: dataDia(25), file_url: null, created_at: diasAtras(25) },
  { id: "l9", patient_user_id: PACIENTE, marker_key: "lpa", marker_label: "Lipoproteína(a)", value_num: 88, value_text: null, unit: "nmol/L", reference_text: "< 75", status: "attention", collected_at: dataDia(200), file_url: null, created_at: diasAtras(200) },
];

/**
 * ── Como os achados de exame são escritos aqui (auditoria de setembro/2026) ──
 *
 * `findings` é `Record<string, …>` e a tela /exames imprime a CHAVE quando não
 * conhece o campo (`chave.replace(/_/g, " ")`). Resultado no demo: o paciente
 * lia "alteracoes st / ausentes" e "pct fc prevista / 91" — nome de coluna de
 * banco, sem acento, em minúsculas, na tela que ele já abre com medo.
 *
 * Duas regras passaram a valer para os dados de demonstração:
 *
 *  1. **A chave é sempre a técnica — quem traduz é a tela.** O demo escrevia
 *     o rótulo em português dentro da própria chave (`"Espessura da parede
 *     do coração (septo)"`) para escapar do nome de coluna. Isso resolvia a
 *     demonstração e deixava o exame REAL quebrado, que é o que o paciente
 *     abre depois. Agora `septo`, `alteracoes_st`, `pct_fc_prevista`, `esv`,
 *     `essv` e `tvns` estão no `CAMPO_LABEL` de /exames, e o demo volta a
 *     usar a chave técnica — assim ele exercita o mesmo caminho do dado real.
 *
 *  2. **Número de exame sem unidade não é número, é enigma.** "Átrio esquerdo
 *     40" pode ser milímetro, mililitro ou porcentagem. Onde a tela conhece a
 *     unidade do campo (`CAMPO_UNIDADE`), o dado fica NUMÉRICO e a unidade é
 *     escrita no render; onde não conhece, o valor carrega a unidade no texto.
 *     A sigla que o paciente vai OUVIR do médico (METs, extrassístole, ST)
 *     ganha a frase que a explica ao lado, escrita na tela e não no dado.
 *
 * `fevi` continua NUMÉRICO e sem unidade no dado: `educacao.ts` lê este campo
 * para montar a lição "o que é fração de ejeção" e escreve o "%" na frase.
 * Trocar por texto aqui apagaria a lição.
 */
export const DEMO_EXAMS: CardioExam[] = [
  {
    id: "e1", patient_user_id: PACIENTE, exam_type: "echocardiogram",
    performed_at: dataDia(60), performed_by: "Clínica do Coração",
    findings: {
      fevi: 61,
      metodo: "Simpson",
      atrio_esquerdo: "40 mm",
      septo: 12,
      psap: "28 mmHg",
      disfuncao_diastolica: "grau I (leve)",
    },
    conclusion: "Função sistólica preservada. Hipertrofia ventricular esquerda leve e disfunção diastólica grau I.",
    file_url: null, created_at: diasAtras(60),
  },
  {
    id: "e2", patient_user_id: PACIENTE, exam_type: "ecg",
    performed_at: dataDia(38), performed_by: "Consultório",
    findings: {
      ritmo: "sinusal (o ritmo normal do coração)",
      fc: "66 bpm",
      pr: "168 ms",
      qrs: "96 ms",
      qtc: "424 ms",
      alteracoes: "sobrecarga ventricular esquerda — a parede do coração está mais grossa do que o esperado",
    },
    conclusion: "Ritmo sinusal, sem sinais de isquemia aguda.", file_url: null, created_at: diasAtras(38),
  },
  {
    id: "e3", patient_user_id: PACIENTE, exam_type: "stress_test",
    performed_at: dataDia(75), performed_by: "Laboratório Cardio",
    findings: {
      protocolo: "Bruce",
      mets: 7.2,
      fc_max: "138 bpm",
      pct_fc_prevista: 91,
      pa_pico: "186/94 mmHg",
      duracao: "6 min 40 s",
      alteracoes_st: "nenhuma",
    },
    conclusion: "Teste sem isquemia induzida. Resposta pressórica exagerada ao esforço.",
    file_url: null, created_at: diasAtras(75),
  },
  {
    id: "e4", patient_user_id: PACIENTE, exam_type: "holter",
    performed_at: dataDia(90), performed_by: "Laboratório Cardio",
    findings: {
      fc_media: "71 bpm",
      fc_min: "48 bpm",
      fc_max: "128 bpm",
      pausas: "nenhuma",
      esv: 320,
      essv: 1100,
      tvns: "nenhum",
      fa_percentual: "0% do tempo",
    },
    conclusion: "Extrassistolia ventricular de baixa densidade, sem arritmias sustentadas.",
    file_url: null, created_at: diasAtras(90),
  },
];

// ── Alertas ────────────────────────────────────────────────────────────

export const DEMO_ALERTS: CardioAlert[] = [
  {
    id: "a1", patient_user_id: PACIENTE, professional_id: "demo-pro-001",
    rule_code: "pa_alta_sustentada", severity: "warning",
    title: "Pressão alta repetida", description: "3+ medidas acima do alvo em 7 dias — considerar reavaliação.",
    trigger_value: "4 medidas acima de 130/80", threshold_value: "3 medidas > 130/80 mmHg em 7 dias",
    is_read: false, is_dismissed: false, triggered_at: diasAtras(1, 8),
  },
  {
    id: "a2", patient_user_id: PACIENTE, professional_id: "demo-pro-001",
    rule_code: "adesao_baixa", severity: "warning",
    title: "Remédios em atraso", description: "Adesão < 80% em 14 dias.",
    trigger_value: "74% das doses", threshold_value: "< 80% das doses em 14 dias",
    is_read: false, is_dismissed: false, triggered_at: diasAtras(2, 9),
  },
  {
    id: "a3", patient_user_id: PACIENTE, professional_id: "demo-pro-001",
    rule_code: "spo2_noturna", severity: "warning",
    title: "Oxigenação caindo durante o sono", description: "Dessaturação noturna — rastrear apneia do sono.",
    trigger_value: "6,1% do sono < 90%", threshold_value: "≥ 5% do sono com SpO₂ < 90%",
    is_read: true, is_dismissed: false, triggered_at: diasAtras(4, 7),
  },
];

// ── Fila de pacientes do médico (painel) ───────────────────────────────

export interface DemoPatientRow {
  patient_user_id: string;
  full_name: string;
  age: number;
  condition: string;
  risk: RiskLevel;
  headline: string;
  lastReadingAt: string;
  bpAvg: string;
  restingHr: number;
  adherence: number;
  openAlerts: number;
  nextAppointment: string | null;
}

export const DEMO_PRO_PATIENTS: DemoPatientRow[] = [
  {
    patient_user_id: PACIENTE, full_name: "Antônio Ribeiro (Demo)", age: 68,
    condition: "HAS · dislipidemia · apneia do sono", risk: "red",
    headline: "Pressão alta repetida — 4 medidas acima do alvo",
    lastReadingAt: diasAtras(0, 7), bpAvg: "132/81", restingHr: 68,
    adherence: 0.74, openAlerts: 3, nextAppointment: null,
  },
  {
    patient_user_id: "demo-p2", full_name: "Marta Nogueira (Demo)", age: 61,
    condition: "HAS · DM2 · dislipidemia", risk: "yellow",
    headline: "Pressão alta repetida — 4 medidas acima do alvo",
    lastReadingAt: diasAtras(1, 20), bpAvg: "146/91", restingHr: 74,
    adherence: 0.93, openAlerts: 1, nextAppointment: diasAtras(-9, 14),
  },
  {
    patient_user_id: "demo-p3", full_name: "José Carlos Lima (Demo)", age: 74,
    condition: "FA permanente · anticoagulado", risk: "yellow",
    headline: "Ritmo irregular detectado — 4 episódios em 7 dias",
    lastReadingAt: diasAtras(0, 6), bpAvg: "128/78", restingHr: 88,
    adherence: 0.88, openAlerts: 2, nextAppointment: diasAtras(-3, 9),
  },
  {
    patient_user_id: "demo-p4", full_name: "Sueli Prado (Demo)", age: 57,
    condition: "Pós-IAM · prevenção secundária", risk: "green",
    headline: "Dentro dos alvos, com registros em dia.",
    lastReadingAt: diasAtras(0, 8), bpAvg: "122/76", restingHr: 64,
    adherence: 0.97, openAlerts: 0, nextAppointment: diasAtras(-21, 10),
  },
  {
    patient_user_id: "demo-p5", full_name: "Wilson Tavares (Demo)", age: 66,
    condition: "IC FEVE 40% · HAS", risk: "green",
    headline: "Peso estável, adesão em dia.",
    lastReadingAt: diasAtras(1, 7), bpAvg: "126/79", restingHr: 71,
    adherence: 0.91, openAlerts: 0, nextAppointment: diasAtras(-30, 11),
  },
  {
    patient_user_id: "demo-p6", full_name: "Rita Camargo (Demo)", age: 52,
    condition: "Hipertensão limítrofe", risk: "green",
    headline: "Sem registro há 11 dias.",
    lastReadingAt: diasAtras(11, 8), bpAvg: "131/82", restingHr: 76,
    adherence: 0.85, openAlerts: 1, nextAppointment: null,
  },
];

export const DEMO_APPOINTMENTS = [
  { id: "ap1", patient_user_id: PACIENTE, professional_id: "demo-pro-001", scheduled_at: diasAtras(-12, 14), kind: "consulta", status: "scheduled" as const, location: "Clínica Marcelo Puzzi — sala 3", notes: null, created_at: diasAtras(20) },
  { id: "ap2", patient_user_id: PACIENTE, professional_id: "demo-pro-001", scheduled_at: diasAtras(38, 14), kind: "consulta", status: "completed" as const, location: "Clínica Marcelo Puzzi — sala 3", notes: "Ajustada losartana para 50 mg 2×/dia.", created_at: diasAtras(60) },
];

export const DEMO_MESSAGES = [
  { id: "m1", patient_user_id: PACIENTE, sender_user_id: "demo-user-medico-001", sender: "doctor" as const, body: "Antônio, vi o peso subindo. Está com as pernas mais inchadas?", attachment_url: null, read_at: diasAtras(1, 10), created_at: diasAtras(1, 9) },
  // "doutora" era o terceiro nome do mesmo médico na demonstração: a marca
  // dizia Marcelo Puzzi, o perfil dizia Helena Prado e a conversa tratava por
  // ela. Um médico só, no masculino, igual ao DEV_PRO_PROFILE e à MARCA_DEMO.
  { id: "m2", patient_user_id: PACIENTE, sender_user_id: PACIENTE, sender: "patient" as const, body: "Sim doutor, no fim do dia fica marcado o elástico da meia.", attachment_url: null, read_at: null, created_at: diasAtras(1, 11) },
];

export const DEMO_DEVICES = [
  {
    id: "d1", patient_user_id: PACIENTE, display_name: "Pulseira H59 (Demo)",
    manufacturer: "Genérico", model: "H59", category: "h59", protocol: "ble" as const,
    vital_types: ["heart_rate", "spo2", "sleep", "steps"], last_sync_at: diasAtras(0, 7),
    status: "active" as const, created_at: diasAtras(40),
  },
  {
    id: "d2", patient_user_id: PACIENTE, display_name: "Aparelho de pressão de braço",
    manufacturer: "Omron", model: "HEM-7122", category: "bp_cuff", protocol: "manual" as const,
    vital_types: ["blood_pressure"], last_sync_at: diasAtras(0, 7),
    status: "active" as const, created_at: diasAtras(40),
  },
];

// ══════════════════════════════════════════════════════════════════════
// CAMADA DE ENGAJAMENTO (docs/ENGAJAMENTO-CARDIO.md)
// ══════════════════════════════════════════════════════════════════════

import type { TesteCapacidade } from "@/lib/clinical/capacity";
import type { RegistroSodio } from "@/lib/clinical/sodio";
import type {
  CaregiverLink, HeartAgeSnapshot, QolResponse, WalkSession, WellbeingCheckin,
} from "@/types/cardio";

/** Curva de capacidade subindo — é a prova visível de melhora (§2.3). */
export const DEMO_CAPACITY_TESTS: TesteCapacidade[] = [
  { id: "cap-1", patient_user_id: PACIENTE, tipo: "walk_6min", realizado_em: diasAtras(84, 10), valor: 380, borg: 5, fc_pico: 112, fc_final: 96, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(84, 10) },
  { id: "cap-2", patient_user_id: PACIENTE, tipo: "walk_6min", realizado_em: diasAtras(56, 10), valor: 412, borg: 4, fc_pico: 116, fc_final: 98, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(56, 10) },
  { id: "cap-3", patient_user_id: PACIENTE, tipo: "walk_6min", realizado_em: diasAtras(28, 10), valor: 445, borg: 4, fc_pico: 118, fc_final: 99, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(28, 10) },
  { id: "cap-4", patient_user_id: PACIENTE, tipo: "sit_to_stand_30s", realizado_em: diasAtras(56, 11), valor: 9, borg: 5, fc_pico: null, fc_final: null, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(56, 11) },
  { id: "cap-5", patient_user_id: PACIENTE, tipo: "sit_to_stand_30s", realizado_em: diasAtras(28, 11), valor: 12, borg: 4, fc_pico: null, fc_final: null, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(28, 11) },
  { id: "cap-6", patient_user_id: PACIENTE, tipo: "hr_recovery", realizado_em: diasAtras(28, 10), valor: 14, borg: null, fc_pico: 118, fc_final: 104, interrompido: false, motivo_interrupcao: null, observacao: null, created_at: diasAtras(28, 10) },
];

export const DEMO_WALK_SESSIONS: WalkSession[] = Array.from({ length: 9 }, (_, i) => {
  const dia = i * 2 + 1;
  const duracao = Math.round(1500 + ruido(i + 601, 400));
  return {
    id: `walk-${i}`,
    patient_user_id: PACIENTE,
    iniciada_em: diasAtras(dia, 17, 30),
    duracao_segundos: duracao,
    passos: Math.round(duracao * 1.6),
    distancia_m: Math.round(duracao * 1.15),
    fc_media: Math.round(96 + ruido(i + 631, 8)),
    fc_maxima: Math.round(112 + ruido(i + 661, 10)),
    zona_min: 90,
    zona_max: 110,
    segundos_na_zona: Math.round(duracao * (0.62 + ruido(i + 691, 0.2))),
    borg: 4,
    interrompida: false,
    motivo_interrupcao: null,
    created_at: diasAtras(dia, 18),
  };
});

export const DEMO_SODIUM: RegistroSodio[] = Array.from({ length: 10 }, (_, dia) =>
  [
    { refeicao: "cafe" as const, opcao: "leve", sodio_mg: 120 },
    { refeicao: "almoco" as const, opcao: dia % 3 === 0 ? "restaurante" : "caseira_normal", sodio_mg: dia % 3 === 0 ? 1400 : 900 },
    { refeicao: "jantar" as const, opcao: dia % 4 === 0 ? "embutidos" : "caseira_sem_sal", sodio_mg: dia % 4 === 0 ? 1200 : 400 },
  ].map((r, j) => ({
    id: `sod-${dia}-${j}`,
    patient_user_id: PACIENTE,
    dia: dataDia(dia),
    ...r,
    created_at: diasAtras(dia, 20),
  }))
).flat();

export const DEMO_HEART_AGE: HeartAgeSnapshot[] = [
  { id: "ha-1", patient_user_id: PACIENTE, calculado_em: diasAtras(180), idade_real: 68, idade_coracao: 85, risco_percentual: 38.2, entradas: {}, created_at: diasAtras(180) },
  { id: "ha-2", patient_user_id: PACIENTE, calculado_em: diasAtras(120), idade_real: 68, idade_coracao: 84, risco_percentual: 35.7, entradas: {}, created_at: diasAtras(120) },
  { id: "ha-3", patient_user_id: PACIENTE, calculado_em: diasAtras(60), idade_real: 68, idade_coracao: 82, risco_percentual: 32.4, entradas: {}, created_at: diasAtras(60) },
  { id: "ha-4", patient_user_id: PACIENTE, calculado_em: diasAtras(2), idade_real: 68, idade_coracao: 80, risco_percentual: 30.1, entradas: {}, created_at: diasAtras(2) },
];

export const DEMO_QOL: QolResponse[] = [
  { id: "qol-1", patient_user_id: PACIENTE, respondido_em: diasAtras(90), score: 54, respostas: {}, created_at: diasAtras(90) },
  { id: "qol-2", patient_user_id: PACIENTE, respondido_em: diasAtras(60), score: 61, respostas: {}, created_at: diasAtras(60) },
  { id: "qol-3", patient_user_id: PACIENTE, respondido_em: diasAtras(30), score: 68, respostas: {}, created_at: diasAtras(30) },
];

export const DEMO_CHECKINS: WellbeingCheckin[] = [
  { id: "ck-1", patient_user_id: PACIENTE, ocorrido_em: diasAtras(3, 20), desfecho: "avisar_medico", alarmes: [], como_se_sente: 5, espelho: {}, observacao: "Cansaço ao subir a rampa.", created_at: diasAtras(3, 20) },
  { id: "ck-2", patient_user_id: PACIENTE, ocorrido_em: diasAtras(12, 9), desfecho: "registrar", alarmes: [], como_se_sente: 8, espelho: {}, observacao: null, created_at: diasAtras(12, 9) },
];

export const DEMO_CAREGIVERS: CaregiverLink[] = [
  {
    id: "cg-1", patient_user_id: PACIENTE, caregiver_user_id: "demo-user-cuidador-001",
    caregiver_email: "filha@exemplo.com", caregiver_nome: "Beatriz (filha)", parentesco: "Filha",
    invite_code: null, status: "active", ver_medidas: true, ver_remedios: true,
    ver_sintomas: false, ver_exames: false, receber_alertas: true,
    aceito_em: diasAtras(35), revogado_em: null, created_at: diasAtras(36),
  },
];
