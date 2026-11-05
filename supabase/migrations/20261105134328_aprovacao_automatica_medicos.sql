-- Cadastro aberto solicitado pelo proprietário durante desenvolvimento.
-- Aprovação de acesso não equivale à verificação de CRM.
begin;

alter table public.professional_profiles
  alter column approval_status set default 'approved';

-- Mantém o nome usado pelo gatilho existente; não cria uma API pública.
create or replace function public.nascer_pendente()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
    new.approval_status := 'approved';
    new.is_verified := false;
    new.plan_type := 'trial';
    new.rejection_reason := null;
  end if;
  new.max_patients := public.limite_do_plano(new.plan_type);
  return new;
end;
$$;

revoke all on function public.nascer_pendente() from public, anon, authenticated;

-- Libera apenas os cadastros aguardando decisão; recusados não são reativados.
update public.professional_profiles
set approval_status = 'approved', rejection_reason = null
where approval_status = 'pending';

commit;
