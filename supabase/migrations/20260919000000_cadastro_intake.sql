-- ============================================================================
-- Cadastro progressivo — JSONB `intake` + foto de perfil
-- ============================================================================
-- Objetivo, sono habitual e atividade física entram em `cardio_patients.intake`
-- para não espalhar uma coluna por chip. Comorbidades e história cardio
-- continuam em `comorbidities` / `history`.
--
-- Foto: `profiles.avatar_url` já existia sem UI. O bucket `avatars` é público
-- (o paciente vê a própria foto; o médico vinculado também). Se o upload
-- falhar no cliente, a tela cai nas iniciais — nada clínico depende disto.

alter table public.cardio_patients
  add column if not exists intake jsonb not null default '{}'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 2097152)
on conflict (id) do nothing;

drop policy if exists avatars_owner on storage.objects;
create policy avatars_owner on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects for select
  using (bucket_id = 'avatars');
