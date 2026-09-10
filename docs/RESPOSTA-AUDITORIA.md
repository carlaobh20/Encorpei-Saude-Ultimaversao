# Resposta à auditoria de setembro/2026

Documento de rastreabilidade: cada achado da auditoria externa, o que foi feito,
e onde está a evidência no código. Escrito para ser lido pelo auditor.

**Método de verificação.** As correções de banco não foram avaliadas por leitura.
Foi levantado um PostgreSQL 16 com um *shim* do Supabase (`auth.users`,
`auth.uid()`, `storage.*`, papéis `anon`/`authenticated`), as seis migrações
foram aplicadas a partir de banco vazio, e o caminho clínico completo foi
exercido sob RLS real, com sessões de usuários distintos. As afirmações abaixo
marcadas **[verificado]** têm erro de servidor ou consulta como prova.

---

## O achado que a auditoria não viu, e que era o mais grave

**Recursão infinita de RLS no schema base — o portal do médico estava morto.**

`pro_visible_to_linked_patient` (em `professional_profiles`) lê
`professional_patient_links`; a política `links_professional` dessa tabela lê
`professional_profiles`. O Postgres aborta com `infinite recursion detected in
policy`. Na prática: **nenhum cardiologista conseguia ler o próprio perfil,
listar convites ou criar um.** O produto inteiro do lado médico não funcionava
contra banco real — e isso passou despercebido porque o app só rodou em modo
demonstração até hoje.

Corrigido com `public.owns_professional_profile()` (SECURITY DEFINER, mesmo
padrão do `is_linked_professional` já existente), quebrando o ciclo.
**[verificado]** — antes: erro; depois: caminho completo funciona.

---

## Etapa 1 — Antes de usar dados reais

### Permissões

| Achado | Correção | Onde |
|---|---|---|
| `pro_own` deixava o médico se auto-aprovar, se verificar, mudar de plano e liberar 999 pacientes | Gatilho `proteger_campos_administrativos` congela `approval_status`, `is_verified`, `rejection_reason`, `plan_type`, `max_patients` para quem não é admin; `nascer_pendente` força o estado inicial na inserção | `20260912000000_seguranca.sql` §1 |
| `cardio_targets` na política genérica de escrita do paciente — ele reescrevia os limiares que disparam alerta | Escrita retirada. Leitura para paciente e cuidador; escrita só do médico vinculado. Semente própria forçada aos valores padrão | §3 |
| **Não apontado pela auditoria, pior que o anterior:** `links_patient_accept` permitia UPDATE em qualquer vínculo com `patient_user_id is null`. UPDATE não precisa de política de SELECT: **um único `update` sem WHERE sequestrava todos os convites pendentes do sistema** | Política removida. O aceite existe só dentro de `claim_invite()`, que exige o código. Convite expira em 30 dias; código gerado pelo banco, 8 caracteres, sem letras ambíguas | §2 |
| `messages_participants` verificava só o remetente, sem exigir participação na conversa; `for all` dava DELETE a qualquer lado | Uma política por operação: leitura para os dois lados; inserção exige ser o remetente **e** participar; update só marca como lida (gatilho `mensagem_imutavel` congela o resto); **sem política de DELETE** — mensagem clínica não se apaga | §4 |
| Cuidador podia editar as próprias permissões de acesso, e o `caregiver_user_id is null` repetia o sequestro de convites | Aceite via `aceitar_convite_cuidador()`. O cuidador só pode SAIR (`status='revoked'`); gatilho `proteger_cuidador` congela as permissões. Paciente não pode ser o próprio cuidador | §5 |
| `log_audit_event` aceitava a identidade do autor como parâmetro — dava para gravar auditoria em nome de terceiro, o que é pior que não ter auditoria | Assinatura antiga removida. A nova **deriva** autor e papel de `auth.uid()` | §6 |
| `registrar_alerta` e demais SECURITY DEFINER sem revogação de EXECUTE — dava para injetar alerta falso na fila de qualquer médico | 16 funções com `revoke all ... from public, anon, authenticated`. Continuam disponíveis para os gatilhos internos | §6 |
| RPCs `admin_*` chamadas pelo app e inexistentes | As cinco criadas, **todas verificando o papel internamente** (SECURITY DEFINER sem checagem de papel é escalação de privilégio) | §7 |
| `feedback_replies` inexistente | Criada com RLS | §8 |

**[verificado]** sob RLS real: paciente não reescreve prescrição (`UPDATE 0`);
cuidador não amplia o próprio acesso; médico não se auto-aprova.

Sobre o silêncio: `UPDATE 0` por negação de RLS **não retorna erro**. Foi assim
que quatro fluxos quebrados passaram despercebidos. Os pontos de escrita
afetados agora tratam zero linhas como falha.

### Correspondência entre interface e operação real

| Achado | Correção |
|---|---|
| Indicadores da carteira retornavam `null` fora do demo | Agregações reais em `useCarteiraIndicadores.ts` — 8 consultas fixas com `.in()`, zero consulta dentro de `.map()` |
| "Sem dados recentes" não existia; silêncio parecia estabilidade | Estado próprio na fila, com tom visual distinto de estável e de alerta |
| Origem, período e n= invisíveis | Todo indicador exibe valor + n= + período + origem; "sem medidas suficientes" no lugar de traço ambíguo; adesão rotulada como **autorrelatada** |
| Bluetooth não persistia nada | `useWearableSync.ts`: registra o aparelho, grava com *throttle* de 1/min, carimba `last_sync_at` **só após gravação confirmada** |
| Importação limitada a 50 por tipo, sem sono/atividade, perdendo origem e horário | Importa tudo em lotes de 500, cinco tipos, `recorded_at` preservado, origem carimbada |
| Sem deduplicação | Dedup por (data ao minuto + valor) contra a janela do arquivo; resumo com importados / ignorados / falhas por tipo |
| Classificação de validação contraditória | Tudo que vem de PPG/acelerômetro nasce `estimated`. `validated` só para digitação manual ou manguito |
| Parser de CSV frágil | Tokenizador com aspas e aspas escapadas, detecção de delimitador, dd/mm/aaaa ancorado, rejeição de data inválida ou futura, cabeçalho por igualdade contra sinônimos |
| Sem prévia | Prévia obrigatória: contagem por tipo, período, três linhas interpretadas; mapeamento manual quando o parser não tem confiança |
| Alertas rasos (lido/dispensado) | Fluxo aberto → em avaliação → contato realizado → resolvido, com responsável e justificativa; risco clínico separado de atraso operacional |
| Exportação/exclusão no navegador, falhando em silêncio | Duas Edge Functions com service-role. Manifesto com contagem por tabela e **lista explícita do que falhou**; exclusão exige `{"confirmacao":"EXCLUIR"}`, apaga Storage, tabelas e `auth.users`; tabela `data_requests` separa prova de solicitação de prova de conclusão. `audit_logs` e `data_requests` são **retidos** (art. 16, I) e isso é informado, não silencioso |
| Histórico limitado a 200 linhas | Consulta por intervalo com paginação; toda série devolve linhas, período coberto e `truncado` medido — não estimado |

### Achados adicionais encontrados na verificação

Não estavam na auditoria e quebravam funcionalidade:

- `feedback.importance` era `smallint`; o app envia texto → **todo envio de feedback falhava**.
- `feedback.admin_notes` não existia → o botão de salvar nota sempre errava.
- `feedback.status` tinha default `'open'`, que não corresponde a nenhum dos quatro estados do app → feedback novo ficava invisível para todos os filtros.
- `feedback_replies` sem `author_name`/`message` e com `body not null` → **nenhuma resposta podia ser enviada**; e só admin podia inserir, embora a interface ofereça resposta ao paciente.
- `useMyProfessionals` selecionava a coluna `phone`, inexistente (é `clinic_phone`); o PostgREST rejeita a consulta inteira e o erro era descartado → o cartão "Meu Cardiologista" renderizava **em branco**.
- `useCuidadores.aceitarConvite` fazia UPDATE direto, barrado pela RLS nova → **nenhum vínculo de cuidador funcionava**.
- Colisão de chave de cache: paciente e médico usavam `["monitoring_plan", id]` para conjuntos diferentes — o app do paciente podia passar a cobrar métricas que o médico desligou.
- N+1 em `MyFeedbackList`, `AdminFeedbackPage` e `CuidadorHomePage`.
- `data_requests.user_id` era `not null` **e** `on delete set null`: a exclusão abortava exatamente para quem a pedira.

---

## Etapa 2 — Experiência

**Paciente.** Navegação de 19 destinos concorrentes para cinco:
**Hoje · Minha saúde · Registrar · Minha equipe · Mais**. Nenhum destino sumiu.
A tela Hoje passou a ter uma ordem só: saudação → aviso relevante → tarefa
prioritária com ação → último registro com data e origem → evolução curta →
próxima consulta. As duas listas concorrentes de pendências viraram uma, vinda
do plano de monitoramento; quando não há prescrição, a tela **diz** que é
sugestão do app.

A Idade do Coração saiu do topo. O número 80 dominava toda visita e produzia
ansiedade sem ação possível; virou cartão dentro da evolução, com a explicação
ao lado. A projeção deixou de prometer rejuvenescimento e passou a ser descrita
como cenário de cálculo.

**"Tempo no alvo" era rótulo mentiroso** — a conta é sobre amostras, não sobre
tempo monitorado. Agora é **"Medidas de pressão dentro da meta"**, sempre com
percentual, n= e período, e com estado explícito de amostra insuficiente
(limiar em `MINIMO_DE_MEDIDAS`).

Legibilidade: corpo de 16–18px na casca do paciente, piso de 12px, alvos de
44–48px, foco visível, `aria-label` em botão só-ícone. O botão flutuante deixou
de cobrir o último item das listas.

**Metas.** A retirada da escrita em `cardio_targets` teria deixado a tela de
metas somente leitura. Foi separada em duas: **"O que seu médico definiu"**
(leitura, com data e autor) e **"O que eu combinei comigo"** (editável —
passos, exercício, sono, sódio), em `patient_goals`. Para mudar um número
clínico, o app oferece **pedir ao médico**, com mensagem já redigida — nunca
alterar.

**Médico.** Fila que responde quem precisa de avaliação, por quê e qual foi a
última informação confiável. Busca visível, filtros, tabela no desktop e
cartões no celular.

**Marca.** Os ícones do PWA eram a logo de maternidade (mãe e bebê num coração
rosa) e o manifesto ainda dizia "acompanhamento pré-natal para gestantes e
obstetras" — texto visível na instalação. Ícones regerados, manifesto e
`start_url` corrigidos, e os resíduos de linguagem eliminados (inclusive
🤰👶🍼 no seletor de emoji do chat com o cardiologista).

**Promessas comerciais.** SMS, equipes, multiunidade e integração com prontuário
continuam listados, agora marcados como *em desenvolvimento* e **fora do preço**;
o plano "Rede" inteiro virou roadmap. "Falar com comercial" deixou de simular um
checkout inexistente. Afirmações da landing que o código não sustenta foram
reescritas.

---

## Pulseira

A interface deixou de afirmar o modelo. A ficha veio de anúncio de fornecedor,
não de manual: a tela diz "o aparelho que você conectou" e mostra o nome
anunciado por Bluetooth. Os comentários técnicos permanecem no código,
marcados como hipótese não confirmada.

A tela principal mostra **última sincronização bem-sucedida**, com estados
explícitos (não conectada / conectando / sincronizando / atualizada / falhou /
dados atrasados). A palavra "ativa" saiu: ver batimento ao vivo não é prova de
que o dado chegou ao médico. Diagnóstico GATT e firmware foram para um bloco
recolhível.

Continua valendo, e **[verificado]** no banco: uma leitura de 195/120 marcada
`estimated` **não gera alerta**.

---

## O que continua em aberto

1. **Nada disso está provado contra o Supabase de produção.** A verificação foi
   feita num Postgres local com shim. O comportamento de `auth.uid()` sob
   PostgREST, o Storage e as Edge Functions precisam de um projeto real.
2. **Não há suíte de testes automatizados.** O passo `npm test` do CI apontava
   para um script inexistente e deixava o CI vermelho em todo commit — foi
   removido em vez de mascarado com um stub. Voltará quando existir suíte.
3. **Cálculos clínicos seguem sem homologação.** Escores, triagem, Idade do
   Coração e o questionário adaptado precisam de revisão por cardiologista, com
   versionamento e casos de teste. O preenchimento de HAS-BLED ainda fixa
   fatores sem informação individual correspondente. Nada disso deve ser
   chamado de instrumento validado.
4. **Notificação com o app fechado não existe.** Há registro de inscrição, não
   serviço de envio. Não anunciar lembretes confiáveis.
5. **A pulseira não foi testada.** Nenhuma linha do protocolo proprietário foi
   confirmada com o aparelho. Pedir ao fornecedor: modelo exato, manual, SDK,
   protocolo BLE e um arquivo de exportação real.
6. **Colunas legadas em `feedback`** (`role`, `body`) convivem com as novas.
   Inofensivo hoje, merece migração de limpeza.
7. **Decisão registrada:** `claim_invite` **não** semeia plano de monitoramento.
   Semear quatro itens padrão e exibi-los como "definido pelo seu médico" seria
   mentira com aparência de recurso. Sem plano, o app usa o conjunto sugerido e
   diz que é sugestão.
8. **Decisão registrada:** dor torácica em repouso com duração **desconhecida**
   passa a encaminhar para emergência. Tratar campo vazio como "curta" é a
   única leitura que mata; o custo do contrário é uma tela a mais.

"Implementado" neste documento significa que existe código correspondente e,
onde marcado **[verificado]**, que o comportamento foi exercido contra um banco
real. Não significa homologado em produção.
