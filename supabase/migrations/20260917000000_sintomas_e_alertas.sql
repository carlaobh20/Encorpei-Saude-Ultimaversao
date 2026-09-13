-- ═══════════════════════════════════════════════════════════════════════════
-- SINTOMAS E ALERTAS: fechar os caminhos por onde o dado clínico se perdia
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Esta migração responde a quatro achados de auditoria em que o dado existia,
-- o paciente fez a sua parte, e mesmo assim nada chegava ao cardiologista:
--
--   §1  `alerta_sintoma` classificava códigos de sintoma que o app NUNCA
--       gravou. Dor no peito relatada por paciente caía no `else 'info'` e o
--       gatilho retornava sem inserir alerta nenhum.
--   §2  O paciente não tinha como tirar um alerta da própria tela: a única
--       política dele em `cardio_alerts` era `for select`. O UPDATE do app
--       afetava zero linhas, sem erro, e o alerta reaparecia no refetch.
--   §3  `mensagem_imutavel` desfazia mudanças em SILÊNCIO — quem chamava não
--       tinha como distinguir "marquei como lida" de "o banco desfez".
--   §4  A aba "Atraso operacional" do médico nunca teve conteúdo porque
--       nenhum gatilho emitia alerta de adesão ou de ausência de registro.
--
-- REGRAS INEGOCIÁVEIS preservadas aqui:
--   · nenhum texto prescreve conduta (SaMD/ANVISA — docs §6);
--   · PA com `validation_status = 'estimated'` (pulseira) não dispara alerta —
--     esta migração não toca em `alerta_pressao`, que já garante isso;
--   · dor torácica em repouso e síncope são `emergency`.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SINTOMAS — uma lista canônica, escrita por extenso, para os dois lados
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A CAUSA DO BUG: existiam duas listas de códigos de sintoma e elas nunca se
-- encontraram.
--
--   O app grava (SINTOMAS em src/pages/SintomasPage.tsx, tipo `SymptomType`
--   em src/types/cardio.ts):
--
--       chest_pain · dyspnea · palpitations · edema · syncope · presyncope
--       claudication · dry_cough · fatigue · dizziness
--
--   O gatilho classificava (nenhum destes é gravado por nenhuma tela):
--
--       chest_pain_rest · dyspnea_rest · chest_pain_exertion
--       dyspnea_exertion · orthopnea · palpitations_syncope
--
-- Resultado prático: `chest_pain` não estava em nenhum dos dois ramos do
-- `case`, caía em `'info'`, e a linha seguinte (`if v_sev = 'info' then return
-- new`) encerrava o gatilho antes do insert. O sintoma cardinal da
-- cardiologia não gerava alerta nenhum.
--
-- A LISTA ACIMA É CANÔNICA. Ela existe em três lugares e os três mudam no
-- mesmo commit: `SymptomType` (tipos), `SINTOMAS` (tela) e este comentário
-- (banco). Nenhum código novo entra aqui antes de a tela gravá-lo.
--
-- REPOUSO × ESFORÇO vem de `qualifiers`, não de um código separado — foi
-- justamente a tentativa de codificar a circunstância no `symptom_type` que
-- criou a divergência. As chaves canônicas de `qualifiers`, gravadas pela tela
-- e lidas pelo motor de risco do cliente (src/lib/clinical/cardioAlertRules.ts,
-- constante `QUALIFICADOR`):
--
--     gatilho  →  'repouso' | 'esforco' | 'emocao'      (dor no peito)
--     nyha     →  1..4, classe ABSOLUTA do momento      (falta de ar)
--     dispneia_paroxistica_noturna → boolean            (falta de ar)
--
-- Valores em inglês ('rest'/'effort'/'emotion') são aceitos na leitura porque
-- existem no histórico já gravado. Registro clínico não se reescreve.

create or replace function public.alerta_sintoma()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sev      alert_severity;
  v_gatilho  text;
  v_nyha     int;
  v_dpn      boolean;
  v_code     text;
  v_titulo   text;
  v_detalhe  text;
begin
  -- Leitura tolerante dos qualificadores (ver comentário acima).
  v_gatilho := lower(coalesce(new.qualifiers->>'gatilho', ''));
  if v_gatilho in ('rest', 'repouso')      then v_gatilho := 'repouso';
  elsif v_gatilho in ('effort', 'esforco') then v_gatilho := 'esforco';
  elsif v_gatilho in ('emotion', 'emocao') then v_gatilho := 'emocao';
  else v_gatilho := null;
  end if;

  -- `nyha` pode chegar como número ou como texto; qualquer coisa que não seja
  -- 1..4 vira null em vez de derrubar o insert do paciente.
  v_nyha := nullif(regexp_replace(coalesce(new.qualifiers->>'nyha', ''), '\D', '', 'g'), '')::int;
  if v_nyha is not null and (v_nyha < 1 or v_nyha > 4) then v_nyha := null; end if;

  -- Comparação em vez de cast: `''::boolean` e `'sim'::boolean` levantam
  -- exceção, e um campo opcional mal formatado não pode derrubar o registro de
  -- sintoma de um paciente.
  v_dpn := lower(coalesce(new.qualifiers->>'dispneia_paroxistica_noturna', '')) in ('true', 't', '1');

  -- ── Severidade ───────────────────────────────────────────────────────
  -- Duração DESCONHECIDA em dor de repouso conta como longa, igual à tela:
  -- quem não consegue dizer há quanto tempo dói é o caso que não pode
  -- escapar. Errar para cima custa um alerta a mais; para baixo, custa outra
  -- coisa.
  v_sev := case
    when new.symptom_type = 'syncope' then 'emergency'
    when new.symptom_type = 'chest_pain' and v_gatilho = 'repouso'
         and (new.duration_minutes is null or new.duration_minutes > 10) then 'emergency'
    when new.symptom_type = 'chest_pain' then 'warning'
    when new.symptom_type = 'dyspnea' and (v_nyha = 4 or v_dpn) then 'critical'
    when new.symptom_type = 'dyspnea' then 'warning'
    when new.symptom_type = 'presyncope' then 'warning'
    when new.symptom_type in ('palpitations', 'edema') then 'warning'
    else 'info'
  end;

  -- Escalonamento por intensidade: agora que a tela envia `intensity` para dor
  -- no peito, falta de ar e palpitação (e não só para cansaço), esta linha
  -- finalmente tem dado de entrada.
  if coalesce(new.intensity, 0) >= 8 and v_sev = 'info' then v_sev := 'warning'; end if;

  -- A triagem fica registrada SEMPRE, inclusive quando é 'info'. Antes o
  -- gatilho retornava antes de gravar `triaged_as`, e um relato leve ficava
  -- indistinguível de um relato nunca avaliado.
  update public.symptom_reports set triaged_as = v_sev where id = new.id;

  if v_sev = 'info' then return new; end if;

  -- ── Código do alerta ─────────────────────────────────────────────────
  -- `symptom_<tipo>`, com um sufixo só onde a circunstância muda a conduta do
  -- médico. O sufixo também separa o anti-spam de 12 h: uma dor de esforço
  -- ontem não pode calar uma dor de repouso hoje.
  v_code := 'symptom_' || new.symptom_type
            || case when new.symptom_type = 'chest_pain' and v_gatilho = 'repouso' then '_rest'
                    when new.symptom_type = 'dyspnea' and v_nyha = 4 then '_rest'
                    else '' end;

  v_titulo := case v_code
    when 'symptom_chest_pain_rest' then 'Dor no peito em repouso'
    when 'symptom_chest_pain'      then 'Dor no peito relatada'
    when 'symptom_dyspnea_rest'    then 'Falta de ar em repouso'
    when 'symptom_dyspnea'         then 'Falta de ar relatada'
    when 'symptom_syncope'         then 'Desmaio relatado'
    when 'symptom_presyncope'      then 'Quase desmaiou'
    when 'symptom_palpitations'    then 'Palpitação relatada'
    when 'symptom_edema'           then 'Inchaço nas pernas'
    when 'symptom_claudication'    then 'Dor na perna ao andar'
    when 'symptom_dry_cough'       then 'Tosse seca'
    when 'symptom_fatigue'         then 'Cansaço fora do comum'
    when 'symptom_dizziness'       then 'Tontura'
    else 'Sintoma relatado pelo paciente'
  end;

  -- Descrição é DESCRIÇÃO: o que o paciente relatou, com os números que ele
  -- deu. Nenhuma sugestão de conduta — quem decide é quem lê.
  v_detalhe := coalesce(nullif(new.notes, ''), 'Relato registrado no app.')
    || case when v_gatilho is not null then ' Começou em ' ||
              case v_gatilho when 'repouso' then 'repouso'
                             when 'esforco' then 'esforço'
                             else 'situação de emoção/estresse' end || '.'
       else '' end
    || case when new.duration_minutes is not null
            then ' Duração relatada: ' || new.duration_minutes || ' min.' else '' end
    || case when new.intensity is not null
            then ' Intensidade ' || new.intensity || '/10.' else '' end
    || case when v_nyha is not null then ' Classe funcional NYHA ' || v_nyha || '.' else '' end
    || case when v_dpn then ' Refere dispneia paroxística noturna.' else '' end;

  perform public.registrar_alerta(
    new.patient_user_id, v_code, v_sev, v_titulo, v_detalhe,
    new.symptom_type, null);

  return new;
end;
$$;

drop trigger if exists trg_alerta_sintoma on public.symptom_reports;
create trigger trg_alerta_sintoma after insert on public.symptom_reports
  for each row execute function public.alerta_sintoma();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. O PACIENTE PODE TIRAR O PRÓPRIO ALERTA DA TELA — e só isso
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O bug: `alerts_patient_read` é `for select`. O app do paciente fazia
-- `update(...).eq('id', id)` e o PostgREST devolvia 0 linhas com `error =
-- null` — sucesso aparente, `onSuccess` rodando, e o alerta de volta no
-- refetch seguinte. Um paciente que dispensa o mesmo alerta cinco vezes
-- aprende que o app não funciona.
--
-- POR QUE COLUNAS NOVAS EM VEZ DE is_read / is_dismissed:
--
-- `is_dismissed = false` é o filtro da FILA DO MÉDICO (useProfessionalAlerts e
-- useProfessionalPatients) e `is_read` alimenta a contagem de alertas abertos
-- dele. Deixar o paciente escrever nessas duas colunas significaria que o
-- paciente, ao limpar a própria tela, apagaria o alerta da fila do
-- cardiologista. Seria trocar um buraco por outro pior — e exatamente o tipo
-- de perda de dado clínico que esta auditoria veio corrigir.
--
-- A linha de alerta serve a dois públicos; cada público tem a sua marca.

alter table public.cardio_alerts
  add column if not exists patient_read_at      timestamptz,
  add column if not exists patient_dismissed_at timestamptz;

comment on column public.cardio_alerts.patient_read_at is
  'Quando o PACIENTE viu o alerta. Independente de is_read, que é do médico.';
comment on column public.cardio_alerts.patient_dismissed_at is
  'Quando o PACIENTE tirou o alerta da própria tela. Não remove o alerta da fila do médico.';

create index if not exists idx_alerts_patient_abertos
  on public.cardio_alerts(patient_user_id, triggered_at desc)
  where patient_dismissed_at is null;

drop policy if exists alerts_patient_mark on public.cardio_alerts;
create policy alerts_patient_mark on public.cardio_alerts for update
  using (patient_user_id = auth.uid())
  with check (patient_user_id = auth.uid());

-- A política diz QUAIS LINHAS; o gatilho diz QUAIS COLUNAS. RLS no Postgres
-- não tem granularidade de coluna para UPDATE com WITH CHECK dependente do
-- valor antigo, então a restrição real mora aqui.
--
-- E ele LEVANTA EXCEÇÃO em vez de desfazer em silêncio: escrita recusada tem
-- que chegar ao cliente como erro. Metade dos achados desta auditoria são
-- escritas que falharam sem ninguém saber.
create or replace function public.alerta_paciente_so_marca()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Rotinas internas (auth.uid() nulo), administração e o médico vinculado
  -- passam direto: para eles vale `alerts_doctor`, com o fluxo de trabalho
  -- completo da migração 20260913000000.
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;
  if public.is_linked_professional(old.patient_user_id, auth.uid()) then return new; end if;
  if old.patient_user_id is distinct from auth.uid() then return new; end if;

  if new.id                   is distinct from old.id
     or new.patient_user_id   is distinct from old.patient_user_id
     or new.professional_id   is distinct from old.professional_id
     or new.rule_code         is distinct from old.rule_code
     or new.severity          is distinct from old.severity
     or new.title             is distinct from old.title
     or new.description       is distinct from old.description
     or new.trigger_value     is distinct from old.trigger_value
     or new.threshold_value   is distinct from old.threshold_value
     or new.triggered_at      is distinct from old.triggered_at
     or new.is_read           is distinct from old.is_read
     or new.is_dismissed      is distinct from old.is_dismissed
     or new.workflow_status   is distinct from old.workflow_status
     or new.assigned_to       is distinct from old.assigned_to
     or new.resolution_note   is distinct from old.resolution_note
     or new.resolved_at       is distinct from old.resolved_at
     or new.resolved_by       is distinct from old.resolved_by
  then
    raise exception 'O paciente só pode marcar o próprio alerta como lido ou dispensado.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_alerta_paciente_so_marca on public.cardio_alerts;
create trigger trg_alerta_paciente_so_marca
  before update on public.cardio_alerts
  for each row execute function public.alerta_paciente_so_marca();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. MENSAGENS — a regra certa, dita em voz alta
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A condição do gatilho anterior NÃO estava invertida: ele desfazia a mudança
-- de `read_at` quando `old.sender_user_id = auth.uid()`, ou seja, quando quem
-- escrevia era o REMETENTE. Quem recebeu passava. Está certo.
--
-- O que estava errado era o MODO: desfazer em silêncio. O hook do médico
-- (`marcarLidas`) mandava o update, recebia `error = null`, invalidava a
-- thread e o contador de não lidas voltava intacto — sem nenhuma pista de
-- onde a escrita tinha morrido. Um gatilho que anula uma escrita e devolve
-- "ok" produz exatamente o tipo de bug que dura meses.
--
-- Agora: tentativa de alterar conteúdo de mensagem levanta exceção; marcar a
-- própria mensagem como lida levanta exceção; o resto passa. A comparação com
-- `is distinct from` cobre o caso de `sender_user_id` nulo, que com `=` daria
-- nulo e deixaria passar.

create or replace function public.mensagem_imutavel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then return new; end if;

  if new.patient_user_id is distinct from old.patient_user_id
     or new.sender_user_id is distinct from old.sender_user_id
     or new.sender         is distinct from old.sender
     or new.body           is distinct from old.body
     or new.attachment_url is distinct from old.attachment_url
     or new.created_at     is distinct from old.created_at
  then
    raise exception 'Mensagem clínica não se edita. O update existe só para marcar como lida.'
      using errcode = '42501';
  end if;

  -- Só quem RECEBEU marca como lida. O remetente marcando a própria mensagem
  -- inflaria a leitura do outro lado — e é o outro lado que precisa saber se
  -- foi lido.
  if new.read_at is distinct from old.read_at
     and not (old.sender_user_id is distinct from auth.uid())
  then
    raise exception 'Só quem recebeu a mensagem pode marcá-la como lida.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mensagem_imutavel on public.patient_messages;
create trigger trg_mensagem_imutavel
  before update on public.patient_messages
  for each row execute function public.mensagem_imutavel();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ATRASO OPERACIONAL — os dois alertas que o banco nunca emitiu
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A aba "Atraso operacional" filtrava por `adesao_baixa` e `sem_dados`:
-- códigos do motor de risco do CLIENTE, que roda em memória e nunca grava em
-- `cardio_alerts`. Nenhuma linha do banco jamais teve esses `rule_code`, então
-- a aba era estruturalmente vazia.
--
-- Corrigir só o filtro do app não resolveria: não havia o que filtrar. O banco
-- passa a emitir os dois, com nomes na mesma família dos outros (inglês,
-- snake_case): `no_data` e `adherence_low`.
--
-- POR QUE UMA FUNÇÃO E NÃO UM GATILHO: ausência não tem evento. Nada é
-- inserido quando o paciente PARA de medir — é justamente o oposto. Esta
-- função é feita para ser chamada por agendamento (pg_cron, ou uma Edge
-- Function diária). Ela é idempotente dentro do dia: `registrar_alerta` já
-- suprime repetição do mesmo `rule_code` em 12 h.

create or replace function public.registrar_alertas_operacionais(
  _dias_sem_dados int default 10,
  _dias_adesao    int default 14,
  _adesao_minima  numeric default 0.8
) returns integer language plpgsql security definer set search_path = public as $$
declare
  r           record;
  v_ultima    timestamptz;
  v_total     int;
  v_tomadas   int;
  v_pct       numeric;
  v_emitidos  int := 0;
begin
  for r in
    select distinct l.patient_user_id
      from public.professional_patient_links l
     where l.status = 'active' and l.patient_user_id is not null
  loop
    -- ── Silêncio ────────────────────────────────────────────────────────
    select max(x.recorded_at) into v_ultima from (
      select recorded_at from public.bp_readings     where patient_user_id = r.patient_user_id
      union all
      select recorded_at from public.hr_readings     where patient_user_id = r.patient_user_id
      union all
      select recorded_at from public.weight_readings where patient_user_id = r.patient_user_id
      union all
      select recorded_at from public.spo2_readings   where patient_user_id = r.patient_user_id
    ) x;

    if v_ultima is null or v_ultima < now() - make_interval(days => _dias_sem_dados) then
      perform public.registrar_alerta(
        r.patient_user_id, 'no_data', 'info',
        'Sem registros recentes',
        case when v_ultima is null
             then 'Nenhuma medida registrada até agora.'
             else 'Última medida em ' || to_char(v_ultima, 'DD/MM/YYYY') || '.' end,
        coalesce(to_char(v_ultima, 'DD/MM/YYYY'), 'nenhuma'),
        _dias_sem_dados || ' dias');
      v_emitidos := v_emitidos + 1;
    end if;

    -- ── Adesão ──────────────────────────────────────────────────────────
    -- O denominador são as linhas de dose já geradas na janela; sem nenhuma
    -- dose prevista não existe adesão para medir, e o paciente não entra na
    -- conta (em vez de entrar como 0%).
    select count(*), count(*) filter (where taken)
      into v_total, v_tomadas
      from public.medication_intakes
     where patient_user_id = r.patient_user_id
       and intake_date >= (current_date - _dias_adesao + 1);

    if v_total >= _dias_adesao then
      v_pct := v_tomadas::numeric / v_total;
      if v_pct < _adesao_minima then
        perform public.registrar_alerta(
          r.patient_user_id, 'adherence_low', 'warning',
          'Doses em atraso',
          'Marcou ' || v_tomadas || ' de ' || v_total || ' doses nos últimos '
            || _dias_adesao || ' dias.',
          round(v_pct * 100) || '%',
          round(_adesao_minima * 100) || '%');
        v_emitidos := v_emitidos + 1;
      end if;
    end if;
  end loop;

  return v_emitidos;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Superfície de chamada — mesma política da migração de segurança
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Função `security definer` que o cliente pode chamar é escalação de
-- privilégio esperando acontecer. Nenhuma destas é chamada pelo app: as três
-- primeiras são gatilhos, e a quarta é trabalho de agendamento.

revoke all on function public.alerta_sintoma()                from public, anon, authenticated;
revoke all on function public.alerta_paciente_so_marca()      from public, anon, authenticated;
revoke all on function public.mensagem_imutavel()             from public, anon, authenticated;
revoke all on function public.registrar_alertas_operacionais(int, int, numeric)
  from public, anon, authenticated;
