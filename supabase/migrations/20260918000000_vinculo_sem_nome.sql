-- ══════════════════════════════════════════════════════════════════════
-- O VÍNCULO NÃO PODE DEPENDER DE O PACIENTE JÁ TER DIGITADO O NOME
-- ══════════════════════════════════════════════════════════════════════
--
-- Encontrado no teste contra banco real (13/09/2026), não em revisão:
--
--   23502: null value in column "full_name" of relation "cardio_patients"
--
-- O gatilho de `auth.users` cria `profiles` com `full_name` nulo quando o
-- cadastro não trouxe nome nos metadados. `claim_invite` fazia
-- `insert into cardio_patients ... select p.full_name from profiles p` e
-- propagava esse nulo para uma coluna NOT NULL.
--
-- Na prática: o paciente que recebe o código do médico e digita ANTES de
-- completar o cadastro leva um erro de banco cru na cara — e o vínculo, que
-- é o passo que faz o produto existir, não acontece. A ordem "primeiro o
-- código, depois o resto" é natural para quem acabou de sair do consultório
-- com um papel na mão; o app é que não podia exigir o contrário.
--
-- Correção em duas camadas, porque uma só não basta:
--   1. `claim_invite` deixa de depender do nome (usa o que houver, ou nulo);
--   2. a coluna deixa de ser NOT NULL — nome é dado que se completa depois,
--      não pré-requisito para existir uma ficha clínica.

alter table public.cardio_patients alter column full_name drop not null;

create or replace function public.claim_invite(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_link   public.professional_patient_links%rowtype;
  v_nome   text;
  v_meu    text;
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

  if v_link.patient_user_id = auth.uid() then
    select display_name into v_nome from public.professional_profiles where id = v_link.professional_id;
    return jsonb_build_object('ok', true, 'already', true,
      'professional_id', v_link.professional_id, 'professional_name', v_nome);
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

  -- O nome entra se existir. Se não existir, o vínculo acontece assim mesmo e
  -- o onboarding completa depois — era exatamente isto que travava.
  select nullif(trim(coalesce(full_name, '')), '') into v_meu
    from public.profiles where user_id = auth.uid();

  insert into public.cardio_patients (user_id, professional_id, full_name)
  values (auth.uid(), v_link.professional_id, v_meu)
  on conflict (user_id) do update
    set professional_id = excluded.professional_id,
        full_name       = coalesce(public.cardio_patients.full_name, excluded.full_name);

  insert into public.cardio_targets (patient_user_id, professional_id)
  values (auth.uid(), v_link.professional_id)
  on conflict (patient_user_id) do nothing;

  select display_name into v_nome from public.professional_profiles where id = v_link.professional_id;
  return jsonb_build_object('ok', true,
    'professional_id', v_link.professional_id, 'professional_name', v_nome);
end;
$$;

revoke all on function public.claim_invite(text) from public, anon;
grant execute on function public.claim_invite(text) to authenticated, service_role;

-- Quando o paciente finalmente preenche o nome no cadastro, ele desce para a
-- ficha clínica sozinho — sem isso, a ficha ficaria sem nome para sempre e o
-- médico veria um paciente anônimo na carteira.
create or replace function public.propagar_nome_do_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.full_name is distinct from old.full_name
     and nullif(trim(coalesce(new.full_name, '')), '') is not null then
    update public.cardio_patients
       set full_name = new.full_name
     where user_id = new.user_id
       and (full_name is null or trim(full_name) = '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_propagar_nome on public.profiles;
create trigger trg_propagar_nome
  after update on public.profiles
  for each row execute function public.propagar_nome_do_perfil();

revoke all on function public.propagar_nome_do_perfil() from public, anon, authenticated;
