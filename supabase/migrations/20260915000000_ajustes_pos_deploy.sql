-- ══════════════════════════════════════════════════════════════════════
-- AJUSTES PÓS-DEPLOY — o que os avisos do Supabase apontaram
-- ══════════════════════════════════════════════════════════════════════
--
-- Escrita DEPOIS da primeira instalação num projeto real (rmodoqflmabzfsqieiln,
-- 10/09/2026). Cada item aqui saiu de um aviso do linter do Supabase, não de
-- revisão de código — é o tipo de coisa que só aparece quando o banco existe.

-- ── 1. clinic_branding vazava a agenda de todos os médicos ───────────
--
-- A view nasceu SECURITY DEFINER (padrão do Postgres) e com grant para
-- `anon`. Resultado: qualquer visitante NÃO AUTENTICADO podia listar nome,
-- CRM, UF, telefone e endereço de TODOS os profissionais cadastrados — uma
-- lista de contatos pronta para quem quisesse raspar. Único achado de nível
-- ERROR do linter.
--
-- A intenção era outra: o paciente lê a marca do médico DELE. Com
-- security_invoker, a view passa a respeitar a RLS de professional_profiles,
-- onde `pro_visible_to_linked_patient` já diz exatamente isso.

alter view public.clinic_branding set (security_invoker = on);

revoke all on public.clinic_branding from anon;
grant select on public.clinic_branding to authenticated;

-- ── 2. search_path mutável em duas funções ───────────────────────────
--
-- Função SECURITY DEFINER sem search_path fixo pode ser induzida a chamar
-- um objeto plantado num schema que o invocador controla. As outras 30
-- funções do projeto já fixavam; estas duas escaparam.

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

alter function public.sync_alerta_workflow() set search_path = public;

-- ── 3. Funções expostas como RPC pública ─────────────────────────────
--
-- Doze funções SECURITY DEFINER eram chamáveis por `anon` via /rest/v1/rpc/.
-- Dava para sondar papéis e relações sem login.
--
-- Duas armadilhas registradas, porque as duas custaram tentativa:
--
-- (a) `revoke ... from anon` NÃO resolve sozinho. Toda função nasce com
--     EXECUTE para PUBLIC, e PUBLIC alcança `anon`. É preciso revogar de
--     PUBLIC e devolver explicitamente a quem precisa.
--
-- (b) has_role, is_linked_professional, is_active_caregiver e
--     owns_professional_profile são chamadas DENTRO das políticas de RLS, e
--     política roda com o privilégio de quem consulta. Sem o grant explícito
--     a `authenticated`, toda a RLS do produto passaria a dar erro de
--     permissão — o app inteiro pararia.

do $$
declare f text;
begin
  foreach f in array array[
    'public.has_role(uuid, app_role)',
    'public.is_linked_professional(uuid, uuid)',
    'public.is_active_caregiver(uuid, uuid)',
    'public.owns_professional_profile(uuid, uuid)',
    'public.claim_invite(text)',
    'public.aceitar_convite_cuidador(text)',
    'public.log_audit_event(text, text, text, uuid, text, text, jsonb)',
    'public.admin_dashboard_stats()',
    'public.admin_list_users(text, int, int)',
    'public.admin_delete_user(uuid)',
    'public.admin_professional_metrics(uuid)',
    'public.admin_professional_patients(uuid)'
  ] loop
    execute format('revoke all on function %s from public', f);
    execute format('revoke all on function %s from anon', f);
    execute format('grant execute on function %s to authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── 4. Índices duplicados ────────────────────────────────────────────
--
-- A migração de segurança criou índices por (paciente, tempo) sem notar que
-- o baseline já tinha os equivalentes. Índice duplicado custa escrita e não
-- devolve nada em leitura.

drop index if exists public.bp_readings_paciente_tempo_idx;
drop index if exists public.hr_readings_paciente_tempo_idx;
drop index if exists public.spo2_readings_paciente_tempo_idx;
drop index if exists public.weight_readings_paciente_tempo_idx;
drop index if exists public.glucose_readings_paciente_tempo_idx;
drop index if exists public.symptom_reports_paciente_tempo_idx;
drop index if exists public.medication_intakes_paciente_tempo_idx;
drop index if exists public.cardio_alerts_paciente_tempo_idx;

-- ── 5. Chaves estrangeiras sem índice ────────────────────────────────
--
-- Sem índice na coluna que referencia, todo DELETE no pai varre a tabela
-- filha inteira. Com exclusão de conta em cascata (LGPD), isso vira um
-- travamento proporcional ao tamanho do banco.

create index if not exists idx_titrations_med       on public.medication_titrations(medication_id);
create index if not exists idx_titrations_patient   on public.medication_titrations(patient_user_id);
create index if not exists idx_titrations_prof      on public.medication_titrations(professional_id);
create index if not exists idx_notes_patient        on public.professional_notes(patient_user_id);
create index if not exists idx_notes_prof           on public.professional_notes(professional_id);
create index if not exists idx_msg_sender           on public.patient_messages(sender_user_id);
create index if not exists idx_raw_patient          on public.raw_device_data(patient_user_id);
create index if not exists idx_raw_device           on public.raw_device_data(device_id);
create index if not exists idx_targets_prof         on public.cardio_targets(professional_id);
create index if not exists idx_monitoring_prof      on public.monitoring_plan(professional_id);
create index if not exists idx_alerts_assigned      on public.cardio_alerts(assigned_to);
create index if not exists idx_alerts_resolved_by   on public.cardio_alerts(resolved_by);
create index if not exists idx_feedback_user        on public.feedback(user_id);
create index if not exists idx_feedback_reply_author on public.feedback_replies(author_id);
create index if not exists idx_beta_user            on public.beta_events(user_id);
create index if not exists idx_meds_prescriber      on public.cardio_medications(prescribed_by);
