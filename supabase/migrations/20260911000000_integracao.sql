-- ══════════════════════════════════════════════════════════════════════
-- INTEGRAÇÃO PONTA A PONTA — o que faltava para o app funcionar de verdade
-- ══════════════════════════════════════════════════════════════════════
--
-- A auditoria de 09/09/2026 encontrou o app inteiro construído sobre buracos
-- silenciosos: o paciente se cadastrava e travava, o médico nunca via ninguém,
-- e a fila de risco — o argumento de venda número um — nunca era populada
-- por ninguém. Esta migração fecha cada um desses buracos.
--
-- 1. auth.users → profiles  ..... o cadastro deixava de criar a linha
-- 2. claim_invite() ............. o vínculo médico-paciente não existia
-- 3. Geração de cardio_alerts ... ninguém inseria; agora o banco insere
-- 4. monitoring_plan ............ o médico prescreve O QUE e COM QUE FREQUÊNCIA
-- 5. beta_events ................ tabela chamada pelo código e inexistente
-- 6. feedback ................... schema divergente do que o app insere
-- 7. Storage .................... buckets exams / feedback-attachments
-- 8. White label ................ marca da clínica no app do paciente
--
-- REGRA CLÍNICA PRESERVADA: nada aqui gera alerta a partir de dado
-- `estimated`. A PA da pulseira continua fora — ver §2 do MAPEAMENTO.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. Todo usuário novo nasce com perfil ────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quem já existe sem perfil (contas criadas antes desta migração).
insert into public.profiles (user_id)
select u.id from auth.users u
 where not exists (select 1 from public.profiles p where p.user_id = u.id);

insert into public.user_roles (user_id, role)
select u.id, 'user' from auth.users u
 where not exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'user')
on conflict do nothing;

-- ── 2. O paciente aceita o convite do médico ─────────────────────────
--
-- SECURITY DEFINER porque a RLS de professional_patient_links não deixa o
-- paciente enxergar um vínculo que ainda não é dele — é exatamente o vínculo
-- que ele está tentando reivindicar. A função valida o código e só então
-- carimba o patient_user_id.

create or replace function public.claim_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_link   public.professional_patient_links%rowtype;
  v_nome   text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_link
    from public.professional_patient_links
   where upper(invite_code) = upper(trim(p_code))
   limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_code');
  end if;

  -- Já é meu: idempotente, devolve sucesso.
  if v_link.patient_user_id = auth.uid() then
    select display_name into v_nome from public.professional_profiles where id = v_link.professional_id;
    return jsonb_build_object('ok', true, 'already', true, 'professional_name', v_nome);
  end if;

  if v_link.patient_user_id is not null then
    return jsonb_build_object('ok', false, 'error', 'code_already_used');
  end if;

  if v_link.status = 'ended' then
    return jsonb_build_object('ok', false, 'error', 'code_expired');
  end if;

  update public.professional_patient_links
     set patient_user_id = auth.uid(),
         status          = 'active',
         started_at      = coalesce(started_at, now())
   where id = v_link.id;

  -- A ficha clínica do paciente nasce aqui, ligada ao médico que o convidou.
  insert into public.cardio_patients (user_id, professional_id, full_name)
  select auth.uid(), v_link.professional_id, p.full_name
    from public.profiles p where p.user_id = auth.uid()
  on conflict (user_id) do update set professional_id = excluded.professional_id;

  -- Alvos padrão para o paciente não ficar sem referência nenhuma.
  insert into public.cardio_targets (patient_user_id, professional_id)
  values (auth.uid(), v_link.professional_id)
  on conflict (patient_user_id) do nothing;

  select display_name into v_nome from public.professional_profiles where id = v_link.professional_id;
  return jsonb_build_object('ok', true, 'professional_name', v_nome);
end;
$$;

grant execute on function public.claim_invite(text) to authenticated;

-- ── 3. A fila de risco do médico, gerada pelo banco ──────────────────
--
-- Por que no banco e não no app: o alerta não pode depender do paciente ter
-- a tela aberta. O dado entra — por digitação, por importação, por pulseira —
-- e a regra roda no mesmo instante, do lado do servidor.
--
-- Anti-spam: a mesma rule_code para o mesmo paciente não repete dentro de
-- 12 horas se ainda estiver por ler.

create or replace function public.registrar_alerta(
  _patient_user_id uuid,
  _rule_code text,
  _severity alert_severity,
  _title text,
  _description text,
  _trigger_value text,
  _threshold_value text
) returns void language plpgsql security definer set search_path = public as $$
declare v_pro uuid;
begin
  if exists (
    select 1 from public.cardio_alerts
     where patient_user_id = _patient_user_id
       and rule_code = _rule_code
       and is_dismissed = false
       and triggered_at > now() - interval '12 hours'
  ) then
    return;
  end if;

  select l.professional_id into v_pro
    from public.professional_patient_links l
   where l.patient_user_id = _patient_user_id and l.status = 'active'
   order by l.started_at desc nulls last limit 1;

  insert into public.cardio_alerts
    (patient_user_id, professional_id, rule_code, severity, title, description, trigger_value, threshold_value)
  values
    (_patient_user_id, v_pro, _rule_code, _severity, _title, _description, _trigger_value, _threshold_value);
end;
$$;

-- Pressão arterial ----------------------------------------------------
create or replace function public.alerta_pressao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sis_max smallint;
  v_dia_max smallint;
  v_fora    integer;
begin
  -- REGRA INEGOCIÁVEL: estimativa de pulseira não dispara alerta.
  if new.validation_status <> 'validated' or new.cuff_validated = false then
    return new;
  end if;

  select bp_systolic_max, bp_diastolic_max into v_sis_max, v_dia_max
    from public.cardio_targets where patient_user_id = new.patient_user_id;
  v_sis_max := coalesce(v_sis_max, 130);
  v_dia_max := coalesce(v_dia_max, 80);

  -- Crise: encaminhamento imediato.
  if new.systolic >= 180 or new.diastolic >= 110 then
    perform public.registrar_alerta(
      new.patient_user_id, 'bp_crisis', 'emergency',
      'Pressão muito alta registrada',
      'Medida de ' || new.systolic || '/' || new.diastolic || ' mmHg. O paciente foi orientado a procurar atendimento.',
      new.systolic || '/' || new.diastolic, '180/110');
    return new;
  end if;

  -- Hipotensão sintomática/relevante.
  if new.systolic <= 90 or new.diastolic <= 55 then
    perform public.registrar_alerta(
      new.patient_user_id, 'bp_hypotension', 'critical',
      'Pressão baixa registrada',
      'Medida de ' || new.systolic || '/' || new.diastolic || ' mmHg — avaliar dose de anti-hipertensivo.',
      new.systolic || '/' || new.diastolic, '90/55');
    return new;
  end if;

  -- Fora do alvo de forma persistente: 3 das últimas 5 medidas válidas.
  if new.systolic > v_sis_max or new.diastolic > v_dia_max then
    select count(*) into v_fora from (
      select systolic, diastolic from public.bp_readings
       where patient_user_id = new.patient_user_id
         and validation_status = 'validated' and cuff_validated
       order by recorded_at desc limit 5
    ) u where u.systolic > v_sis_max or u.diastolic > v_dia_max;

    if v_fora >= 3 then
      perform public.registrar_alerta(
        new.patient_user_id, 'bp_above_target', 'warning',
        'Pressão acima do alvo de forma persistente',
        v_fora || ' das últimas 5 medidas acima de ' || v_sis_max || '/' || v_dia_max || ' mmHg.',
        new.systolic || '/' || new.diastolic, v_sis_max || '/' || v_dia_max);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alerta_pressao on public.bp_readings;
create trigger trg_alerta_pressao after insert on public.bp_readings
  for each row execute function public.alerta_pressao();

-- Peso — descompensação de insuficiência cardíaca ---------------------
create or replace function public.alerta_peso()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_base numeric(5,1);
  v_delta numeric(5,1);
begin
  -- Referência: peso seco prescrito; na falta dele, a medida de ~3 dias atrás.
  select dry_weight_kg into v_base from public.cardio_targets where patient_user_id = new.patient_user_id;

  if v_base is null then
    select value into v_base from public.weight_readings
     where patient_user_id = new.patient_user_id
       and recorded_at between new.recorded_at - interval '4 days' and new.recorded_at - interval '2 days'
     order by recorded_at desc limit 1;
  end if;

  if v_base is null then return new; end if;
  v_delta := new.value - v_base;

  if v_delta >= 2 then
    perform public.registrar_alerta(
      new.patient_user_id, 'weight_gain_3d', 'critical',
      'Ganho rápido de peso',
      'Aumento de ' || to_char(v_delta, 'FM990.0') || ' kg em poucos dias — sinal clássico de retenção de líquido.',
      new.value || ' kg', v_base || ' kg');
  elsif v_delta <= -3 then
    perform public.registrar_alerta(
      new.patient_user_id, 'weight_loss', 'warning',
      'Perda de peso relevante',
      'Queda de ' || to_char(abs(v_delta), 'FM990.0') || ' kg em relação à referência.',
      new.value || ' kg', v_base || ' kg');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alerta_peso on public.weight_readings;
create trigger trg_alerta_peso after insert on public.weight_readings
  for each row execute function public.alerta_peso();

-- Frequência cardíaca -------------------------------------------------
create or replace function public.alerta_fc()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_min smallint; v_max smallint;
begin
  if new.context is distinct from 'resting' then return new; end if;
  if new.validation_status <> 'validated' then return new; end if;

  select resting_hr_min, resting_hr_max into v_min, v_max
    from public.cardio_targets where patient_user_id = new.patient_user_id;
  v_min := coalesce(v_min, 50); v_max := coalesce(v_max, 80);

  if new.bpm < 40 then
    perform public.registrar_alerta(new.patient_user_id, 'hr_bradycardia', 'critical',
      'Frequência cardíaca muito baixa em repouso',
      new.bpm || ' bpm em repouso — avaliar betabloqueador e condução.', new.bpm || ' bpm', '40 bpm');
  elsif new.bpm > 120 then
    perform public.registrar_alerta(new.patient_user_id, 'hr_tachycardia', 'critical',
      'Frequência cardíaca muito alta em repouso',
      new.bpm || ' bpm em repouso.', new.bpm || ' bpm', '120 bpm');
  elsif new.bpm > v_max then
    perform public.registrar_alerta(new.patient_user_id, 'hr_above_target', 'info',
      'Frequência de repouso acima do alvo',
      new.bpm || ' bpm, alvo até ' || v_max || ' bpm.', new.bpm || ' bpm', v_max || ' bpm');
  end if;

  if coalesce(new.irregular_flag, false) then
    perform public.registrar_alerta(new.patient_user_id, 'hr_irregular', 'warning',
      'Ritmo irregular detectado pelo dispositivo',
      'Sinal de irregularidade no sensor óptico. Não é diagnóstico de arritmia — precisa de confirmação por ECG.',
      'irregular', null);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alerta_fc on public.hr_readings;
create trigger trg_alerta_fc after insert on public.hr_readings
  for each row execute function public.alerta_fc();

-- Saturação -----------------------------------------------------------
create or replace function public.alerta_spo2()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.validation_status <> 'validated' then return new; end if;
  if new.value < 90 then
    perform public.registrar_alerta(new.patient_user_id, 'spo2_low', 'critical',
      'Saturação baixa', new.value || '% de saturação registrada.', new.value || '%', '90%');
  elsif new.value < 94 then
    perform public.registrar_alerta(new.patient_user_id, 'spo2_borderline', 'warning',
      'Saturação no limite', new.value || '% de saturação registrada.', new.value || '%', '94%');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_alerta_spo2 on public.spo2_readings;
create trigger trg_alerta_spo2 after insert on public.spo2_readings
  for each row execute function public.alerta_spo2();

-- Sintomas ------------------------------------------------------------
create or replace function public.alerta_sintoma()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sev alert_severity;
begin
  v_sev := case
    when new.symptom_type in ('chest_pain_rest','syncope','dyspnea_rest','palpitations_syncope') then 'emergency'
    when new.symptom_type in ('dyspnea_exertion','orthopnea','edema','palpitations','chest_pain_exertion') then 'warning'
    else 'info' end;

  if coalesce(new.intensity, 0) >= 8 and v_sev = 'info' then v_sev := 'warning'; end if;
  if v_sev = 'info' then return new; end if;

  perform public.registrar_alerta(
    new.patient_user_id, 'symptom_' || new.symptom_type, v_sev,
    'Sintoma relatado pelo paciente',
    coalesce(new.notes, 'Relato registrado no app.') ||
      case when new.intensity is not null then ' Intensidade ' || new.intensity || '/10.' else '' end,
    new.symptom_type, null);

  update public.symptom_reports set triaged_as = v_sev where id = new.id;
  return new;
end;
$$;

drop trigger if exists trg_alerta_sintoma on public.symptom_reports;
create trigger trg_alerta_sintoma after insert on public.symptom_reports
  for each row execute function public.alerta_sintoma();

-- ── 4. Plano de monitoramento ────────────────────────────────────────
--
-- Até aqui o médico só definia ALVO DE VALOR (pressão até 130/80). Nunca
-- definia FREQUÊNCIA. Sem isso o app não tem o que cobrar do paciente na tela
-- inicial, e "o paciente registra o que o médico pede" era só uma frase.

create table if not exists public.monitoring_plan (
  id              uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  metric          text not null check (metric in (
                    'bp','weight','hr','spo2','glucose','steps','sleep',
                    'symptoms','medication','sodium','wellbeing','walk')),
  frequency       text not null default 'daily' check (frequency in ('daily','twice_daily','weekly','biweekly','monthly','as_needed')),
  times_per_day   smallint not null default 1 check (times_per_day between 1 and 6),
  preferred_time  text check (preferred_time in ('morning','afternoon','evening','any')),
  days_of_week    smallint[] ,
  is_active       boolean not null default true,
  instructions    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (patient_user_id, metric)
);

create index if not exists monitoring_plan_patient_idx on public.monitoring_plan(patient_user_id) where is_active;

drop trigger if exists touch_monitoring_plan on public.monitoring_plan;
create trigger touch_monitoring_plan before update on public.monitoring_plan
  for each row execute function public.touch_updated_at();

alter table public.monitoring_plan enable row level security;

drop policy if exists monitoring_plan_patient on public.monitoring_plan;
create policy monitoring_plan_patient on public.monitoring_plan for select
  using (patient_user_id = auth.uid() or public.is_active_caregiver(patient_user_id, auth.uid()));

drop policy if exists monitoring_plan_doctor on public.monitoring_plan;
create policy monitoring_plan_doctor on public.monitoring_plan for all
  using (public.is_linked_professional(patient_user_id, auth.uid()))
  with check (public.is_linked_professional(patient_user_id, auth.uid()));

-- DECISÃO: NÃO semeamos plano automático.
--
-- A tentação era criar quatro itens padrão para todo vínculo ativo. Mas o
-- app do paciente escreve "Definido pelo seu médico" em cima do que vem
-- desta tabela — e um item que o médico nunca escolheu, exibido como
-- prescrição dele, é mentira com aparência de recurso. Sem plano, o app cai
-- no conjunto sugerido e DIZ que é sugestão (ver usePlanoMonitoramento.ts).
-- O médico prescreve na tela do paciente, em dez segundos, e aí sim vira
-- prescrição de verdade.


-- ── 5. beta_events (chamada pelo código, nunca criada) ───────────────

create table if not exists public.beta_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  role       text,
  event      text not null,
  screen     text,
  props      jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists beta_events_event_idx on public.beta_events(event, created_at desc);

alter table public.beta_events enable row level security;

drop policy if exists beta_events_insert on public.beta_events;
create policy beta_events_insert on public.beta_events for insert
  with check (user_id = auth.uid() or user_id is null);

drop policy if exists beta_events_admin on public.beta_events;
create policy beta_events_admin on public.beta_events for select
  using (public.has_role(auth.uid(), 'admin'));

-- ── 6. feedback: schema alinhado com o que o app insere ─────────────

alter table public.feedback add column if not exists author_role     text;
alter table public.feedback add column if not exists author_name     text;
alter table public.feedback add column if not exists author_email    text;
alter table public.feedback add column if not exists screen          text;
alter table public.feedback add column if not exists message         text;
alter table public.feedback add column if not exists attachment_path text;
alter table public.feedback add column if not exists updated_at      timestamptz not null default now();

-- `importance` é TEXTO, não smallint. O app manda 'nice_to_have' /
-- 'important' / 'essential' (FeedbackImportance em src/hooks/useFeedback.ts);
-- com a coluna smallint todo envio de feedback morria no servidor com
-- "invalid input syntax for type smallint" — para paciente e para médico.
alter table public.feedback add column if not exists importance text;
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'feedback'
       and column_name = 'importance' and data_type = 'smallint'
  ) then
    alter table public.feedback alter column importance type text using importance::text;
  end if;
end $$;

-- Nota interna do admin. A tela de feedback do admin já escrevia nela; a
-- coluna nunca existiu, então o botão "salvar nota" sempre errava.
alter table public.feedback add column if not exists admin_notes text;

-- `status`: o app trabalha com new / in_review / resolved / archived
-- (FeedbackStatus). O default herdado era 'open', que não existe em nenhum
-- filtro da tela — feedback novo nascia num estado que o admin não conseguia
-- listar nem exibir no seletor.
alter table public.feedback alter column status set default 'new';
update public.feedback set status = 'new' where status = 'open';

-- `body` era not null e o app nunca manda: migra o conteúdo e libera.
update public.feedback set message = coalesce(message, body) where message is null;
alter table public.feedback alter column body drop not null;

-- ── 7. Storage: buckets privados ─────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit)
values ('exams', 'exams', false, 26214400)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit)
values ('feedback-attachments', 'feedback-attachments', false, 10485760)
on conflict (id) do nothing;

-- Cada arquivo mora em <user_id>/<uuid>.<ext>. O dono lê e escreve o seu;
-- o médico vinculado lê os exames do paciente dele.
drop policy if exists exams_owner on storage.objects;
create policy exams_owner on storage.objects for all to authenticated
  using (bucket_id = 'exams' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'exams' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists exams_doctor_read on storage.objects;
create policy exams_doctor_read on storage.objects for select to authenticated
  using (
    bucket_id = 'exams'
    and public.is_linked_professional(((storage.foldername(name))[1])::uuid, auth.uid())
  );

drop policy if exists feedback_attachment_owner on storage.objects;
create policy feedback_attachment_owner on storage.objects for all to authenticated
  using (bucket_id = 'feedback-attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'feedback-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists feedback_attachment_admin on storage.objects;
create policy feedback_attachment_admin on storage.objects for select to authenticated
  using (bucket_id = 'feedback-attachments' and public.has_role(auth.uid(), 'admin'));

-- ── 8. White label — a marca da clínica dentro do app ────────────────

alter table public.professional_profiles add column if not exists clinic_logo_url    text;
alter table public.professional_profiles add column if not exists clinic_brand_color text;
alter table public.professional_profiles add column if not exists clinic_phone       text;
alter table public.professional_profiles add column if not exists clinic_address     text;
alter table public.professional_profiles add column if not exists clinic_subtitle    text;
alter table public.professional_profiles add column if not exists clinic_site        text;

-- O paciente precisa ler a marca do médico dele — mas só a marca.
create or replace view public.clinic_branding as
  select p.id, p.display_name, p.clinic_name, p.clinic_logo_url, p.clinic_brand_color,
         p.clinic_phone, p.clinic_address, p.clinic_subtitle, p.clinic_site,
         p.specialty, p.registration_number, p.registration_state
    from public.professional_profiles p;

grant select on public.clinic_branding to authenticated, anon;

insert into storage.buckets (id, name, public, file_size_limit)
values ('clinic-logos', 'clinic-logos', true, 2097152)
on conflict (id) do nothing;

drop policy if exists clinic_logo_read on storage.objects;
create policy clinic_logo_read on storage.objects for select
  using (bucket_id = 'clinic-logos');

drop policy if exists clinic_logo_write on storage.objects;
create policy clinic_logo_write on storage.objects for all to authenticated
  using (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'clinic-logos' and (storage.foldername(name))[1] = auth.uid()::text);
