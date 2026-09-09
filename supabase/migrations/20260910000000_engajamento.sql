-- ============================================================================
-- ENCORPEI CARDIO — camada de engajamento
-- Rodar DEPOIS de 20260909000000_cardio_baseline.sql
-- ============================================================================
-- Suporta o que está em docs/ENGAJAMENTO-CARDIO.md:
--   Idade do Coração · Capacidade · Como estou agora · Modo Cuidador ·
--   Sódio · Qualidade de vida · Aprender · Caminhada guiada
-- ============================================================================

-- ── Faixa de treino definida pelo médico ────────────────────────────────────
-- A caminhada guiada só tem faixa-alvo se o médico definir. Sem isso, o app
-- não inventa intensidade de esforço para cardiopata (ENGAJAMENTO §6.3).
alter table public.cardio_targets
  add column if not exists training_hr_min smallint,
  add column if not exists training_hr_max smallint;

-- ── Testes de capacidade funcional ──────────────────────────────────────────
create table if not exists public.capacity_tests (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  tipo              text not null check (tipo in ('walk_6min','sit_to_stand_30s','hr_recovery')),
  realizado_em      timestamptz not null default now(),
  -- metros (6MWT) · repetições (sentar-levantar) · bpm de queda (recuperação)
  valor             numeric(7,1) not null,
  borg              smallint check (borg between 0 and 10),
  fc_pico           smallint,
  fc_final          smallint,
  interrompido      boolean not null default false,
  motivo_interrupcao text,
  observacao        text,
  -- 6MWT feito em casa é ESTIMATIVA: percurso e contagem de passos variam.
  source_type       data_source_type not null default 'manual',
  validation_status validation_status not null default 'estimated',
  created_at        timestamptz not null default now()
);
create index if not exists idx_capacity_patient on public.capacity_tests(patient_user_id, tipo, realizado_em desc);

-- ── Sessões de caminhada guiada ─────────────────────────────────────────────
create table if not exists public.walk_sessions (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  iniciada_em       timestamptz not null default now(),
  duracao_segundos  integer not null default 0,
  passos            integer,
  distancia_m       integer,
  fc_media          smallint,
  fc_maxima         smallint,
  -- Faixa vigente no momento da sessão (guardada para o histórico fazer sentido
  -- mesmo depois de o médico mudar a prescrição).
  zona_min          smallint,
  zona_max          smallint,
  segundos_na_zona  integer,
  borg              smallint check (borg between 0 and 10),
  interrompida      boolean not null default false,
  motivo_interrupcao text,
  created_at        timestamptz not null default now()
);
create index if not exists idx_walk_patient on public.walk_sessions(patient_user_id, iniciada_em desc);

-- ── Sódio por refeição ──────────────────────────────────────────────────────
create table if not exists public.sodium_entries (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  dia             date not null,
  refeicao        text not null check (refeicao in ('cafe','almoco','lanche','jantar')),
  opcao           text not null,
  sodio_mg        integer not null,
  created_at      timestamptz not null default now(),
  unique (patient_user_id, dia, refeicao)
);
create index if not exists idx_sodio_patient on public.sodium_entries(patient_user_id, dia desc);

-- ── "Como estou agora" ──────────────────────────────────────────────────────
-- Todo uso do botão fica registrado, inclusive (e principalmente) quando o
-- desfecho foi emergência: é o que permite ao médico ver o que aconteceu.
create table if not exists public.wellbeing_checkins (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  ocorrido_em     timestamptz not null default now(),
  desfecho        text not null check (desfecho in ('emergencia','avisar_medico','registrar')),
  alarmes         text[] not null default '{}',
  como_se_sente   smallint check (como_se_sente between 0 and 10),
  espelho         jsonb not null default '{}',
  observacao      text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_checkin_patient on public.wellbeing_checkins(patient_user_id, ocorrido_em desc);

-- ── Qualidade de vida (questionário mensal) ─────────────────────────────────
create table if not exists public.qol_responses (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  respondido_em   timestamptz not null default now(),
  -- 0 a 100; derivado de questionário curto de limitação e sintomas
  score           smallint not null check (score between 0 and 100),
  respostas       jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists idx_qol_patient on public.qol_responses(patient_user_id, respondido_em desc);

-- ── Idade do Coração (fotografias no tempo) ─────────────────────────────────
-- O cálculo é feito no cliente; guardamos a série para o gráfico e para o
-- médico ver a trajetória.
create table if not exists public.heart_age_snapshots (
  id                uuid primary key default gen_random_uuid(),
  patient_user_id   uuid not null references auth.users(id) on delete cascade,
  calculado_em      timestamptz not null default now(),
  idade_real        smallint not null,
  idade_coracao     smallint not null,
  risco_percentual  numeric(5,2),
  entradas          jsonb not null default '{}',
  created_at        timestamptz not null default now()
);
create index if not exists idx_heartage_patient on public.heart_age_snapshots(patient_user_id, calculado_em desc);

-- ── Aprender: o que o paciente já leu ───────────────────────────────────────
create table if not exists public.education_progress (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  licao_id        text not null,
  lida_em         timestamptz not null default now(),
  util            boolean,
  created_at      timestamptz not null default now(),
  unique (patient_user_id, licao_id)
);

-- ── Modo Cuidador ───────────────────────────────────────────────────────────
-- REGRA (ENGAJAMENTO §6.4): quem convida é o PACIENTE, o acesso é somente de
-- leitura e é revogável por ele a qualquer momento. Médico e clínica não
-- cadastram cuidador.
create table if not exists public.caregiver_links (
  id                 uuid primary key default gen_random_uuid(),
  patient_user_id    uuid not null references auth.users(id) on delete cascade,
  caregiver_user_id  uuid references auth.users(id) on delete cascade,
  caregiver_email    text,
  caregiver_nome     text not null,
  parentesco         text,
  invite_code        text unique,
  status             text not null default 'pending' check (status in ('pending','active','revoked')),
  -- O que o cuidador pode ver. O paciente escolhe; o padrão é o essencial.
  ver_medidas        boolean not null default true,
  ver_remedios       boolean not null default true,
  ver_sintomas       boolean not null default false,
  ver_exames         boolean not null default false,
  receber_alertas    boolean not null default true,
  aceito_em          timestamptz,
  revogado_em        timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists idx_caregiver_patient on public.caregiver_links(patient_user_id, status);
create index if not exists idx_caregiver_user on public.caregiver_links(caregiver_user_id, status);

create or replace function public.is_active_caregiver(_patient_user_id uuid, _caregiver_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from caregiver_links
     where patient_user_id = _patient_user_id
       and caregiver_user_id = _caregiver_user_id
       and status = 'active'
  );
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.capacity_tests      enable row level security;
alter table public.walk_sessions       enable row level security;
alter table public.sodium_entries      enable row level security;
alter table public.wellbeing_checkins  enable row level security;
alter table public.qol_responses       enable row level security;
alter table public.heart_age_snapshots enable row level security;
alter table public.education_progress  enable row level security;
alter table public.caregiver_links     enable row level security;

-- Paciente escreve o seu; médico vinculado lê.
do $$
declare t text;
begin
  foreach t in array array[
    'capacity_tests','walk_sessions','sodium_entries','wellbeing_checkins',
    'qol_responses','heart_age_snapshots','education_progress'
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

-- Cuidador: leitura do que o paciente liberou.
-- Educação e check-in de bem-estar ficam de fora por padrão — é o que o
-- paciente pode querer manter só entre ele e o médico.
drop policy if exists capacity_caregiver_read on public.capacity_tests;
create policy capacity_caregiver_read on public.capacity_tests for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = capacity_tests.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.ver_medidas
  ));

drop policy if exists walk_caregiver_read on public.walk_sessions;
create policy walk_caregiver_read on public.walk_sessions for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = walk_sessions.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.ver_medidas
  ));

-- O vínculo em si: o paciente gerencia; o cuidador vê e aceita o dele.
drop policy if exists caregiver_patient_all on public.caregiver_links;
create policy caregiver_patient_all on public.caregiver_links for all
  using (patient_user_id = auth.uid()) with check (patient_user_id = auth.uid());

drop policy if exists caregiver_self_read on public.caregiver_links;
create policy caregiver_self_read on public.caregiver_links for select
  using (caregiver_user_id = auth.uid());

drop policy if exists caregiver_self_accept on public.caregiver_links;
create policy caregiver_self_accept on public.caregiver_links for update
  using (caregiver_user_id = auth.uid() or caregiver_user_id is null)
  with check (caregiver_user_id = auth.uid());

drop policy if exists caregiver_doctor_read on public.caregiver_links;
create policy caregiver_doctor_read on public.caregiver_links for select
  using (public.is_linked_professional(patient_user_id, auth.uid()));

-- ── Leituras clínicas visíveis ao cuidador ──────────────────────────────────
-- Só as tabelas que o paciente liberou em ver_medidas / ver_remedios.
do $$
declare t text;
begin
  foreach t in array array['bp_readings','hr_readings','weight_readings','spo2_readings','activity_records','sleep_records'] loop
    execute format('drop policy if exists %I on public.%I', t||'_caregiver_read', t);
    execute format($f$
      create policy %I on public.%I for select using (exists (
        select 1 from caregiver_links c
         where c.patient_user_id = %I.patient_user_id
           and c.caregiver_user_id = auth.uid()
           and c.status = 'active' and c.ver_medidas))
    $f$, t||'_caregiver_read', t, t);
  end loop;

  foreach t in array array['cardio_medications','medication_intakes'] loop
    execute format('drop policy if exists %I on public.%I', t||'_caregiver_read', t);
    execute format($f$
      create policy %I on public.%I for select using (exists (
        select 1 from caregiver_links c
         where c.patient_user_id = %I.patient_user_id
           and c.caregiver_user_id = auth.uid()
           and c.status = 'active' and c.ver_remedios))
    $f$, t||'_caregiver_read', t, t);
  end loop;
end $$;

drop policy if exists symptoms_caregiver_read on public.symptom_reports;
create policy symptoms_caregiver_read on public.symptom_reports for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = symptom_reports.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.ver_sintomas
  ));

drop policy if exists exams_caregiver_read on public.cardio_exams;
create policy exams_caregiver_read on public.cardio_exams for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = cardio_exams.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.ver_exames
  ));

drop policy if exists labs_caregiver_read on public.lab_results;
create policy labs_caregiver_read on public.lab_results for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = lab_results.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.ver_exames
  ));

-- Alertas para quem recebe alerta.
drop policy if exists alerts_caregiver_read on public.cardio_alerts;
create policy alerts_caregiver_read on public.cardio_alerts for select
  using (exists (
    select 1 from caregiver_links c
     where c.patient_user_id = cardio_alerts.patient_user_id
       and c.caregiver_user_id = auth.uid()
       and c.status = 'active' and c.receber_alertas
  ));

-- Cuidador precisa saber de quem está cuidando.
drop policy if exists cardio_patients_caregiver on public.cardio_patients;
create policy cardio_patients_caregiver on public.cardio_patients for select
  using (public.is_active_caregiver(user_id, auth.uid()));

drop policy if exists targets_caregiver_read on public.cardio_targets;
create policy targets_caregiver_read on public.cardio_targets for select
  using (public.is_active_caregiver(patient_user_id, auth.uid()));
