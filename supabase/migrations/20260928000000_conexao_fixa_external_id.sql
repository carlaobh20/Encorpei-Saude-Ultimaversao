-- ══════════════════════════════════════════════════════════════════════
-- CONEXÃO FIXA: LEMBRAR O APARELHO QUE O NAVEGADOR JÁ AUTORIZOU
-- ══════════════════════════════════════════════════════════════════════
--
-- O nome anunciado por Bluetooth repete entre pulseiras do mesmo lote.
-- Sem um id estável, a ligação só existe enquanto /pulseira está aberta
-- e o paciente escolhe o aparelho de novo na lista.
--
-- `external_id` é o id local que o Web Bluetooth devolve em `device.id`.
-- Não é UUID de serviço GATT, não é comando e não descreve pacote.
-- Sono, oxigenação, passos e pressão estimada continuam no arquivo
-- importado — esta coluna não abre caminho novo para eles.
--
-- Políticas de `registered_devices` não mudam: a coluna nova entra nas
-- linhas que o paciente já pode ler e gravar.

alter table public.registered_devices
  add column if not exists external_id text;

create unique index if not exists idx_devices_patient_external
  on public.registered_devices (patient_user_id, external_id)
  where external_id is not null;
