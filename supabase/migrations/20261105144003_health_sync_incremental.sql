-- Recebimento incremental. Nenhuma função ganha privilégios de administrador.
create table public.health_connections (
  id uuid primary key default gen_random_uuid(),
  patient_user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple_health','health_connect')),
  status text not null default 'active' check (status in ('active','revoked')),
  consent_version text not null default '2026-11-05',
  consent_at timestamptz not null default now(),
  revoked_at timestamptz,
  revision bigint not null default 0 check (revision >= 0),
  last_sync_at timestamptz,
  unique(patient_user_id,platform),
  unique(id,patient_user_id)
);
create table public.health_samples (
  connection_id uuid not null,
  patient_user_id uuid not null,
  external_id text not null check(length(external_id) between 1 and 500),
  source_id text not null check(length(source_id) between 1 and 250),
  source_name text not null check(length(source_name) between 1 and 160),
  metric text not null check(metric in ('heart_rate','spo2','steps','active_calories','sleep')),
  start_at timestamptz not null,
  end_at timestamptz not null,
  value numeric not null,
  unit text not null,
  updated_at timestamptz not null default now(),
  primary key(connection_id,source_id,external_id),
  foreign key(connection_id,patient_user_id) references public.health_connections(id,patient_user_id) on delete cascade,
  check(isfinite(start_at) and isfinite(end_at) and end_at >= start_at),
  check(value <> 'NaN'::numeric),
  check(
    (metric='heart_rate' and unit='bpm' and value between 20 and 260) or
    (metric='spo2' and unit='%' and value between 50 and 100) or
    (metric='steps' and unit='count' and value between 0 and 200000 and value=trunc(value)) or
    (metric='active_calories' and unit='kcal' and value between 0 and 20000) or
    (metric='sleep' and unit='asleep' and value=1 and end_at>start_at and end_at-start_at<=interval '24 hours')
  )
);
create index health_samples_patient_time on public.health_samples(patient_user_id,start_at desc);
create table public.health_sync_batches (
  connection_id uuid not null,
  patient_user_id uuid not null,
  batch_id uuid not null,
  request_hash text not null,
  revision bigint not null,
  received integer not null,
  removed integer not null,
  created_at timestamptz not null default now(),
  primary key(connection_id,batch_id),
  foreign key(connection_id,patient_user_id) references public.health_connections(id,patient_user_id) on delete cascade
);
alter table public.health_connections enable row level security;
alter table public.health_samples enable row level security;
alter table public.health_sync_batches enable row level security;
create policy health_connections_owner on public.health_connections for all to authenticated
  using(patient_user_id=(select auth.uid())) with check(patient_user_id=(select auth.uid()));
create policy health_connections_doctor on public.health_connections for select to authenticated
  using(public.is_linked_professional(patient_user_id,(select auth.uid())));
create policy health_samples_owner on public.health_samples for all to authenticated
  using(patient_user_id=(select auth.uid())) with check(patient_user_id=(select auth.uid()));
create policy health_samples_doctor on public.health_samples for select to authenticated
  using(public.is_linked_professional(patient_user_id,(select auth.uid())));
create policy health_batches_owner on public.health_sync_batches for all to authenticated
  using(patient_user_id=(select auth.uid())) with check(patient_user_id=(select auth.uid()));
grant select,insert,update,delete on public.health_connections,public.health_samples,public.health_sync_batches to authenticated;
revoke all on public.health_connections,public.health_samples,public.health_sync_batches from anon;

create function public.health_sync_batch(p_connection uuid,p_batch uuid,p_expected_revision bigint,p_samples jsonb,p_deletions jsonb default '[]')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.health_connections; old_batch public.health_sync_batches; item jsonb; stamp text;
  removed_count integer:=0; affected integer; next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  if p_batch is null or p_expected_revision is null or p_samples is null or p_deletions is null
    or jsonb_typeof(p_samples)<>'array' or jsonb_typeof(p_deletions)<>'array' then
    raise exception 'Lote inválido' using errcode='22023'; end if;
  if jsonb_array_length(p_samples)+jsonb_array_length(p_deletions)>500 then raise exception 'Máximo 500 operações por lote' using errcode='22023'; end if;
  select * into c from public.health_connections where id=p_connection and patient_user_id=auth.uid() for update;
  if not found or c.status<>'active' then raise exception 'Conexão inexistente ou revogada' using errcode='42501'; end if;
  stamp:=md5(jsonb_build_object('samples',p_samples,'deletions',p_deletions,'revision',p_expected_revision)::text);
  select * into old_batch from public.health_sync_batches where connection_id=c.id and batch_id=p_batch;
  if found then
    if old_batch.request_hash<>stamp then raise exception 'ID de lote reutilizado com conteúdo diferente' using errcode='22023'; end if;
    return jsonb_build_object('revision',old_batch.revision,'received',old_batch.received,'removed',old_batch.removed,'replayed',true);
  end if;
  if c.revision<>p_expected_revision then raise exception 'Revisão desatualizada; recarregue a conexão' using errcode='40001'; end if;
  for item in select * from jsonb_array_elements(p_samples) loop
    if coalesce(item->>'start','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' or coalesce(item->>'end','') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$' then raise exception 'Fuso horário obrigatório' using errcode='22023'; end if;
    if (item->>'end')::timestamptz>now()+interval '5 minutes' then raise exception 'Data futura' using errcode='22023'; end if;
    insert into public.health_samples(connection_id,patient_user_id,external_id,source_id,source_name,metric,start_at,end_at,value,unit)
    values(c.id,auth.uid(),item->>'id',item->>'sourceId',item->>'source',item->>'type',(item->>'start')::timestamptz,(item->>'end')::timestamptz,(item->>'value')::numeric,item->>'unit')
    on conflict(connection_id,source_id,external_id) do update set
      source_name=excluded.source_name,metric=excluded.metric,start_at=excluded.start_at,end_at=excluded.end_at,value=excluded.value,unit=excluded.unit,updated_at=now();
  end loop;
  for item in select * from jsonb_array_elements(p_deletions) loop
    if coalesce(item->>'id','')='' or coalesce(item->>'sourceId','')='' then raise exception 'Exclusão inválida' using errcode='22023'; end if;
    delete from public.health_samples where connection_id=c.id and patient_user_id=auth.uid() and source_id=item->>'sourceId' and external_id=item->>'id';
    get diagnostics affected=row_count; removed_count:=removed_count+affected;
  end loop;
  next_revision:=c.revision+1;
  insert into public.health_sync_batches values(c.id,auth.uid(),p_batch,stamp,next_revision,jsonb_array_length(p_samples),removed_count,now());
  update public.health_connections set revision=next_revision,last_sync_at=now() where id=c.id;
  return jsonb_build_object('revision',next_revision,'received',jsonb_array_length(p_samples),'removed',removed_count,'replayed',false);
end $$;
revoke all on function public.health_sync_batch(uuid,uuid,bigint,jsonb,jsonb) from public,anon;
grant execute on function public.health_sync_batch(uuid,uuid,bigint,jsonb,jsonb) to authenticated;
