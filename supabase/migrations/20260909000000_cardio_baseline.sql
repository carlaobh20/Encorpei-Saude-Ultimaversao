-- ============================================================================
-- ENCORPEI CARDIO — schema base
-- Rodar no SQL Editor do Supabase, do começo ao fim, em um projeto novo.
-- ============================================================================
-- Princípios:
--  1. RLS ligada em TUDO. Paciente vê o seu; médico vê o de quem está
--     vinculado a ele com status 'active'; ninguém mais vê nada.
--  2. Toda leitura clínica carrega proveniência (source_type, device,
--     validation_status). Ver docs/MAPEAMENTO-CARDIO.md §4.
--  3. Consentimento e auditoria são append-only (LGPD art. 8, 11 e 18).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── Enums ───────────────────────────────────────────────────────────────────

do $$ begin
  create type app_role            as enum ('admin','moderator','user','professional');
  create type link_status         as enum ('pending','active','paused','ended');
  create type alert_severity      as enum ('info','warning','critical','emergency');
  create type approval_status     as enum ('pending','approved','rejected');
  create type professional_plan   as enum ('trial','consultorio','clinica','rede');
  create type data_source_type    as enum ('manual','device','import','lab','system');
  create type validation_status   as enum ('validated','estimated','suspect','pending','rejected');
  create type entered_by_role     as enum ('paciente','medico','enfermeiro','sistema','device');
  create type med_status          as enum ('active','suspended','finished');
exception when duplicate_object then null; end $$;

-- ── Perfis ──────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users(id) on delete cascade,
  full_name     text,
  phone         text,
  avatar_url    text,
  birth_date    date,
  sex           text check (sex in ('male','female')),
  height_cm     numeric(5,1),
  onboarding_completed boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    app_role not null,
  unique (user_id, role)
);

create table if not exists public.professional_profiles (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null unique references auth.users(id) on delete cascade,
  display_name        text not null,
  registration_number text not null,          -- CRM
  registration_state  text not null,          -- UF
  specialty           text not null default 'cardiologist',
  clinic_name         text,
  bio                 text,
  avatar_url          text,
  plan_type           professional_plan not null default 'trial',
  max_patients        integer not null default 20,
  approval_status     approval_status not null default 'pending',
  rejection_reason    text,
  is_verified         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── Paciente cardiológico ───────────────────────────────────────────────────

create table if not exists public.cardio_patients (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references auth.users(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  full_name       text not null,
  phone           text,
  birth_date      date,
  sex             text check (sex in ('male','female')),
  height_cm       numeric(5,1),
  smoking_status  text check (smoking_status in ('never','former','current')),
  pack_years      numeric(5,1),
  alcohol_units_week numeric(5,1),
  -- Comorbidades e história cardiológica em JSONB: o conjunto muda com a
  -- prática clínica e não vale uma migração por checkbox novo.
  comorbidities   jsonb not null default '{}',
  history         jsonb not null default '{}',
  allergies       text,
  risk_category   text check (risk_category in ('low','moderate','high','very_high')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_cardio_patients_prof on public.cardio_patients(professional_id);

-- ── Vínculo médico ↔ paciente (herdado do Mamãe, funciona) ──────────────────

create table if not exists public.professional_patient_links (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references public.professional_profiles(id) on delete cascade,
  patient_user_id  uuid references auth.users(id) on delete cascade,
  invite_code      text unique,
  status           link_status not null default 'pending',
  notes            text,
  started_at       timestamptz,
  ended_at         timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_links_prof    on public.professional_patient_links(professional_id, status);
create index if not exists idx_links_patient on public.professional_patient_links(patient_user_id, status);

-- Função de apoio usada por várias policies. SECURITY DEFINER para não
-- recursar na RLS da própria tabela de vínculos.
create or replace function public.is_linked_professional(_patient_user_id uuid, _professional_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from professional_patient_links l
      join professional_profiles p on p.id = l.professional_id
     where l.patient_user_id = _patient_user_id
       and p.user_id = _professional_user_id
       and l.status = 'active'
  );
$$;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = _user_id and role = _role);
$$;

-- ── Metas terapêuticas ──────────────────────────────────────────────────────

create table if not exists public.cardio_targets (
  id                 uuid primary key default gen_random_uuid(),
  patient_user_id    uuid not null unique references auth.users(id) on delete cascade,
  professional_id    uuid references public.professional_profiles(id) on delete set null,
  bp_systolic_max    smallint not null default 130,
  bp_diastolic_max   smallint not null default 80,
  ldl_max            smallint not null default 100,
  resting_hr_min     smallint not null default 50,
  resting_hr_max     smallint not null default 80,
  dry_weight_kg      numeric(5,1),
  steps_per_day      integer  not null default 7000,
  mvpa_minutes_week  integer  not null default 150,
  sleep_hours        numeric(3,1) not null default 7,
  sodium_mg_day      integer default 2000,
  updated_at         timestamptz not null default now()
);

-- ── Dispositivos e dados crus ───────────────────────────────────────────────

create table if not exists public.registered_devices (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  display_name    text not null,
  manufacturer    text,
  model           text,
  category        text not null default 'h59',      -- h59 | bp_cuff | scale | glucometer
  protocol        text not null default 'ble',      -- ble | health_connect | healthkit | import | manual
  vital_types     text[] not null default '{}',
  firmware        text,
  last_sync_at    timestamptz,
  status          text not null default 'active',
  created_at      timestamptz not null default now()
);
create index if not exists idx_devices_patient on public.registered_devices(patient_user_id, status);

-- Pacote proprietário que ainda não sabemos decodificar fica guardado cru.
-- Quando o SDK do fabricante chegar, reprocessa-se o histórico.
create table if not exists public.raw_device_data (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  device_id         uuid references public.registered_devices(id) on delete set null,
  raw_payload       jsonb not null,
  payload_format    text,
  device_timestamp  timestamptz,
  received_at       timestamptz not null default now(),
  processed         boolean not null default false,
  processing_error  text
);
create index if not exists idx_raw_unprocessed on public.raw_device_data(processed, received_at desc) where processed = false;

-- ── Leituras clínicas ───────────────────────────────────────────────────────
-- Colunas de proveniência repetidas em cada tabela de leitura. É deliberado:
-- tabela única com JSONB torna consulta por faixa de valor lenta e o gráfico
-- do médico é justamente consulta por faixa.

create table if not exists public.bp_readings (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  systolic          smallint not null check (systolic between 50 and 300),
  diastolic         smallint not null check (diastolic between 30 and 200),
  pulse             smallint check (pulse between 20 and 250),
  context           text not null default 'random' check (context in ('morning','evening','random','symptom','office')),
  position          text check (position in ('seated','lying','standing')),
  arm               text check (arm in ('left','right')),
  -- Só medida de manguito validado entra em MRPA e dispara alerta (docs §4).
  cuff_validated    boolean not null default true,
  source_type       data_source_type  not null default 'manual',
  source_device_id  uuid references public.registered_devices(id) on delete set null,
  source_device_name text,
  entered_by        entered_by_role   not null default 'paciente',
  entered_by_user_id uuid references auth.users(id) on delete set null,
  validation_status validation_status not null default 'validated',
  validation_note   text,
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_bp_patient on public.bp_readings(patient_user_id, recorded_at desc);

create table if not exists public.hr_readings (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  bpm               smallint not null check (bpm between 20 and 260),
  context           text check (context in ('resting','active','sleeping','recovery')),
  irregular_flag    boolean,
  rmssd             numeric(6,1),
  sdnn              numeric(6,1),
  source_type       data_source_type  not null default 'device',
  source_device_id  uuid references public.registered_devices(id) on delete set null,
  source_device_name text,
  entered_by        entered_by_role   not null default 'device',
  validation_status validation_status not null default 'validated',
  created_at        timestamptz not null default now()
);
create index if not exists idx_hr_patient on public.hr_readings(patient_user_id, recorded_at desc);

create table if not exists public.spo2_readings (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  value             smallint not null check (value between 50 and 100),
  context           text check (context in ('spot','sleep')),
  time_below_90_pct numeric(5,2),
  source_type       data_source_type  not null default 'device',
  source_device_id  uuid references public.registered_devices(id) on delete set null,
  source_device_name text,
  entered_by        entered_by_role   not null default 'device',
  validation_status validation_status not null default 'validated',
  created_at        timestamptz not null default now()
);
create index if not exists idx_spo2_patient on public.spo2_readings(patient_user_id, recorded_at desc);

create table if not exists public.weight_readings (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  value             numeric(5,1) not null check (value between 20 and 400),
  source_type       data_source_type  not null default 'manual',
  entered_by        entered_by_role   not null default 'paciente',
  validation_status validation_status not null default 'validated',
  notes             text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_weight_patient on public.weight_readings(patient_user_id, recorded_at desc);

create table if not exists public.glucose_readings (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  recorded_at       timestamptz not null default now(),
  value             smallint not null check (value between 20 and 700),
  context           text not null default 'random' check (context in ('fasting','post_meal','random','bedtime')),
  source_type       data_source_type  not null default 'manual',
  entered_by        entered_by_role   not null default 'paciente',
  validation_status validation_status not null default 'validated',
  created_at        timestamptz not null default now()
);
create index if not exists idx_glucose_patient on public.glucose_readings(patient_user_id, recorded_at desc);

create table if not exists public.sleep_records (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  sleep_date        date not null,
  recorded_at       timestamptz not null default now(),
  total_minutes     integer not null,
  deep_minutes      integer,
  light_minutes     integer,
  rem_minutes       integer,
  awake_minutes     integer,
  awakenings        smallint,
  efficiency_pct    numeric(5,2),
  min_heart_rate    smallint,
  min_spo2          smallint,
  source_type       data_source_type  not null default 'device',
  source_device_id  uuid references public.registered_devices(id) on delete set null,
  source_device_name text,
  entered_by        entered_by_role   not null default 'device',
  validation_status validation_status not null default 'validated',
  created_at        timestamptz not null default now(),
  unique (patient_user_id, sleep_date)
);
create index if not exists idx_sleep_patient on public.sleep_records(patient_user_id, sleep_date desc);

create table if not exists public.activity_records (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  activity_date     date not null,
  recorded_at       timestamptz not null default now(),
  steps             integer,
  distance_km       numeric(6,2),
  calories          integer,
  moderate_minutes  integer,
  vigorous_minutes  integer,
  avg_heart_rate    smallint,
  max_heart_rate    smallint,
  source_type       data_source_type  not null default 'device',
  source_device_id  uuid references public.registered_devices(id) on delete set null,
  source_device_name text,
  entered_by        entered_by_role   not null default 'device',
  validation_status validation_status not null default 'validated',
  created_at        timestamptz not null default now(),
  unique (patient_user_id, activity_date)
);
create index if not exists idx_activity_patient on public.activity_records(patient_user_id, activity_date desc);

-- ── Sintomas ────────────────────────────────────────────────────────────────

create table if not exists public.symptom_reports (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  symptom_type    text not null,
  occurred_at     timestamptz not null default now(),
  intensity       smallint check (intensity between 0 and 10),
  duration_minutes integer,
  qualifiers      jsonb not null default '{}',
  triaged_as      alert_severity,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_symptoms_patient on public.symptom_reports(patient_user_id, occurred_at desc);

-- ── Medicações e adesão ─────────────────────────────────────────────────────

create table if not exists public.cardio_medications (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  prescribed_by     uuid references public.professional_profiles(id) on delete set null,
  name              text not null,
  med_class         text not null default 'other',
  dose              text not null,
  target_dose       text,
  schedule          text[] not null default '{}',
  started_at        date,
  suspended_at      date,
  status            med_status not null default 'active',
  titration_blocked_by text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_meds_patient on public.cardio_medications(patient_user_id, status);

create table if not exists public.medication_intakes (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  medication_id   uuid not null references public.cardio_medications(id) on delete cascade,
  intake_date     date not null,
  scheduled_time  text not null,
  taken           boolean not null default false,
  taken_at        timestamptz,
  created_at      timestamptz not null default now(),
  unique (medication_id, intake_date, scheduled_time)
);
create index if not exists idx_intakes_patient on public.medication_intakes(patient_user_id, intake_date desc);

-- Histórico de titulação: a mudança de dose é o ato clínico central. Guardar
-- só o valor atual apaga exatamente a informação que o médico precisa rever.
create table if not exists public.medication_titrations (
  id              uuid primary key default gen_random_uuid(),
  medication_id   uuid not null references public.cardio_medications(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  previous_dose   text,
  new_dose        text not null,
  reason          text,
  created_at      timestamptz not null default now()
);

-- ── Exames ──────────────────────────────────────────────────────────────────

create table if not exists public.lab_results (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  marker_key      text not null,
  marker_label    text not null,
  value_num       numeric(10,2),
  value_text      text,
  unit            text,
  reference_text  text,
  status          text check (status in ('normal','attention','critical')),
  collected_at    date,
  file_url        text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_lab_patient on public.lab_results(patient_user_id, marker_key, collected_at desc);

create table if not exists public.cardio_exams (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  exam_type       text not null,
  performed_at    date,
  performed_by    text,
  findings        jsonb not null default '{}',
  conclusion      text,
  file_url        text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_exams_patient on public.cardio_exams(patient_user_id, performed_at desc);

-- ── Alertas, consultas, mensagens ───────────────────────────────────────────

create table if not exists public.cardio_alerts (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete cascade,
  rule_code       text not null,
  severity        alert_severity not null default 'warning',
  title           text not null,
  description     text,
  trigger_value   text,
  threshold_value text,
  is_read         boolean not null default false,
  is_dismissed    boolean not null default false,
  triggered_at    timestamptz not null default now()
);
create index if not exists idx_alerts_prof on public.cardio_alerts(professional_id, is_read, severity) where is_dismissed = false;
create index if not exists idx_alerts_patient on public.cardio_alerts(patient_user_id, triggered_at desc);

create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  scheduled_at    timestamptz not null,
  kind            text not null default 'consulta',
  status          text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  location        text,
  notes           text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_appt_patient on public.appointments(patient_user_id, scheduled_at desc);
create index if not exists idx_appt_prof on public.appointments(professional_id, scheduled_at desc);

create table if not exists public.patient_messages (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  sender_user_id  uuid not null references auth.users(id) on delete cascade,
  sender          text not null check (sender in ('patient','doctor')),
  body            text not null,
  attachment_url  text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_msg_thread on public.patient_messages(patient_user_id, created_at desc);

create table if not exists public.professional_notes (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now()
);

-- ── LGPD: consentimento e auditoria (append-only) ───────────────────────────

create table if not exists public.consent_records (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  consent_type     text not null,
  document_version text not null,
  status           text not null default 'granted' check (status in ('granted','revoked')),
  context          text,
  created_at       timestamptz not null default now()
);
create index if not exists idx_consent_user on public.consent_records(user_id, consent_type);

create table if not exists public.audit_logs (
  id             uuid primary key default gen_random_uuid(),
  action         text not null,
  risk_level     text not null default 'low',
  actor_id       uuid not null,
  actor_role     text not null,
  patient_user_id uuid,
  resource_type  text,
  resource_id    text,
  description    text not null,
  metadata       jsonb default '{}',
  created_at     timestamptz not null default now()
);
create index if not exists idx_audit_patient on public.audit_logs(patient_user_id, created_at desc);

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'paciente',
  category    text,
  body        text not null,
  status      text not null default 'open',
  reply       text,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles                    enable row level security;
alter table public.user_roles                  enable row level security;
alter table public.professional_profiles       enable row level security;
alter table public.cardio_patients             enable row level security;
alter table public.professional_patient_links  enable row level security;
alter table public.cardio_targets              enable row level security;
alter table public.registered_devices          enable row level security;
alter table public.raw_device_data             enable row level security;
alter table public.bp_readings                 enable row level security;
alter table public.hr_readings                 enable row level security;
alter table public.spo2_readings               enable row level security;
alter table public.weight_readings             enable row level security;
alter table public.glucose_readings            enable row level security;
alter table public.sleep_records               enable row level security;
alter table public.activity_records            enable row level security;
alter table public.symptom_reports             enable row level security;
alter table public.cardio_medications          enable row level security;
alter table public.medication_intakes          enable row level security;
alter table public.medication_titrations       enable row level security;
alter table public.lab_results                 enable row level security;
alter table public.cardio_exams                enable row level security;
alter table public.cardio_alerts               enable row level security;
alter table public.appointments                enable row level security;
alter table public.patient_messages            enable row level security;
alter table public.professional_notes          enable row level security;
alter table public.consent_records             enable row level security;
alter table public.audit_logs                  enable row level security;
alter table public.feedback                    enable row level security;

-- Perfil: cada um cuida do seu.
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists roles_read_own on public.user_roles;
create policy roles_read_own on public.user_roles for select using (auth.uid() = user_id);

-- Perfil profissional: o médico cuida do seu; admin vê tudo (aprovação).
drop policy if exists pro_own on public.professional_profiles;
create policy pro_own on public.professional_profiles for all
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- O paciente precisa ler o cartão do médico ao qual está vinculado.
drop policy if exists pro_visible_to_linked_patient on public.professional_profiles;
create policy pro_visible_to_linked_patient on public.professional_profiles for select
  using (exists (
    select 1 from professional_patient_links l
     where l.professional_id = professional_profiles.id
       and l.patient_user_id = auth.uid()
       and l.status = 'active'
  ));

-- Cadastro do paciente: dele, e do médico vinculado.
drop policy if exists cardio_patients_own on public.cardio_patients;
create policy cardio_patients_own on public.cardio_patients for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists cardio_patients_doctor on public.cardio_patients;
create policy cardio_patients_doctor on public.cardio_patients for select
  using (public.is_linked_professional(user_id, auth.uid()));

-- Vínculos: o médico gerencia os seus; o paciente lê e aceita os dele.
drop policy if exists links_professional on public.professional_patient_links;
create policy links_professional on public.professional_patient_links for all
  using (exists (select 1 from professional_profiles p where p.id = professional_id and p.user_id = auth.uid()))
  with check (exists (select 1 from professional_profiles p where p.id = professional_id and p.user_id = auth.uid()));

drop policy if exists links_patient_read on public.professional_patient_links;
create policy links_patient_read on public.professional_patient_links for select
  using (patient_user_id = auth.uid());

drop policy if exists links_patient_accept on public.professional_patient_links;
create policy links_patient_accept on public.professional_patient_links for update
  using (patient_user_id = auth.uid() or patient_user_id is null)
  with check (patient_user_id = auth.uid());

-- Padrão para toda tabela chaveada por patient_user_id:
--   paciente = leitura e escrita do próprio; médico vinculado = leitura.
do $$
declare t text;
begin
  foreach t in array array[
    'cardio_targets','registered_devices','raw_device_data','bp_readings','hr_readings',
    'spo2_readings','weight_readings','glucose_readings','sleep_records','activity_records',
    'symptom_reports','medication_intakes','lab_results','cardio_exams','appointments'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_patient_all', t);
    execute format(
      'create policy %I on public.%I for all using (patient_user_id = auth.uid()) with check (patient_user_id = auth.uid())',
      t||'_patient_all', t);

    execute format('drop policy if exists %I on public.%I', t||'_doctor_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_linked_professional(patient_user_id, auth.uid()))',
      t||'_doctor_read', t);
  end loop;
end $$;

-- O médico PRESCREVE: nessas tabelas ele também escreve.
do $$
declare t text;
begin
  foreach t in array array['cardio_medications','cardio_targets','cardio_exams','lab_results','appointments','medication_titrations'] loop
    execute format('drop policy if exists %I on public.%I', t||'_doctor_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_linked_professional(patient_user_id, auth.uid())) with check (public.is_linked_professional(patient_user_id, auth.uid()))',
      t||'_doctor_write', t);
  end loop;
end $$;

-- Medicações: o paciente lê as suas (e marca adesão em medication_intakes).
drop policy if exists meds_patient_read on public.cardio_medications;
create policy meds_patient_read on public.cardio_medications for select using (patient_user_id = auth.uid());

drop policy if exists titration_patient_read on public.medication_titrations;
create policy titration_patient_read on public.medication_titrations for select using (patient_user_id = auth.uid());

-- Alertas: paciente lê os seus; médico vinculado lê e marca como lido.
drop policy if exists alerts_patient_read on public.cardio_alerts;
create policy alerts_patient_read on public.cardio_alerts for select using (patient_user_id = auth.uid());

drop policy if exists alerts_doctor on public.cardio_alerts;
create policy alerts_doctor on public.cardio_alerts for all
  using (public.is_linked_professional(patient_user_id, auth.uid()))
  with check (public.is_linked_professional(patient_user_id, auth.uid()));

-- Mensagens: os dois lados da conversa.
drop policy if exists messages_participants on public.patient_messages;
create policy messages_participants on public.patient_messages for all
  using (patient_user_id = auth.uid() or public.is_linked_professional(patient_user_id, auth.uid()))
  with check (sender_user_id = auth.uid());

-- Anotações do médico: privadas dele. O paciente NÃO vê.
drop policy if exists notes_professional on public.professional_notes;
create policy notes_professional on public.professional_notes for all
  using (exists (select 1 from professional_profiles p where p.id = professional_id and p.user_id = auth.uid()))
  with check (exists (select 1 from professional_profiles p where p.id = professional_id and p.user_id = auth.uid()));

-- Consentimento: append-only (sem update, sem delete — revogar é novo registro).
drop policy if exists consent_select_own on public.consent_records;
create policy consent_select_own on public.consent_records for select using (auth.uid() = user_id);
drop policy if exists consent_insert_own on public.consent_records;
create policy consent_insert_own on public.consent_records for insert with check (auth.uid() = user_id);

-- Auditoria: só admin lê; escrita pela função SECURITY DEFINER.
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select using (public.has_role(auth.uid(),'admin'));

drop policy if exists feedback_own on public.feedback;
create policy feedback_own on public.feedback for all
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = user_id);

create or replace function public.log_audit_event(
  p_action text, p_actor_id uuid, p_actor_role text,
  p_description text, p_patient_user_id uuid default null,
  p_resource_type text default null, p_resource_id text default null,
  p_metadata jsonb default '{}'
) returns void language sql security definer set search_path = public as $$
  insert into audit_logs (action, actor_id, actor_role, description, patient_user_id, resource_type, resource_id, metadata)
  values (p_action, p_actor_id, p_actor_role, p_description, p_patient_user_id, p_resource_type, p_resource_id, p_metadata);
$$;

-- ── updated_at automático ───────────────────────────────────────────────────

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','professional_profiles','cardio_patients','cardio_targets','cardio_medications'] loop
    execute format('drop trigger if exists trg_touch_%I on public.%I', t, t);
    execute format('create trigger trg_touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;
