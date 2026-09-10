-- ═══════════════════════════════════════════════════════════════════════════
-- ALERTAS: de "lido/dispensado" para um fluxo de trabalho auditável
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Problema que esta migração resolve
-- ----------------------------------
-- `cardio_alerts` só tinha `is_read` e `is_dismissed`. Isso responde "alguém
-- olhou?" e não responde nenhuma das perguntas que importam quando um alerta
-- crítico some da tela:
--
--   · quem assumiu este alerta?
--   · o paciente chegou a ser contatado, ou só marcaram como lido?
--   · por que foi encerrado?
--   · quando, e por quem?
--
-- Num produto que classifica risco cardiovascular, "dispensado" sem
-- justificativa é um buraco de rastreabilidade: em qualquer revisão de evento
-- adverso a pergunta é exatamente "o alerta disparou — o que foi feito?".
--
-- O fluxo: open → reviewing → contacted → resolved
--
--   open       o motor disparou, ninguém assumiu
--   reviewing  um profissional assumiu e está avaliando (assigned_to)
--   contacted  o paciente foi contatado — o passo que mais se perdia, porque
--              antes "contatei o paciente e estou aguardando" e "não olhei"
--              eram o mesmo estado visual
--   resolved   encerrado com responsável (resolved_by) e justificativa
--              (resolution_note)
--
-- Compatibilidade
-- ---------------
-- `is_read` e `is_dismissed` PERMANECEM e continuam sendo a fonte de verdade
-- para o app do paciente, para o badge do shell e para as políticas de RLS já
-- existentes. Só acrescentamos colunas e um gatilho que mantém as duas visões
-- coerentes, para que nenhuma tela ainda não migrada quebre. Removê-las seria
-- uma segunda mudança, com o seu próprio risco, e não é o que esta migração faz.

alter table public.cardio_alerts
  add column if not exists workflow_status text not null default 'open'
    check (workflow_status in ('open','reviewing','contacted','resolved')),
  add column if not exists assigned_to uuid references auth.users(id),
  add column if not exists resolution_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id);

comment on column public.cardio_alerts.workflow_status is
  'Fluxo de trabalho do alerta: open → reviewing → contacted → resolved.';
comment on column public.cardio_alerts.assigned_to is
  'Profissional que assumiu o alerta. Sem responsável, "em avaliação" não quer dizer nada.';
comment on column public.cardio_alerts.resolution_note is
  'Justificativa obrigatória na tela ao resolver — o que foi verificado e qual foi o desfecho.';

-- A fila de trabalho do médico é sempre "meus alertas, por estado". Sem este
-- índice, cada abertura do painel faz seq scan na tabela que mais cresce.
create index if not exists idx_alerts_workflow
  on public.cardio_alerts(professional_id, workflow_status);

-- Alertas que já existiam: quem foi dispensado já teve um desfecho (ainda que
-- sem nota), quem foi lido estava em avaliação, o resto continua aberto.
-- Sem esta retroalimentação, a tela abriria com todo o histórico em "aberto" e
-- o médico veria uma fila de trabalho falsa no primeiro dia.
update public.cardio_alerts
   set workflow_status = case
         when is_dismissed then 'resolved'
         when is_read     then 'reviewing'
         else 'open'
       end
 where workflow_status = 'open';

update public.cardio_alerts
   set resolved_at = coalesce(resolved_at, triggered_at),
       resolution_note = coalesce(resolution_note, 'Dispensado antes do fluxo de trabalho existir — sem justificativa registrada.')
 where workflow_status = 'resolved';

-- ── Coerência entre o fluxo novo e as flags antigas ────────────────────────
-- Duas fontes de verdade para o mesmo fato divergem, sempre. Como não podemos
-- remover is_read/is_dismissed nesta migração (ver "Compatibilidade"), o banco
-- passa a derivá-las do fluxo: qualquer estado além de 'open' implica lido, e
-- 'resolved' implica dispensado. A direção contrária não é forçada de
-- propósito — uma tela antiga que marque is_read não deve poder afirmar que
-- alguém assumiu o alerta.

create or replace function public.sync_alerta_workflow()
returns trigger
language plpgsql
as $$
begin
  if new.workflow_status is distinct from 'open' then
    new.is_read := true;
  end if;

  if new.workflow_status = 'resolved' then
    new.is_dismissed := true;
    new.resolved_at  := coalesce(new.resolved_at, now());
  else
    -- Reabrir um alerta tem que devolvê-lo à fila de verdade.
    new.is_dismissed := false;
    new.resolved_at  := null;
    new.resolved_by  := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_alerta_workflow on public.cardio_alerts;
create trigger trg_sync_alerta_workflow
  before insert or update of workflow_status, resolved_by, resolution_note
  on public.cardio_alerts
  for each row execute function public.sync_alerta_workflow();
