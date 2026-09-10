-- ══════════════════════════════════════════════════════════════════════
-- SEGURANÇA — fechando o que a auditoria de setembro/2026 encontrou
-- ══════════════════════════════════════════════════════════════════════
--
-- A regra que orienta tudo aqui: barreira de tela não é autorização. Se a
-- interface distingue "meta prescrita pelo médico" de "sugestão", o BANCO
-- precisa fazer a mesma distinção — senão qualquer pessoa com o token de
-- sessão e um cliente HTTP reescreve o que quiser.
--
-- Sete buracos, na ordem de gravidade:
--   1. Médico podia se auto-aprovar e se dar plano ilimitado
--   2. Qualquer usuário podia sequestrar TODOS os convites pendentes
--   3. Paciente podia reescrever as metas clínicas prescritas pelo médico
--   4. Mensagem podia ser inserida em conversa alheia e apagada por qualquer lado
--   5. Cuidador podia editar as próprias permissões de acesso
--   6. Funções SECURITY DEFINER chamáveis diretamente pelo cliente
--   7. RPCs administrativas ausentes (telas de admin não funcionavam)
--
-- Nada aqui depende de o app se comportar bem. É tudo verificado no servidor.
-- ══════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════
-- 1. PERFIL PROFISSIONAL — separar cadastro de decisão administrativa
-- ══════════════════════════════════════════════════════════════════════
--
-- A política `pro_own` dava `for all` ao dono da linha. Como a mesma linha
-- guarda approval_status, is_verified, plan_type e max_patients, o médico
-- podia se aprovar, se verificar, virar plano "rede" e liberar 999 pacientes
-- com um único UPDATE. Isso não é hipótese: é o que `for all` significa.
--
-- Solução: o dono continua editando o CADASTRO; os campos de decisão viram
-- imutáveis para ele, via gatilho. Só admin muda.

create or replace function public.proteger_campos_administrativos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Admin pode tudo. Gatilho de sistema (sem sessão) também — é o caso das
  -- migrações e das funções internas.
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  -- Qualquer outro: os campos de decisão administrativa não se movem.
  new.approval_status  := old.approval_status;
  new.is_verified      := old.is_verified;
  new.rejection_reason := old.rejection_reason;
  new.plan_type        := old.plan_type;
  new.max_patients     := old.max_patients;
  return new;
end;
$$;

drop trigger if exists trg_proteger_pro on public.professional_profiles;
create trigger trg_proteger_pro
  before update on public.professional_profiles
  for each row execute function public.proteger_campos_administrativos();

-- Na INSERÇÃO o médico também não escolhe o próprio estado: nasce pendente,
-- não verificado, no plano de avaliação.
create or replace function public.nascer_pendente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.approval_status := 'pending';
    new.is_verified     := false;
    new.plan_type       := 'trial';
    new.max_patients    := coalesce(new.max_patients, 5);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pro_nasce_pendente on public.professional_profiles;
create trigger trg_pro_nasce_pendente
  before insert on public.professional_profiles
  for each row execute function public.nascer_pendente();

-- ══════════════════════════════════════════════════════════════════════
-- 2. CONVITES — o buraco mais grave
-- ══════════════════════════════════════════════════════════════════════
--
-- `links_patient_accept` permitia UPDATE quando `patient_user_id is null`.
-- UPDATE não precisa de política de SELECT para atingir uma linha: bastava
-- um `update professional_patient_links set patient_user_id = <eu>` sem WHERE
-- para um único usuário reivindicar TODOS os convites pendentes do sistema,
-- de todos os médicos, e passar a receber os dados desses vínculos.
--
-- O aceite passa a existir apenas dentro de claim_invite(), que exige o
-- código e é SECURITY DEFINER.

drop policy if exists links_patient_accept on public.professional_patient_links;

-- O paciente ainda pode ENCERRAR o próprio vínculo — isso é direito dele,
-- e não vaza nada: só alcança a linha que já é dele.
drop policy if exists links_patient_end on public.professional_patient_links;
create policy links_patient_end on public.professional_patient_links for update
  using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

-- Mesmo assim, o paciente não muda de médico sozinho nem se reativa.
create or replace function public.proteger_vinculo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;

  -- Se quem edita é o paciente (e não o médico dono do vínculo):
  if old.patient_user_id = auth.uid()
     and not exists (
       select 1 from professional_profiles p
        where p.id = old.professional_id and p.user_id = auth.uid()
     )
  then
    new.professional_id := old.professional_id;
    new.patient_user_id := old.patient_user_id;
    new.invite_code     := old.invite_code;
    new.started_at      := old.started_at;
    -- Só encerrar ou pausar. Nunca reativar por conta própria.
    if new.status not in ('ended', 'paused') then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_vinculo on public.professional_patient_links;
create trigger trg_proteger_vinculo
  before update on public.professional_patient_links
  for each row execute function public.proteger_vinculo();

-- Código de convite não pode ser adivinhável. Se o médico não informar um,
-- o banco gera um de 8 caracteres sem letras ambíguas (0/O, 1/I).
create or replace function public.gerar_codigo_convite()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativa text;
  i int;
begin
  if new.invite_code is not null and length(new.invite_code) >= 6 then
    return new;
  end if;
  loop
    tentativa := '';
    for i in 1..8 loop
      tentativa := tentativa || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from professional_patient_links where invite_code = tentativa);
  end loop;
  new.invite_code := tentativa;
  return new;
end;
$$;

drop trigger if exists trg_codigo_convite on public.professional_patient_links;
create trigger trg_codigo_convite
  before insert on public.professional_patient_links
  for each row execute function public.gerar_codigo_convite();

-- Convite pendente expira. Um código que vale para sempre é um código que
-- vaza. 30 dias é o prazo; claim_invite() já recusa vínculo 'ended'.
create or replace function public.expirar_convites_antigos()
returns integer language sql security definer set search_path = public as $$
  with expirados as (
    update professional_patient_links
       set status = 'ended', ended_at = now()
     where patient_user_id is null
       and status = 'pending'
       and created_at < now() - interval '30 days'
    returning 1
  ) select count(*)::int from expirados;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- 3. METAS CLÍNICAS — o paciente não reescreve a prescrição
-- ══════════════════════════════════════════════════════════════════════
--
-- `cardio_targets` estava na lista genérica de tabelas com escrita livre do
-- paciente. Ou seja: a interface mostrava "meta definida pelo seu médico" e
-- o banco deixava o próprio paciente mudar o número — incluindo os limiares
-- que disparam alerta. Agora quem prescreve é só o médico vinculado.

drop policy if exists cardio_targets_patient_all on public.cardio_targets;

drop policy if exists cardio_targets_patient_read on public.cardio_targets;
create policy cardio_targets_patient_read on public.cardio_targets for select
  using (
    patient_user_id = auth.uid()
    or public.is_active_caregiver(patient_user_id, auth.uid())
  );

-- O paciente cria a própria linha uma vez (para não ficar sem referência
-- nenhuma antes de ter médico), com os valores PADRÃO — nunca escolhidos.
drop policy if exists cardio_targets_patient_seed on public.cardio_targets;
create policy cardio_targets_patient_seed on public.cardio_targets for insert
  with check (patient_user_id = auth.uid() and professional_id is null);

create or replace function public.proteger_metas()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;

  -- Semente do próprio paciente: força os padrões, ignora o que veio.
  if tg_op = 'INSERT' and new.patient_user_id = auth.uid()
     and not public.is_linked_professional(new.patient_user_id, auth.uid())
  then
    new.bp_systolic_max := 130; new.bp_diastolic_max := 80;
    new.ldl_max := 100; new.resting_hr_min := 50; new.resting_hr_max := 80;
    new.dry_weight_kg := null; new.training_hr_min := null; new.training_hr_max := null;
    -- professional_id só sobrevive se houver vínculo ATIVO entre este
    -- paciente e este profissional. É o caso do claim_invite(), que cria a
    -- linha de metas no mesmo instante em que o vínculo passa a existir.
    if new.professional_id is not null and not exists (
      select 1 from public.professional_patient_links l
       where l.patient_user_id = new.patient_user_id
         and l.professional_id = new.professional_id
         and l.status = 'active'
    ) then
      new.professional_id := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_metas on public.cardio_targets;
create trigger trg_proteger_metas
  before insert on public.cardio_targets
  for each row execute function public.proteger_metas();

-- Onde o paciente PODE opinar: metas de comportamento (passos, sono, sódio,
-- minutos de exercício). Isso é dele, não prescrição. Vive em tabela própria
-- para não misturar autorrelato com conduta médica.
create table if not exists public.patient_goals (
  patient_user_id   uuid primary key references auth.users(id) on delete cascade,
  steps_per_day     integer,
  mvpa_minutes_week integer,
  sleep_hours       numeric(3,1),
  sodium_mg_day     integer,
  observacao        text,
  updated_at        timestamptz not null default now()
);

alter table public.patient_goals enable row level security;

drop policy if exists patient_goals_own on public.patient_goals;
create policy patient_goals_own on public.patient_goals for all
  using (patient_user_id = auth.uid()) with check (patient_user_id = auth.uid());

drop policy if exists patient_goals_doctor on public.patient_goals;
create policy patient_goals_doctor on public.patient_goals for select
  using (public.is_linked_professional(patient_user_id, auth.uid()));

drop trigger if exists touch_patient_goals on public.patient_goals;
create trigger touch_patient_goals before update on public.patient_goals
  for each row execute function public.touch_updated_at();

-- ══════════════════════════════════════════════════════════════════════
-- 4. MENSAGENS — uma política por operação
-- ══════════════════════════════════════════════════════════════════════
--
-- `messages_participants` era `for all` com `with check (sender_user_id =
-- auth.uid())`: o WITH CHECK garantia só que o remetente era quem dizia ser,
-- sem exigir que ele participasse daquela conversa. E o `for all` dava
-- DELETE — qualquer lado apagava a mensagem do outro, destruindo o histórico
-- clínico. Agora cada operação tem a sua regra.

drop policy if exists messages_participants on public.patient_messages;

drop policy if exists messages_read on public.patient_messages;
create policy messages_read on public.patient_messages for select
  using (
    patient_user_id = auth.uid()
    or public.is_linked_professional(patient_user_id, auth.uid())
  );

-- Inserir exige as DUAS coisas: ser o remetente E participar da conversa.
drop policy if exists messages_insert on public.patient_messages;
create policy messages_insert on public.patient_messages for insert
  with check (
    sender_user_id = auth.uid()
    and (
      (sender = 'patient' and patient_user_id = auth.uid())
      or (sender = 'doctor' and public.is_linked_professional(patient_user_id, auth.uid()))
    )
  );

-- Update existe por um motivo só: marcar como lida. O gatilho abaixo garante
-- que nada mais mude.
drop policy if exists messages_mark_read on public.patient_messages;
create policy messages_mark_read on public.patient_messages for update
  using (
    patient_user_id = auth.uid()
    or public.is_linked_professional(patient_user_id, auth.uid())
  )
  with check (
    patient_user_id = auth.uid()
    or public.is_linked_professional(patient_user_id, auth.uid())
  );

create or replace function public.mensagem_imutavel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;
  new.patient_user_id := old.patient_user_id;
  new.sender_user_id  := old.sender_user_id;
  new.sender          := old.sender;
  new.body            := old.body;
  new.attachment_url  := old.attachment_url;
  new.created_at      := old.created_at;
  -- Só quem RECEBEU marca como lida.
  if new.read_at is distinct from old.read_at and old.sender_user_id = auth.uid() then
    new.read_at := old.read_at;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_mensagem_imutavel on public.patient_messages;
create trigger trg_mensagem_imutavel
  before update on public.patient_messages
  for each row execute function public.mensagem_imutavel();

-- Sem política de DELETE: mensagem clínica não se apaga. Exclusão de conta
-- passa pela rotina de LGPD, no servidor.

-- ══════════════════════════════════════════════════════════════════════
-- 5. CUIDADOR — quem concede o acesso é o paciente, não o beneficiário
-- ══════════════════════════════════════════════════════════════════════
--
-- `caregiver_self_accept` permitia ao cuidador dar UPDATE na própria linha,
-- inclusive nas colunas ver_sintomas / ver_exames / receber_alertas. Ou seja:
-- quem recebe o acesso escolhia o tamanho do acesso. E o `caregiver_user_id
-- is null` repetia o mesmo sequestro de convites do item 2.

drop policy if exists caregiver_self_accept on public.caregiver_links;

create or replace function public.aceitar_convite_cuidador(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_link public.caregiver_links%rowtype; v_nome text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_link from public.caregiver_links
   where upper(invite_code) = upper(trim(p_code)) limit 1;

  if not found then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if v_link.caregiver_user_id = auth.uid() then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_link.caregiver_user_id is not null then
    return jsonb_build_object('ok', false, 'error', 'code_already_used');
  end if;
  if v_link.status = 'revoked' then
    return jsonb_build_object('ok', false, 'error', 'code_revoked');
  end if;
  -- O paciente não pode ser o próprio cuidador (o vínculo existiria só para
  -- burlar as permissões que ele já tem).
  if v_link.patient_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'self_link');
  end if;

  update public.caregiver_links
     set caregiver_user_id = auth.uid(), status = 'active', aceito_em = now()
   where id = v_link.id;

  select full_name into v_nome from public.profiles where user_id = v_link.patient_user_id;
  return jsonb_build_object('ok', true, 'patient_name', v_nome);
end;
$$;

grant execute on function public.aceitar_convite_cuidador(text) to authenticated;

-- O cuidador pode ENCERRAR o próprio vínculo (sair). Nada além disso.
drop policy if exists caregiver_self_leave on public.caregiver_links;
create policy caregiver_self_leave on public.caregiver_links for update
  using (caregiver_user_id = auth.uid())
  with check (caregiver_user_id = auth.uid() and status = 'revoked');

create or replace function public.proteger_cuidador()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;

  -- Quem edita é o cuidador: só o campo status muda, e só para 'revoked'.
  if old.caregiver_user_id = auth.uid() and old.patient_user_id <> auth.uid() then
    new.patient_user_id := old.patient_user_id;
    new.caregiver_user_id := old.caregiver_user_id;
    new.invite_code := old.invite_code;
    new.ver_medidas := old.ver_medidas;
    new.ver_remedios := old.ver_remedios;
    new.ver_sintomas := old.ver_sintomas;
    new.ver_exames := old.ver_exames;
    new.receber_alertas := old.receber_alertas;
    new.aceito_em := old.aceito_em;
    if new.status <> 'revoked' then new.status := old.status; end if;
    if new.status = 'revoked' then new.revogado_em := coalesce(new.revogado_em, now()); end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_cuidador on public.caregiver_links;
create trigger trg_proteger_cuidador
  before update on public.caregiver_links
  for each row execute function public.proteger_cuidador();

-- Código do convite do cuidador também deixa de ser adivinhável.
create or replace function public.gerar_codigo_cuidador()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  tentativa text; i int;
begin
  if new.invite_code is not null and length(new.invite_code) >= 6 then return new; end if;
  loop
    tentativa := '';
    for i in 1..8 loop
      tentativa := tentativa || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from caregiver_links where invite_code = tentativa);
  end loop;
  new.invite_code := tentativa;
  return new;
end;
$$;

drop trigger if exists trg_codigo_cuidador on public.caregiver_links;
create trigger trg_codigo_cuidador
  before insert on public.caregiver_links
  for each row execute function public.gerar_codigo_cuidador();

-- ══════════════════════════════════════════════════════════════════════
-- 6. FUNÇÕES PRIVILEGIADAS — tirar da mão do cliente
-- ══════════════════════════════════════════════════════════════════════
--
-- `log_audit_event` aceitava a identidade do autor como PARÂMETRO: qualquer
-- cliente podia gravar auditoria em nome de outra pessoa — o que é pior que
-- não ter auditoria, porque parece confiável. `registrar_alerta` aceitava
-- paciente e conteúdo sem validar autorização: dava para injetar alerta
-- falso na fila de qualquer médico. Ambas são SECURITY DEFINER e nenhuma
-- tinha revogação de EXECUTE.
--
-- Correção: revogar a execução pelo cliente. Elas continuam existindo para
-- os gatilhos internos, que rodam com o dono da função.

revoke all on function public.registrar_alerta(uuid, text, alert_severity, text, text, text, text) from public, anon, authenticated;
revoke all on function public.expirar_convites_antigos() from public, anon, authenticated;
revoke all on function public.proteger_campos_administrativos() from public, anon, authenticated;
revoke all on function public.nascer_pendente() from public, anon, authenticated;
revoke all on function public.proteger_vinculo() from public, anon, authenticated;
revoke all on function public.proteger_metas() from public, anon, authenticated;
revoke all on function public.mensagem_imutavel() from public, anon, authenticated;
revoke all on function public.proteger_cuidador() from public, anon, authenticated;
revoke all on function public.gerar_codigo_convite() from public, anon, authenticated;
revoke all on function public.gerar_codigo_cuidador() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.alerta_pressao() from public, anon, authenticated;
revoke all on function public.alerta_peso() from public, anon, authenticated;
revoke all on function public.alerta_fc() from public, anon, authenticated;
revoke all on function public.alerta_spo2() from public, anon, authenticated;
revoke all on function public.alerta_sintoma() from public, anon, authenticated;

-- `log_audit_event` é substituída por uma versão que DERIVA o autor da
-- sessão. A assinatura antiga é removida para que nenhum código continue
-- passando identidade forjada.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as assinatura
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'log_audit_event'
  loop
    execute format('drop function if exists %s cascade', r.assinatura);
  end loop;
end $$;

create or replace function public.log_audit_event(
  p_action text,
  p_description text,
  p_risk_level text default 'low',
  p_patient_user_id uuid default null,
  p_resource_type text default null,
  p_resource_id text default null,
  p_metadata jsonb default '{}'
) returns void language plpgsql security definer set search_path = public as $$
declare v_papel text;
begin
  if auth.uid() is null then return; end if;

  -- O papel é DERIVADO, não informado: era exatamente o campo que o cliente
  -- podia forjar para fazer uma ação parecer administrativa.
  v_papel := case
    when public.has_role(auth.uid(), 'admin') then 'admin'
    when exists (select 1 from public.professional_profiles p where p.user_id = auth.uid()) then 'professional'
    else 'patient' end;

  insert into public.audit_logs
    (action, risk_level, actor_id, actor_role, patient_user_id, resource_type, resource_id, description, metadata)
  values
    (p_action, coalesce(p_risk_level, 'low'), auth.uid(), v_papel,
     p_patient_user_id, p_resource_type, p_resource_id, p_description, coalesce(p_metadata, '{}'));
end;
$$;

grant execute on function public.log_audit_event(text, text, text, uuid, text, text, jsonb) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 7. RPCs ADMINISTRATIVAS — o app chamava, o banco não tinha
-- ══════════════════════════════════════════════════════════════════════
--
-- Cinco funções eram chamadas pelas telas de admin e não existiam em
-- migração nenhuma. Todas verificam o papel INTERNAMENTE: SECURITY DEFINER
-- sem checagem de papel é escalação de privilégio embrulhada para presente.

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'usuarios',            (select count(*) from auth.users),
    'pacientes',           (select count(*) from public.cardio_patients),
    'profissionais',       (select count(*) from public.professional_profiles),
    'profissionais_pendentes', (select count(*) from public.professional_profiles where approval_status = 'pending'),
    'vinculos_ativos',     (select count(*) from public.professional_patient_links where status = 'active'),
    'alertas_abertos',     (select count(*) from public.cardio_alerts where is_dismissed = false),
    'medidas_7d',          (select count(*) from public.bp_readings where recorded_at > now() - interval '7 days'),
    -- "Aberto" = ainda dá trabalho a alguém. 'open' continua na lista só por
    -- causa de linhas anteriores à padronização do status (ver integração §6).
    'feedback_aberto',     (select count(*) from public.feedback where status in ('new','in_review','open')),
    'gerado_em',           now()
  );
end;
$$;

create or replace function public.admin_list_users(
  p_search text default null,
  p_limit int default 50,
  p_offset int default 0
) returns table (
  user_id uuid, email text, full_name text, criado_em timestamptz,
  ultimo_acesso timestamptz, papeis text[], eh_profissional boolean, confirmado boolean
) language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, p.full_name, u.created_at, u.last_sign_in_at,
         coalesce(array_agg(r.role::text) filter (where r.role is not null), '{}'),
         exists (select 1 from public.professional_profiles pp where pp.user_id = u.id),
         u.email_confirmed_at is not null
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.user_roles r on r.user_id = u.id
   where p_search is null
      or u.email ilike '%' || p_search || '%'
      or p.full_name ilike '%' || p_search || '%'
   group by u.id, u.email, p.full_name, u.created_at, u.last_sign_in_at, u.email_confirmed_at
   order by u.created_at desc
   limit greatest(1, least(p_limit, 200)) offset greatest(0, p_offset);
end;
$$;

create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado' using errcode = '42501';
  end if;
  -- Um admin não se apaga por acidente no meio da operação.
  if p_user_id = auth.uid() then
    raise exception 'nao e possivel excluir a propria conta por aqui' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  perform public.log_audit_event(
    'admin:user_deleted',
    'Administrador excluiu definitivamente a conta ' || v_email,
    'high', null, 'auth.users', p_user_id::text,
    jsonb_build_object('email', v_email));

  -- Cascata: tudo que referencia auth.users tem ON DELETE CASCADE.
  delete from auth.users where id = p_user_id;
  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;

create or replace function public.admin_professional_metrics(p_professional_id uuid default null)
returns table (
  professional_id uuid, display_name text, clinic_name text, approval_status text,
  plan_type text, pacientes int, pacientes_ativos int, alertas_abertos int,
  mensagens_30d int, ultima_atividade timestamptz
) language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  select pp.id, pp.display_name, pp.clinic_name,
         pp.approval_status::text, pp.plan_type::text,
         (select count(*)::int from professional_patient_links l where l.professional_id = pp.id),
         (select count(*)::int from professional_patient_links l where l.professional_id = pp.id and l.status = 'active'),
         (select count(*)::int from cardio_alerts a where a.professional_id = pp.id and a.is_dismissed = false),
         (select count(*)::int from patient_messages m
            join professional_patient_links l on l.patient_user_id = m.patient_user_id
           where l.professional_id = pp.id and m.sender = 'doctor'
             and m.created_at > now() - interval '30 days'),
         (select max(m.created_at) from patient_messages m
            join professional_patient_links l on l.patient_user_id = m.patient_user_id
           where l.professional_id = pp.id and m.sender = 'doctor')
    from professional_profiles pp
   where p_professional_id is null or pp.id = p_professional_id
   order by pp.created_at desc;
end;
$$;

create or replace function public.admin_professional_patients(p_professional_id uuid)
returns table (
  patient_user_id uuid, full_name text, status text, vinculado_em timestamptz,
  ultima_medida timestamptz, alertas_abertos int
) language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'acesso negado' using errcode = '42501';
  end if;

  return query
  select l.patient_user_id, p.full_name, l.status::text, l.started_at,
         (select max(b.recorded_at) from bp_readings b where b.patient_user_id = l.patient_user_id),
         (select count(*)::int from cardio_alerts a
           where a.patient_user_id = l.patient_user_id and a.is_dismissed = false)
    from professional_patient_links l
    left join profiles p on p.user_id = l.patient_user_id
   where l.professional_id = p_professional_id and l.patient_user_id is not null
   order by l.started_at desc nulls last;
end;
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_list_users(text, int, int) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
grant execute on function public.admin_professional_metrics(uuid) to authenticated;
grant execute on function public.admin_professional_patients(uuid) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- 8. FEEDBACK — a tabela de respostas que o app esperava
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.feedback_replies (
  id          uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  author_role text not null default 'admin',
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_replies_fb_idx on public.feedback_replies(feedback_id, created_at);

-- Colunas que o app realmente escreve (useSendFeedbackReply): ele manda
-- `message` e `author_name`, nunca `body`. Sem isto todo envio de resposta
-- morria em "column author_name does not exist" — e, passado isso, em `body`
-- not null. Mesmo tratamento dado a `feedback.body` na migração de integração:
-- a coluna antiga fica, deixa de ser obrigatória e o conteúdo é migrado.
alter table public.feedback_replies add column if not exists author_name text;
alter table public.feedback_replies add column if not exists message     text;
update public.feedback_replies set message = coalesce(message, body) where message is null;
alter table public.feedback_replies alter column body drop not null;

-- O cliente não informa quem é: o banco carimba. Assim o `author_id =
-- auth.uid()` das políticas continua valendo sem depender do app mandar o
-- campo certo (e sem deixar ninguém assinar em nome de outro).
alter table public.feedback_replies alter column author_id set default auth.uid();

alter table public.feedback_replies enable row level security;

drop policy if exists feedback_replies_read on public.feedback_replies;
create policy feedback_replies_read on public.feedback_replies for select
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
  );

drop policy if exists feedback_replies_admin_write on public.feedback_replies;
create policy feedback_replies_admin_write on public.feedback_replies for insert
  with check (public.has_role(auth.uid(), 'admin') and author_id = auth.uid());

-- A conversa tem DOIS lados. A tela do paciente/médico ("Escreva sua resposta
-- para a equipe", em MyFeedbackList) só existia na interface: no banco apenas
-- o admin podia inserir, então responder o próprio feedback sempre falhava.
-- Quem abriu o feedback responde nele — e só como 'user', nunca como 'admin'.
drop policy if exists feedback_replies_owner_write on public.feedback_replies;
create policy feedback_replies_owner_write on public.feedback_replies for insert
  with check (
    author_id = auth.uid()
    and author_role = 'user'
    and exists (select 1 from public.feedback f where f.id = feedback_id and f.user_id = auth.uid())
  );

-- ══════════════════════════════════════════════════════════════════════
-- 9. GLICEMIA — faltava o contexto pré-prandial
-- ══════════════════════════════════════════════════════════════════════
--
-- A restrição só aceitava fasting / post_meal / random / bedtime. Sem
-- 'pre_meal', uma medida pré-prandial cairia em 'random' e o médico leria
-- como avulsa — o que muda a interpretação.

alter table public.glucose_readings drop constraint if exists glucose_readings_context_check;
alter table public.glucose_readings add constraint glucose_readings_context_check
  check (context in ('fasting','pre_meal','post_meal','random','bedtime'));

-- ══════════════════════════════════════════════════════════════════════
-- 10. HISTÓRICO — índices para consulta por intervalo
-- ══════════════════════════════════════════════════════════════════════
--
-- O app carregava "os últimos 200 registros" de cada tabela. Com sinal de
-- alta frequência, 200 linhas cobrem poucos dias e o resumo de 90 dias sai
-- errado sem avisar. A correção do lado do cliente é consultar por
-- INTERVALO; do lado do banco, é ter índice para isso não ficar caro.

do $$
declare t text;
begin
  foreach t in array array[
    'bp_readings','hr_readings','spo2_readings','weight_readings','glucose_readings',
    'symptom_reports','medication_intakes','cardio_alerts'
  ] loop
    begin
      execute format(
        'create index if not exists %I on public.%I (patient_user_id, %I desc)',
        t || '_paciente_tempo_idx', t,
        case t
          when 'symptom_reports' then 'occurred_at'
          when 'cardio_alerts' then 'triggered_at'
          when 'medication_intakes' then 'intake_date'
          else 'recorded_at'
        end);
    exception when others then
      null; -- coluna diferente em alguma versão do schema: não trava a migração
    end;
  end loop;
end $$;
