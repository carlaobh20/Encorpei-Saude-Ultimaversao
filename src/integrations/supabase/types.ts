/**
 * Tipos do banco — Encorpei Cardio.
 *
 * Escrito à mão a partir de supabase/migrations/20260909000000_cardio_baseline.sql.
 * Quando o projeto Supabase existir, isto pode ser substituído por
 * `supabase gen types typescript --project-id <id>` — os nomes batem.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string };

/** Row → Insert (chaves com default viram opcionais) e Update (tudo opcional). */
type Table<Row, Optional extends keyof Row = never> = {
  Row: Row;
  Insert: Omit<Row, Optional | "id" | "created_at"> & Partial<Pick<Row, Optional>> & { id?: string; created_at?: string };
  Update: Partial<Row>;
  Relationships: [];
};

// ── Linhas ───────────────────────────────────────────────────────────

export interface ProfileRow extends Timestamps {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  onboarding_completed: boolean;
  updated_at: string;
}

export interface ProfessionalProfileRow extends Timestamps {
  id: string;
  user_id: string;
  display_name: string;
  registration_number: string;
  registration_state: string;
  specialty: string;
  clinic_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  plan_type: "trial" | "consultorio" | "clinica" | "rede";
  max_patients: number;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  is_verified: boolean;
  updated_at: string;
}

export interface CardioPatientRow extends Timestamps {
  id: string;
  user_id: string;
  professional_id: string | null;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  sex: "male" | "female" | null;
  height_cm: number | null;
  smoking_status: "never" | "former" | "current" | null;
  pack_years: number | null;
  alcohol_units_week: number | null;
  comorbidities: Json;
  history: Json;
  allergies: string | null;
  intake: Json;
  risk_category: "low" | "moderate" | "high" | "very_high" | null;
  updated_at: string;
}

export interface LinkRow extends Timestamps {
  id: string;
  professional_id: string;
  patient_user_id: string | null;
  invite_code: string | null;
  status: "pending" | "active" | "paused" | "ended";
  notes: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface TargetsRow {
  id: string;
  patient_user_id: string;
  professional_id: string | null;
  bp_systolic_max: number;
  bp_diastolic_max: number;
  ldl_max: number;
  resting_hr_min: number;
  resting_hr_max: number;
  dry_weight_kg: number | null;
  steps_per_day: number;
  mvpa_minutes_week: number;
  sleep_hours: number;
  sodium_mg_day: number | null;
  training_hr_min: number | null;
  training_hr_max: number | null;
  updated_at: string;
}

interface Provenance {
  source_type: "manual" | "device" | "import" | "lab" | "system";
  source_device_id?: string | null;
  source_device_name?: string | null;
  entered_by: "paciente" | "medico" | "enfermeiro" | "sistema" | "device";
  entered_by_user_id?: string | null;
  validation_status: "validated" | "estimated" | "suspect" | "pending" | "rejected";
  validation_note?: string | null;
}

export interface BpRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  recorded_at: string;
  systolic: number;
  diastolic: number;
  pulse: number | null;
  context: "morning" | "evening" | "random" | "symptom" | "office";
  position: "seated" | "lying" | "standing" | null;
  arm: "left" | "right" | null;
  cuff_validated: boolean;
  notes: string | null;
}

export interface HrRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  recorded_at: string;
  bpm: number;
  context: "resting" | "active" | "sleeping" | "recovery" | null;
  irregular_flag: boolean | null;
  rmssd: number | null;
  sdnn: number | null;
}

export interface Spo2Row extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  recorded_at: string;
  value: number;
  context: "spot" | "sleep" | null;
  time_below_90_pct: number | null;
}

export interface WeightRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  recorded_at: string;
  value: number;
  notes: string | null;
}

export interface GlucoseRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  recorded_at: string;
  value: number;
  context: "fasting" | "post_meal" | "random" | "bedtime";
}

export interface SleepRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  sleep_date: string;
  recorded_at: string;
  total_minutes: number;
  deep_minutes: number | null;
  light_minutes: number | null;
  rem_minutes: number | null;
  awake_minutes: number | null;
  awakenings: number | null;
  efficiency_pct: number | null;
  min_heart_rate: number | null;
  min_spo2: number | null;
}

export interface ActivityRow extends Timestamps, Provenance {
  id: string;
  patient_user_id: string;
  activity_date: string;
  recorded_at: string;
  steps: number | null;
  distance_km: number | null;
  calories: number | null;
  moderate_minutes: number | null;
  vigorous_minutes: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
}

export interface SymptomRow extends Timestamps {
  id: string;
  patient_user_id: string;
  symptom_type: string;
  occurred_at: string;
  intensity: number | null;
  duration_minutes: number | null;
  qualifiers: Json;
  triaged_as: "info" | "warning" | "critical" | "emergency" | null;
  notes: string | null;
}

export interface MedicationRow extends Timestamps {
  id: string;
  patient_user_id: string;
  prescribed_by: string | null;
  name: string;
  med_class: string;
  dose: string;
  target_dose: string | null;
  schedule: string[];
  started_at: string | null;
  suspended_at: string | null;
  status: "active" | "suspended" | "finished";
  titration_blocked_by: string | null;
  notes: string | null;
  updated_at: string;
}

export interface IntakeRow extends Timestamps {
  id: string;
  patient_user_id: string;
  medication_id: string;
  intake_date: string;
  scheduled_time: string;
  taken: boolean;
  taken_at: string | null;
}

export interface TitrationRow extends Timestamps {
  id: string;
  medication_id: string;
  patient_user_id: string;
  professional_id: string | null;
  previous_dose: string | null;
  new_dose: string;
  reason: string | null;
}

export interface LabRow extends Timestamps {
  id: string;
  patient_user_id: string;
  marker_key: string;
  marker_label: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  reference_text: string | null;
  status: "normal" | "attention" | "critical" | null;
  collected_at: string | null;
  file_url: string | null;
}

export interface ExamRow extends Timestamps {
  id: string;
  patient_user_id: string;
  exam_type: string;
  performed_at: string | null;
  performed_by: string | null;
  findings: Json;
  conclusion: string | null;
  file_url: string | null;
}

export interface AlertRow {
  id: string;
  patient_user_id: string;
  professional_id: string | null;
  rule_code: string;
  severity: "info" | "warning" | "critical" | "emergency";
  title: string;
  description: string | null;
  trigger_value: string | null;
  threshold_value: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  triggered_at: string;
}

export interface AppointmentRow extends Timestamps {
  id: string;
  patient_user_id: string;
  professional_id: string | null;
  scheduled_at: string;
  kind: string;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  location: string | null;
  notes: string | null;
}

export interface MessageRow extends Timestamps {
  id: string;
  patient_user_id: string;
  sender_user_id: string;
  sender: "patient" | "doctor";
  body: string;
  attachment_url: string | null;
  read_at: string | null;
}

export interface DeviceRow extends Timestamps {
  id: string;
  patient_user_id: string;
  display_name: string;
  manufacturer: string | null;
  model: string | null;
  category: string;
  protocol: string;
  vital_types: string[];
  firmware: string | null;
  last_sync_at: string | null;
  status: string;
}

export interface NoteRow extends Timestamps {
  id: string;
  professional_id: string;
  patient_user_id: string;
  body: string;
}

export interface ConsentRow extends Timestamps {
  id: string;
  user_id: string;
  consent_type: string;
  document_version: string;
  status: "granted" | "revoked";
  context: string | null;
}

export interface FeedbackRow extends Timestamps {
  id: string;
  user_id: string;
  role: string;
  category: string | null;
  body: string;
  status: string;
  reply: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: "admin" | "moderator" | "user" | "professional";
}

export interface RawDeviceRow {
  id: string;
  patient_user_id: string;
  device_id: string | null;
  raw_payload: Json;
  payload_format: string | null;
  device_timestamp: string | null;
  received_at: string;
  processed: boolean;
  processing_error: string | null;
}

// ── Database ─────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, "onboarding_completed" | "updated_at">;
      user_roles: Table<UserRoleRow>;
      professional_profiles: Table<ProfessionalProfileRow, "plan_type" | "max_patients" | "approval_status" | "is_verified" | "updated_at" | "specialty">;
      cardio_patients: Table<CardioPatientRow, "comorbidities" | "history" | "intake" | "updated_at">;
      professional_patient_links: Table<LinkRow, "status">;
      cardio_targets: Table<TargetsRow, "updated_at">;
      registered_devices: Table<DeviceRow, "status" | "vital_types" | "category" | "protocol">;
      raw_device_data: Table<RawDeviceRow, "processed" | "received_at">;
      bp_readings: Table<BpRow, "recorded_at" | "context" | "cuff_validated" | "source_type" | "entered_by" | "validation_status">;
      hr_readings: Table<HrRow, "recorded_at" | "source_type" | "entered_by" | "validation_status">;
      spo2_readings: Table<Spo2Row, "recorded_at" | "source_type" | "entered_by" | "validation_status">;
      weight_readings: Table<WeightRow, "recorded_at" | "source_type" | "entered_by" | "validation_status">;
      glucose_readings: Table<GlucoseRow, "recorded_at" | "context" | "source_type" | "entered_by" | "validation_status">;
      sleep_records: Table<SleepRow, "recorded_at" | "source_type" | "entered_by" | "validation_status">;
      activity_records: Table<ActivityRow, "recorded_at" | "source_type" | "entered_by" | "validation_status">;
      symptom_reports: Table<SymptomRow, "occurred_at" | "qualifiers">;
      cardio_medications: Table<MedicationRow, "status" | "schedule" | "med_class" | "updated_at">;
      medication_intakes: Table<IntakeRow, "taken">;
      medication_titrations: Table<TitrationRow>;
      lab_results: Table<LabRow>;
      cardio_exams: Table<ExamRow, "findings">;
      cardio_alerts: Table<AlertRow, "severity" | "is_read" | "is_dismissed" | "triggered_at">;
      appointments: Table<AppointmentRow, "status" | "kind">;
      patient_messages: Table<MessageRow>;
      professional_notes: Table<NoteRow>;
      consent_records: Table<ConsentRow, "status">;
      feedback: Table<FeedbackRow, "status" | "role">;
      capacity_tests: Table<{
        id: string; patient_user_id: string; tipo: string; realizado_em: string; valor: number;
        borg: number | null; fc_pico: number | null; fc_final: number | null;
        interrompido: boolean; motivo_interrupcao: string | null; observacao: string | null;
        source_type: string; validation_status: string; created_at: string;
      }, "realizado_em" | "interrompido" | "source_type" | "validation_status">;
      walk_sessions: Table<{
        id: string; patient_user_id: string; iniciada_em: string; duracao_segundos: number;
        passos: number | null; distancia_m: number | null; fc_media: number | null; fc_maxima: number | null;
        zona_min: number | null; zona_max: number | null; segundos_na_zona: number | null;
        borg: number | null; interrompida: boolean; motivo_interrupcao: string | null; created_at: string;
      }, "iniciada_em" | "duracao_segundos" | "interrompida">;
      sodium_entries: Table<{
        id: string; patient_user_id: string; dia: string; refeicao: string; opcao: string;
        sodio_mg: number; created_at: string;
      }>;
      wellbeing_checkins: Table<{
        id: string; patient_user_id: string; ocorrido_em: string; desfecho: string;
        alarmes: string[]; como_se_sente: number | null; espelho: Json; observacao: string | null; created_at: string;
      }, "ocorrido_em" | "alarmes" | "espelho">;
      qol_responses: Table<{
        id: string; patient_user_id: string; respondido_em: string; score: number; respostas: Json; created_at: string;
      }, "respondido_em" | "respostas">;
      heart_age_snapshots: Table<{
        id: string; patient_user_id: string; calculado_em: string; idade_real: number; idade_coracao: number;
        risco_percentual: number | null; entradas: Json; created_at: string;
      }, "calculado_em" | "entradas">;
      education_progress: Table<{
        id: string; patient_user_id: string; licao_id: string; lida_em: string; util: boolean | null; created_at: string;
      }, "lida_em">;
      caregiver_links: Table<{
        id: string; patient_user_id: string; caregiver_user_id: string | null; caregiver_email: string | null;
        caregiver_nome: string; parentesco: string | null; invite_code: string | null; status: string;
        ver_medidas: boolean; ver_remedios: boolean; ver_sintomas: boolean; ver_exames: boolean;
        receber_alertas: boolean; aceito_em: string | null; revogado_em: string | null; created_at: string;
      }, "status" | "ver_medidas" | "ver_remedios" | "ver_sintomas" | "ver_exames" | "receber_alertas">;
      audit_logs: Table<{
        id: string; action: string; risk_level: string; actor_id: string; actor_role: string;
        patient_user_id: string | null; resource_type: string | null; resource_id: string | null;
        description: string; metadata: Json; created_at: string;
      }, "risk_level" | "metadata">;
    };
    Views: Record<string, never>;
    Functions: {
      is_linked_professional: { Args: { _patient_user_id: string; _professional_user_id: string }; Returns: boolean };
      is_active_caregiver: { Args: { _patient_user_id: string; _caregiver_user_id: string }; Returns: boolean };
      has_role: { Args: { _user_id: string; _role: string }; Returns: boolean };
      log_audit_event: {
        Args: {
          p_action: string; p_actor_id: string; p_actor_role: string; p_description: string;
          p_patient_user_id?: string; p_resource_type?: string; p_resource_id?: string; p_metadata?: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user" | "professional";
      link_status: "pending" | "active" | "paused" | "ended";
      alert_severity: "info" | "warning" | "critical" | "emergency";
      approval_status: "pending" | "approved" | "rejected";
      professional_plan: "trial" | "consultorio" | "clinica" | "rede";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
