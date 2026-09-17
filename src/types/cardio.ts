/**
 * ══════════════════════════════════════════════════════════════════════
 * TIPOS DO DOMÍNIO CARDIOLÓGICO — Encorpei Cardio
 * ══════════════════════════════════════════════════════════════════════
 *
 * Toda leitura clínica carrega proveniência (quem/o quê gerou o número) e
 * status de validação. Isso não é burocracia: é o que permite a regra
 * "estimativa de pulseira não titula remédio" existir no código, e não só
 * na cabeça de quem escreveu.
 *
 * Ver docs/MAPEAMENTO-CARDIO.md §4.
 */

// ── Proveniência ─────────────────────────────────────────────────────

/** De onde veio o dado. */
export type DataSourceType = "manual" | "device" | "import" | "lab" | "system";

/** Quem registrou. */
export type EnteredByRole = "paciente" | "medico" | "enfermeiro" | "sistema" | "device";

/**
 * Confiabilidade do número.
 * - `validated`  medida por método aceito (manguito validado, laboratório, exame)
 * - `estimated`  estimativa de sensor sem validação clínica (PA por PPG da pulseira)
 * - `suspect`    fora de faixa fisiológica plausível
 * - `pending`    aguardando revisão do profissional
 * - `rejected`   descartada pelo profissional
 */
export type ValidationStatus = "validated" | "estimated" | "suspect" | "pending" | "rejected";

export type Severity = "info" | "warning" | "critical" | "emergency";

/** Semáforo do paciente na fila do médico. */
export type RiskLevel = "green" | "yellow" | "red";

// ── Tipos de medida ──────────────────────────────────────────────────

export type VitalType =
  | "blood_pressure"
  | "heart_rate"
  | "hrv"
  | "spo2"
  | "weight"
  | "temperature"
  | "glucose"
  | "steps"
  | "activity_minutes"
  | "sleep"
  | "waist_circumference";

export interface ClinicalReadingBase {
  id: string;
  patient_user_id: string;
  vital_type: VitalType;
  /** Momento da medida (ISO 8601). */
  recorded_at: string;
  created_at: string;

  source_type: DataSourceType;
  source_device_id?: string | null;
  source_device_name?: string | null;
  entered_by: EnteredByRole;
  entered_by_user_id?: string | null;

  validation_status: ValidationStatus;
  validated_by?: string | null;
  validated_at?: string | null;
  validation_note?: string | null;

  notes?: string | null;
}

/** Contexto da aferição de PA — importante para MRPA. */
export type BpContext = "morning" | "evening" | "random" | "symptom" | "office";

export interface BloodPressureReading extends ClinicalReadingBase {
  vital_type: "blood_pressure";
  systolic: number;
  diastolic: number;
  pulse?: number | null;
  context: BpContext;
  position?: "seated" | "lying" | "standing" | null;
  arm?: "left" | "right" | null;
  /** Aparelho de braço validado? Só `true` entra em média de MRPA e alerta. */
  cuff_validated: boolean;
}

export interface HeartRateReading extends ClinicalReadingBase {
  vital_type: "heart_rate";
  bpm: number;
  context?: "resting" | "active" | "sleeping" | "recovery" | null;
  /** Sinalização de ritmo irregular pelo dispositivo (rastreio, não diagnóstico). */
  irregular_flag?: boolean | null;
}

export interface HrvReading extends ClinicalReadingBase {
  vital_type: "hrv";
  /** ms */
  rmssd?: number | null;
  /** ms */
  sdnn?: number | null;
}

export interface Spo2Reading extends ClinicalReadingBase {
  vital_type: "spo2";
  /** % */
  value: number;
  context?: "spot" | "sleep" | null;
  /** % do período de sono abaixo de 90% (quando context = sleep). */
  time_below_90_pct?: number | null;
}

export interface WeightReading extends ClinicalReadingBase {
  vital_type: "weight";
  /** kg */
  value: number;
}

export interface GlucoseReading extends ClinicalReadingBase {
  vital_type: "glucose";
  /** mg/dL */
  value: number;
  context: "fasting" | "post_meal" | "random" | "bedtime";
}

export interface SleepReading extends ClinicalReadingBase {
  vital_type: "sleep";
  /** Data da noite (o "dia do sono"), YYYY-MM-DD. */
  sleep_date: string;
  total_minutes: number;
  deep_minutes?: number | null;
  light_minutes?: number | null;
  rem_minutes?: number | null;
  awake_minutes?: number | null;
  awakenings?: number | null;
  /** % tempo dormindo / tempo na cama */
  efficiency_pct?: number | null;
  /** FC mínima durante o sono */
  min_heart_rate?: number | null;
  /** SpO2 mínima durante o sono */
  min_spo2?: number | null;
}

export interface ActivityReading extends ClinicalReadingBase {
  vital_type: "steps" | "activity_minutes";
  /** Dia da atividade, YYYY-MM-DD. */
  activity_date: string;
  steps?: number | null;
  distance_km?: number | null;
  calories?: number | null;
  /** Minutos em intensidade moderada-a-vigorosa (MVPA). */
  moderate_minutes?: number | null;
  vigorous_minutes?: number | null;
  /** FC média e máxima do dia. */
  avg_heart_rate?: number | null;
  max_heart_rate?: number | null;
}

export type AnyReading =
  | BloodPressureReading
  | HeartRateReading
  | HrvReading
  | Spo2Reading
  | WeightReading
  | GlucoseReading
  | SleepReading
  | ActivityReading;

// ── Perfil clínico do paciente ───────────────────────────────────────

export type SmokingStatus = "never" | "former" | "current";

export interface CardioComorbidities {
  hypertension?: boolean;
  diabetes?: boolean;
  dyslipidemia?: boolean;
  ckd?: boolean;
  /** Taxa de filtração glomerular estimada, mL/min/1,73m² */
  egfr?: number | null;
  sleep_apnea?: boolean;
  obesity?: boolean;
  hypothyroidism?: boolean;
  copd?: boolean;
}

export interface CardioHistory {
  previous_mi?: boolean;
  stable_angina?: boolean;
  heart_failure?: boolean;
  /** Fração de ejeção do VE, % */
  lvef?: number | null;
  nyha_class?: 1 | 2 | 3 | 4 | null;
  atrial_fibrillation?: boolean;
  valve_disease?: boolean;
  cardiomyopathy?: boolean;
  pad?: boolean;
  stroke_tia?: boolean;
  /** Procedimentos: angioplastia, CRM, ablação, marcapasso/CDI/TRC */
  pci?: boolean;
  cabg?: boolean;
  ablation?: boolean;
  device_implant?: "pacemaker" | "icd" | "crt" | null;
  family_early_cad?: boolean;
}

/**
 * Campos leves do cadastro progressivo que não entram no motor de risco.
 * Mora em `cardio_patients.intake` (JSONB) para não virar uma coluna por chip.
 */
export interface CardioIntake {
  goals?: string[];
  target_kg?: number | null;
  sleep_hours_usual?: number | null;
  physically_active?: boolean | null;
  activity_note?: string | null;
}

export interface CardioPatient {
  id: string;
  user_id: string;
  professional_id?: string | null;
  full_name: string;
  phone?: string | null;
  birth_date?: string | null;
  /** Usado nos escores de risco. */
  sex?: "male" | "female" | null;
  height_cm?: number | null;
  smoking_status?: SmokingStatus | null;
  pack_years?: number | null;
  alcohol_units_week?: number | null;
  comorbidities?: CardioComorbidities | null;
  history?: CardioHistory | null;
  allergies?: string | null;
  /** Objetivo, sono habitual e movimento — ver CadastroProgressivo. */
  intake?: CardioIntake | null;
  /** Categoria de risco definida pelo cardiologista. */
  risk_category?: "low" | "moderate" | "high" | "very_high" | null;
  created_at: string;
  updated_at: string;
}

// ── Metas terapêuticas (o eixo do produto) ───────────────────────────

export interface CardioTargets {
  id: string;
  patient_user_id: string;
  professional_id?: string | null;
  /** mmHg */
  bp_systolic_max: number;
  bp_diastolic_max: number;
  /** mg/dL — varia por estrato de risco (<70 / <55 / <40) */
  ldl_max: number;
  /** bpm em repouso */
  resting_hr_min: number;
  resting_hr_max: number;
  /** kg — peso seco na IC; ganho acima dispara alerta */
  dry_weight_kg?: number | null;
  steps_per_day: number;
  /** minutos de MVPA por semana (diretriz: 150) */
  mvpa_minutes_week: number;
  /** horas de sono */
  sleep_hours: number;
  /** mg de sódio por dia */
  sodium_mg_day?: number | null;
  /**
   * Faixa de frequência para exercício — definida pelo MÉDICO.
   * Sem ela a caminhada guiada roda sem faixa-alvo: prescrever intensidade de
   * esforço para cardiopata é conduta clínica (docs/ENGAJAMENTO-CARDIO.md §6.3).
   */
  training_hr_min?: number | null;
  training_hr_max?: number | null;
  updated_at: string;
}

// ── Medicações e adesão ──────────────────────────────────────────────

export type MedClass =
  | "acei" | "arb" | "arni" | "beta_blocker" | "ccb" | "sglt2" | "mra"
  | "loop_diuretic" | "thiazide" | "statin" | "ezetimibe" | "pcsk9"
  | "antiplatelet" | "anticoagulant" | "antiarrhythmic" | "nitrate" | "other";

export interface CardioMedication {
  id: string;
  patient_user_id: string;
  prescribed_by?: string | null;
  name: string;
  med_class: MedClass;
  /** Dose atual, ex. "25 mg" */
  dose: string;
  /** Dose-alvo da titulação, quando existe. */
  target_dose?: string | null;
  /** Horários: ["08:00","20:00"] */
  schedule: string[];
  started_at?: string | null;
  suspended_at?: string | null;
  status: "active" | "suspended" | "finished";
  /** Motivo de não subir a dose (hipotensão, K+, creatinina, bradicardia...) */
  titration_blocked_by?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface MedicationIntake {
  id: string;
  patient_user_id: string;
  medication_id: string;
  /** YYYY-MM-DD */
  intake_date: string;
  scheduled_time: string;
  taken: boolean;
  taken_at?: string | null;
}

// ── Sintomas ─────────────────────────────────────────────────────────

export type SymptomType =
  | "chest_pain" | "dyspnea" | "palpitations" | "edema"
  | "syncope" | "presyncope" | "claudication" | "dry_cough" | "fatigue" | "dizziness";

export interface SymptomReport {
  id: string;
  patient_user_id: string;
  symptom_type: SymptomType;
  occurred_at: string;
  /** 0–10 */
  intensity?: number | null;
  duration_minutes?: number | null;
  /** Qualificadores específicos do sintoma (ver docs §2.3). */
  qualifiers: Record<string, string | number | boolean>;
  /** Preenchido quando o triage do app classificou como emergência. */
  triaged_as?: Severity | null;
  notes?: string | null;
  created_at: string;
}

// ── Exames ───────────────────────────────────────────────────────────

export type LabMarkerKey =
  | "total_cholesterol" | "ldl" | "hdl" | "triglycerides" | "non_hdl" | "apob" | "lpa"
  | "glucose" | "hba1c" | "creatinine" | "egfr" | "urea" | "sodium" | "potassium"
  | "magnesium" | "nt_probnp" | "troponin" | "tsh" | "t4" | "hemoglobin" | "uric_acid"
  | "ast" | "alt" | "ck" | "albumin_creatinine_ratio" | "vitamin_d" | "inr";

export interface LabResult {
  id: string;
  patient_user_id: string;
  marker_key: LabMarkerKey;
  marker_label: string;
  value_num?: number | null;
  value_text?: string | null;
  unit?: string | null;
  reference_text?: string | null;
  collected_at?: string | null;
  /** Calculado contra a faixa de referência e a meta do paciente. */
  status?: "normal" | "attention" | "critical" | null;
  file_url?: string | null;
  created_at: string;
}

export type CardioExamType =
  | "ecg" | "echocardiogram" | "stress_test" | "holter" | "abpm"
  | "coronary_ct" | "myocardial_spect" | "cardiac_mri" | "catheterization" | "carotid_doppler";

export interface CardioExam {
  id: string;
  patient_user_id: string;
  exam_type: CardioExamType;
  performed_at?: string | null;
  performed_by?: string | null;
  /** Campos estruturados por tipo de exame (ver docs §2.5). */
  findings: Record<string, string | number | null>;
  conclusion?: string | null;
  file_url?: string | null;
  created_at: string;
}

// ── Alertas ──────────────────────────────────────────────────────────

export interface CardioAlert {
  id: string;
  patient_user_id: string;
  professional_id?: string | null;
  rule_code: string;
  severity: Severity;
  title: string;
  description: string;
  trigger_value?: string | null;
  threshold_value?: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  triggered_at: string;
}

// ── Dispositivos ─────────────────────────────────────────────────────

export interface RegisteredDevice {
  id: string;
  patient_user_id: string;
  display_name: string;
  manufacturer?: string | null;
  model?: string | null;
  /** "h59" | "bp_cuff" | "scale" | "glucometer" | "phone" */
  category: string;
  protocol: "ble" | "health_connect" | "healthkit" | "import" | "manual";
  vital_types: VitalType[];
  last_sync_at?: string | null;
  status: "active" | "inactive";
  created_at: string;
}


// ── Camada de engajamento (docs/ENGAJAMENTO-CARDIO.md) ───────────────

export interface WalkSession {
  id: string;
  patient_user_id: string;
  iniciada_em: string;
  duracao_segundos: number;
  passos?: number | null;
  distancia_m?: number | null;
  fc_media?: number | null;
  fc_maxima?: number | null;
  /** Faixa vigente no momento da sessão — guardada para o histórico não mentir
   *  depois que o médico mudar a prescrição. */
  zona_min?: number | null;
  zona_max?: number | null;
  segundos_na_zona?: number | null;
  borg?: number | null;
  interrompida: boolean;
  motivo_interrupcao?: string | null;
  created_at: string;
}

export interface WellbeingCheckin {
  id: string;
  patient_user_id: string;
  ocorrido_em: string;
  desfecho: "emergencia" | "avisar_medico" | "registrar";
  alarmes: string[];
  como_se_sente?: number | null;
  espelho: Record<string, unknown>;
  observacao?: string | null;
  created_at: string;
}

export interface QolResponse {
  id: string;
  patient_user_id: string;
  respondido_em: string;
  /** 0–100. Quanto maior, melhor a qualidade de vida relatada. */
  score: number;
  respostas: Record<string, number>;
  created_at: string;
}

export interface HeartAgeSnapshot {
  id: string;
  patient_user_id: string;
  calculado_em: string;
  idade_real: number;
  idade_coracao: number;
  risco_percentual?: number | null;
  entradas: Record<string, unknown>;
  created_at: string;
}

export interface EducationProgress {
  id: string;
  patient_user_id: string;
  licao_id: string;
  lida_em: string;
  util?: boolean | null;
  created_at: string;
}

export interface CaregiverLink {
  id: string;
  patient_user_id: string;
  caregiver_user_id?: string | null;
  caregiver_email?: string | null;
  caregiver_nome: string;
  parentesco?: string | null;
  invite_code?: string | null;
  status: "pending" | "active" | "revoked";
  ver_medidas: boolean;
  ver_remedios: boolean;
  ver_sintomas: boolean;
  ver_exames: boolean;
  receber_alertas: boolean;
  aceito_em?: string | null;
  revogado_em?: string | null;
  created_at: string;
}
