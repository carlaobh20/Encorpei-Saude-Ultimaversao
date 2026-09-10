-- ══════════════════════════════════════════════════════════════════════
-- LIMITE DE PACIENTES DERIVADO DO PLANO
-- ══════════════════════════════════════════════════════════════════════
--
-- BUG encontrado no teste contra banco real (10/09/2026), não em revisão de
-- código. A migração de segurança protegeu approval_status, is_verified e
-- plan_type — e deixou passar exatamente o número que define quantos
-- pacientes o médico pode ter.
--
-- `nascer_pendente` fazia `max_patients := coalesce(new.max_patients, 5)`.
-- O coalesce só preenche quando o valor vem NULO: um cadastro enviando
-- `max_patients: 999` ficava com 999. No teste, o cadastro pediu
-- approved/rede/999 e ficou pending/trial/**999**. Dois de três.
--
-- A correção não é "proteger mais um campo": é tirar o campo da mão de
-- quem cadastra. O limite passa a ser CONSEQUÊNCIA do plano.

create or replace function public.limite_do_plano(_plano professional_plan)
returns integer language sql immutable set search_path = public as $$
  select case _plano
    when 'trial'       then 5
    when 'consultorio' then 60
    when 'clinica'     then 250
    when 'rede'        then 5000
  end;
$$;

create or replace function public.nascer_pendente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.approval_status := 'pending';
    new.is_verified     := false;
    new.plan_type       := 'trial';
  end if;
  -- Derivado SEMPRE, inclusive para admin: o limite é consequência do plano,
  -- não um campo que alguém digita.
  new.max_patients := public.limite_do_plano(new.plan_type);
  return new;
end;
$$;

create or replace function public.proteger_campos_administrativos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    new.max_patients := public.limite_do_plano(new.plan_type);
    return new;
  end if;

  new.approval_status  := old.approval_status;
  new.is_verified      := old.is_verified;
  new.rejection_reason := old.rejection_reason;
  new.plan_type        := old.plan_type;
  new.max_patients     := public.limite_do_plano(old.plan_type);
  return new;
end;
$$;

revoke all on function public.nascer_pendente() from public, anon, authenticated;
revoke all on function public.proteger_campos_administrativos() from public, anon, authenticated;

update public.professional_profiles
   set max_patients = public.limite_do_plano(plan_type)
 where max_patients is distinct from public.limite_do_plano(plan_type);
