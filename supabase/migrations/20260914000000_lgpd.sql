-- ═══════════════════════════════════════════════════════════════════════════
-- LGPD art. 18 — prova de SOLICITAÇÃO separada de prova de CONCLUSÃO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problema que esta migração resolve
-- ----------------------------------
-- Exportação e exclusão de dados eram feitas inteiramente no navegador, sob a
-- RLS do próprio paciente. Três consequências, todas comprovadas em auditoria:
--
--   · a exportação ignorava o erro de cada tabela e devolvia um JSON incompleto
--     que se parecia, byte a byte, com um JSON completo;
--   · a exclusão tocava tabelas que o paciente só pode LER (cardio_targets,
--     agora do médico; cardio_alerts; patient_messages, que sequer tem política
--     de DELETE). Um DELETE barrado por RLS não é erro: afeta zero linhas e
--     retorna sucesso. O app dizia "apagado" e nada tinha sido apagado;
--   · `auth.users` e os arquivos no Storage nunca eram tocados — o titular
--     continuava existindo depois de ler "apagamos tudo".
--
-- O trabalho passa para duas edge functions com service-role
-- (`exportar-meus-dados` e `excluir-minha-conta`). Esta tabela é o rastro que
-- sobra delas.
--
-- Por que uma tabela, e não só o audit_logs
-- -----------------------------------------
-- O art. 18 dá ao titular prazo de resposta. Responder exige saber QUANDO foi
-- pedido — não só quando terminou. Se o registro nascesse já concluído, uma
-- execução que falhasse no meio simplesmente não deixaria vestígio, e a
-- ausência de prova de pedido é indistinguível de "nunca pediram".
--
-- Por isso a linha nasce em 'requested' (solicitado_em), passa por 'running' e
-- só então vira 'completed' ou 'failed' (concluido_em + relatorio). Os dois
-- fatos ficam gravados separadamente, sempre.

create table if not exists public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  -- SEM `not null`: a coluna PRECISA aceitar null, porque o `on delete set null`
  -- abaixo é justamente o que faz o comprovante sobreviver ao titular. Com
  -- `not null` os dois se contradizem e o DELETE do usuário aborta com
  -- "null value in column user_id violates not-null constraint" — ou seja, a
  -- própria exclusão de conta que esta tabela existe para comprovar ficava
  -- impossível (e `admin_delete_user` quebrava junto).
  user_id       uuid references auth.users(id) on delete set null,
  tipo          text not null check (tipo in ('export','delete')),
  status        text not null default 'requested'
                  check (status in ('requested','running','completed','failed')),
  solicitado_em timestamptz not null default now(),
  concluido_em  timestamptz,
  -- Relatório verificável: tabelas consultadas/apagadas, contagem por tabela,
  -- e o que FALHOU com o motivo. É o que permite conferir a alegação depois.
  relatorio     jsonb not null default '{}'
);

-- `on delete set null` acima é deliberado: quando o titular é removido de
-- auth.users, a prova de que ele pediu a exclusão precisa SOBREVIVER a ele —
-- é justamente a prova de conformidade. `on delete cascade` apagaria o
-- comprovante junto com a conta, que é o oposto do objetivo.

create index if not exists data_requests_user_idx
  on public.data_requests(user_id, solicitado_em desc);

create index if not exists data_requests_pendentes_idx
  on public.data_requests(status, solicitado_em)
  where status in ('requested','running');

alter table public.data_requests enable row level security;

-- ── RLS ────────────────────────────────────────────────────────────────────
-- O dono lê os próprios pedidos; o admin lê todos (é quem responde à ANPD).
-- NINGUÉM escreve pelo cliente: as edge functions gravam com service-role, que
-- não passa por RLS. Ausência de política de INSERT/UPDATE/DELETE com RLS
-- ligada é negação — e é o que queremos: se o cliente pudesse inserir aqui,
-- qualquer um forjaria comprovante de exclusão.

drop policy if exists data_requests_owner_read on public.data_requests;
create policy data_requests_owner_read on public.data_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists data_requests_admin_read on public.data_requests;
create policy data_requests_admin_read on public.data_requests for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Sem grants de escrita: nem `authenticated` nem `anon` podem gravar.
revoke insert, update, delete on public.data_requests from authenticated, anon;
grant select on public.data_requests to authenticated;
