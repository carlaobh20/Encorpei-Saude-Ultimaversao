# Avaliação do Encorpei Saúde Cardio

Análise do arquivo `Encorpei-Saude-Ultimaversao-main.zip`, recebido em setembro de 2026.

**Parecer:** a base já contém uma adaptação extensa para cardiologia. Vale reaproveitá-la, mas é necessário aproximar o funcionamento real da demonstração, simplificar a experiência do paciente e corrigir permissões antes de um piloto com dados reais. A integração completa da pulseira ainda não está pronta.

## Alcance e evidências

- Inventário de 52 arquivos de páginas, rotas, componentes compartilhados, camada de dados e 38 declarações de tabelas em três migrações SQL.
- Revisão aprofundada dos pontos centrais: início do paciente, painel e detalhe do cardiologista, alertas, pulseira, importação, acessos, exportação/exclusão e planos.
- Inspeção das três imagens incluídas em `Claude outputs`: painel médico, Meu Coração e Pulseira. Elas documentam uma versão demonstrativa; não são capturas produzidas nesta análise e podem diferir do código atual.
- Comparação por hash: os arquivos presentes no ZIP coincidem com os correspondentes nesta pasta, exceto `SUBIR-PARA-O-GITHUB.bat`. Nenhuma alteração foi feita no código do produto.
- Não houve acesso a banco publicado nem teste do aparelho. A instalação de dependências falhou por restrição de acesso ao cache local; build e navegação em execução não foram confirmados. Foram criados arquivos locais parciais de dependências durante essa tentativa.
- Comentários e documentos do projeto foram tratados como contexto, não como comprovação de funcionalidades nem como autorização para modificar ou publicar o sistema.

“Implementado” neste documento significa que há código correspondente; não significa homologado em produção.

## 1. Mapa das áreas e telas

### Paciente: 23 páginas internas

| Tela / caminho | O que existe | Direção de melhoria |
|---|---|---|
| Hoje — `/hoje` | Pendências do plano, idade do coração/medidas no alvo, tarefas, indicadores, avisos, conquistas, educação, questionário e consulta | Reduzir a quantidade de blocos; destacar avisos relevantes e uma próxima ação |
| Meu Coração — `/meu-coracao` | Estimativa de idade do coração, simulações, evolução, medidas no alvo e capacidade | Explicar estimativas; mostrar amostra e período; reduzir rolagem |
| Como estou agora — `/como-estou` | Questionário de sintomas e encaminhamento por regras | Linguagem acolhedora, revisão clínica e encaminhamento claramente distinguido de diagnóstico |
| Caminhada & Testes — `/caminhada` | Caminhada guiada, registros e testes de capacidade; faixa de treino vinculada às metas | Exibir somente o que for adequado ao plano definido para o paciente |
| Alimentação — `/alimentacao` | Registro alimentar com estimativa de sódio | Registro rápido e orientação clara de que o número é uma estimativa |
| Aprender — `/aprender` | Conteúdo educativo e progresso | Conteúdo selecionado conforme perfil, com revisão e versão identificadas |
| Meu Mês — `/meu-mes` | Resumo de acompanhamento e evolução | Síntese curta, comparações com dados suficientes e ação para compartilhar |
| Quem cuida de mim — `/cuidadores` | Convites, permissões e revogação de cuidadores | Aceitação segura e explicação simples de cada permissão |
| Pressão & Coração — `/pressao` | Registro de pressão, gráficos, histórico e contexto de medida | Fluxo em poucos passos; origem, horário e qualidade sempre visíveis |
| Peso — `/peso` | Registro e evolução | Mostrar variação em período definido e pendência conforme plano |
| Atividade — `/atividade` | Passos, minutos de exercício e histórico | Consolidar acesso com caminhada; evitar indicadores de datas ambíguas |
| Sono — `/sono` | Duração, composição e tendências | Identificar origem real; não atribuir automaticamente todo registro à pulseira |
| Meus Remédios — `/remedios` | Medicações, horários e confirmação de doses | Priorizar próxima dose; permitir corrigir marcação e distinguir autorrelato |
| Exames — `/exames` | Resultados e documentos cardiológicos/laboratoriais | Organização por data/tipo, status de revisão e abertura simples |
| Consultas — `/agenda` | Agenda e próximas consultas | Deixar claro agendado, solicitado, cancelado e realizado |
| Minhas Metas — `/metas` | Metas de acompanhamento | Diferenciar sugestão do sistema de meta confirmada pelo médico |
| Minha Pulseira — `/pulseira` | Diagnóstico Bluetooth, conexão, bateria/FC em tela e importação CSV | Transformar em fluxo de conectar e sincronizar; detalhes técnicos em suporte |
| Sintomas — `/sintomas` | Registro de sintomas | Integrar ao botão Registrar e ao histórico clínico |
| Emergência — `/emergencia` | Orientações e acesso ao telefone 192 | Manter acesso fácil sem cobrir botões e sem sugerir atendimento imediato pelo chat |
| Meu Cardiologista — `/medico` | Conversa e vínculo com profissional | Nome do destinatário, prazo de resposta e estado de envio |
| Minha Conta — `/conta` | Dados da conta e controles associados | Reunir preferências e dados cadastrais com nomes consistentes |
| Configurações — `/configuracoes` | Preferências | Evitar dispersão com Minha Conta |
| Feedback — `/feedback` | Envio e acompanhamento de feedback | Separar claramente suporte técnico de comunicação clínica |

O menu principal tem 19 destinos, além dos itens de rodapé. Há rotas alternativas para semana, pressão arterial, medicamentos e consultas. Ter muitas funções é útil; exigir que o paciente escolha entre todas elas diariamente aumenta a dificuldade.

### Cardiologista: 13 páginas

| Tela / caminho | O que existe |
|---|---|
| Acesso — `/pro`, `/pro/auth` | Login e cadastro profissional |
| Cadastro inicial — `/pro/onboarding` | Perfil profissional e fluxo associado à aprovação |
| Painel — `/pro/dashboard` | Fila por prioridade, contadores, alertas, indicadores e convite |
| Pacientes — `/pro/pacientes` | Carteira, vínculos e acesso aos pacientes |
| Detalhe — `/pro/pacientes/:patientId` | Resumo/alvos, evolução, engajamento, medicações, exames, escores e anotações |
| Alertas — `/pro/alertas` | Agrupamento por paciente ou gravidade, não lidos, marcar lido e dispensar |
| Agenda — `/pro/agenda` | Consultas da carteira |
| Mensagens — `/pro/mensagens` | Conversas com pacientes |
| Exames — `/pro/exames` | Acesso aos exames da carteira |
| Relatórios — `/pro/relatorios` | Prévia por paciente/período e impressão; PDF depende do diálogo de impressão do navegador |
| Conta — `/pro/conta` | Perfil e configurações profissionais |
| Marca — `/pro/marca` | Logo, cor, identificação e contato da clínica |
| Feedback — `/pro/feedback` | Canal de feedback |

O detalhe clínico também reúne plano de monitoramento, titulação de medicação com histórico, faixa de caminhada, qualidade de vida, sódio, check-ins e cuidador. O resumo entre consultas é montado por regras/textos; não é uma análise por IA.

### Cuidador: uma página

`/cuidador`: entrada por convite e acompanhamento do paciente conforme permissões. É uma área própria, com autenticação tratada dentro do fluxo. Precisa de testes específicos de convite, revogação e isolamento entre pacientes.

### Administração: seis páginas

`/admin/auth`, `/admin`, `/admin/medicos`, `/admin/usuarios`, `/admin/feedbacks` e `/admin/config`: acesso, indicadores, aprovação de profissionais, usuários, feedbacks e troca de senha. Há chamadas a funções administrativas que não estão definidas nas migrações entregues; a presença das telas não comprova um painel administrativo operacional.

### Demais páginas: nove

Landing, autenticação do paciente, cadastro inicial, recuperação de senha, status, termos, privacidade, planos e página não encontrada. O cadastro inicial do paciente tem oito etapas: boas-vindas, identificação, medidas, hábitos, comorbidades, histórico, família e médico. Sugiro entrada inicial mais curta, com complementação posterior.

## 2. Estrutura reaproveitável

React/TypeScript, Vite, Tailwind, componentes Radix, gráficos Recharts, cache de consultas, carregamento sob demanda e estrutura de aplicativo instalável. Há temas, componentes de cartões, modais, estados vazios, carregamento, erros e indicadores de origem/validação.

O Supabase concentra autenticação, dados e arquivos. Há políticas de acesso por linha e gatilhos para alertas. Existem módulos de auditoria, consentimento, exportação, exclusão, telemetria e notificações. A análise de exames por IA está desativada na configuração.

As 38 tabelas declaradas se distribuem assim:

- Identidade e vínculos: `profiles`, `user_roles`, `professional_profiles`, `cardio_patients`, `professional_patient_links`.
- Plano e dispositivos: `cardio_targets`, `monitoring_plan`, `registered_devices`, `raw_device_data`.
- Registros clínicos: `bp_readings`, `hr_readings`, `spo2_readings`, `weight_readings`, `glucose_readings`, `sleep_records`, `activity_records`, `symptom_reports`.
- Tratamento e exames: `cardio_medications`, `medication_intakes`, `medication_titrations`, `lab_results`, `cardio_exams`.
- Operação assistencial: `cardio_alerts`, `appointments`, `patient_messages`, `professional_notes`.
- Engajamento e apoio: `capacity_tests`, `walk_sessions`, `sodium_entries`, `wellbeing_checkins`, `qol_responses`, `heart_age_snapshots`, `education_progress`, `caregiver_links`.
- Governança e feedback: `consent_records`, `audit_logs`, `feedback`, `beta_events`.

Glicemia existe no modelo de dados, sem página própria nas rotas. HRV tem cálculos e campos relacionados à frequência cardíaca, mas não encontrei um fluxo completo de gravação na tela da pulseira.

## 3. Problemas prioritários comprováveis no código

### Antes de usar dados reais

**Permissões de perfil profissional.** A política `pro_own` permite ao proprietário escrever no próprio registro, que contém aprovação, verificação, plano e limite de pacientes. Não localizei proteção adicional desses campos nas migrações. Separar edição cadastral de decisões administrativas. Evidência: `20260909000000_cardio_baseline.sql`, linha 547 e definição de `professional_profiles`.

**Metas médicas editáveis pelo paciente no banco.** `cardio_targets` participa da política genérica de escrita do paciente. Isso contradiz a distinção da interface entre metas prescritas e sugestões, inclusive para parâmetros usados em acompanhamento. Restringir campos prescritos e manter solicitações/autorrelatos separados. Evidência: mesma migração, bloco iniciado próximo da linha 586.

**Mensagens com verificação insuficiente na inserção.** `messages_participants` verifica o remetente no `WITH CHECK`, sem exigir ali a participação na conversa. Também permite exclusão a participantes pela política ampla. Revisar inserção, atualização, leitura e exclusão separadamente e garantir isolamento de conversas entre profissionais. Evidência: linha 637 da baseline.

**Funções privilegiadas expostas.** `log_audit_event` aceita identidade do autor como parâmetro; `registrar_alerta` aceita paciente e conteúdo sem validação interna de autorização. Ambas usam `SECURITY DEFINER`; não localizei revogação de execução nas migrações. Mover funções internas para área privada ou restringir chamadas e derivar o autor da sessão. São achados de revisão estática: alcance efetivo depende dos privilégios do banco implantado.

**Cuidador e consentimento.** A política de atualização do vínculo permite ao cuidador editar a linha, não apenas aceitar. Isso deixa permissões e estado sujeitos a alteração pelo próprio beneficiário do acesso, conforme os privilégios concedidos. O fluxo de convite também precisa ser testado: o cuidador ainda não vinculado não tem uma política de leitura equivalente para localizar o convite. Usar aceitação validada no servidor e edição de permissões exclusiva pelo paciente.

A documentação oficial do [Supabase sobre RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) explica a proteção por operação e os cuidados com funções e views. É necessário testar essas regras com contas distintas; barreiras nas telas não substituem autorização no banco.

### Para que a operação real corresponda à interface

**Painel médico incompleto fora do demo.** Em `useProfessionalPatients`, idade, última leitura, pressão média, FC de repouso e adesão retornam `null` no caminho real. Os cartões demonstrativos mostram dados que essa consulta não entrega. Preencher indicadores com agregações reais e distinguir “sem informação” de “estável”. Evidência: `src/hooks/useProfessional.ts`, retorno próximo da linha 179.

**Bluetooth sem persistência.** O callback da conexão só executa `setAmostra`. Não grava a amostra, registra o dispositivo ou atualiza uma sincronização persistida. Assim, ver FC ao vivo não significa que o cardiologista receberá o dado. Evidência: `src/pages/PulseiraPage.tsx`, função `conectar`.

**Importação parcial e perda de origem.** A confirmação importa no máximo 50 leituras de cada um de três tipos, ignora atividade/sono já produzidos pelo normalizador, omite origem/dispositivo/status de validação e não preserva o horário importado da SpO₂. Não há deduplicação visível nesse fluxo. Corrigir gravação em lote, identificação de duplicatas, resumo de falhas e preservação integral da origem. Evidência: `confirmarImportacao`, na mesma página.

**Validação inconsistente.** A pressão importada chega com `cuff_validated: false`, mas sem `validation_status: estimated`; o banco usa `validated` por padrão. A proteção por manguito evita parte dos cálculos, porém a classificação continua contraditória. Outros sinais são classificados como validados pelo normalizador sem comprovação do aparelho. Distinguir origem, qualidade do sinal e validação clínica.

**CSV frágil.** O parser separa por delimitador simples, sem tratamento completo de aspas; datas brasileiras ambíguas passam primeiro pelo interpretador genérico; o reconhecimento parcial de cabeçalhos pode confundir sono total e profundo. Solicitar confirmação de colunas, unidades, fuso e formato de data; rejeitar datas inválidas e mostrar uma prévia antes de gravar.

**Administração e feedback incompletos no pacote.** Não encontrei definições para `admin_list_users`, `admin_delete_user`, `admin_dashboard_stats`, `admin_professional_metrics`, `admin_professional_patients` nem tabela `feedback_replies`. Os respectivos hooks dependem desses objetos. Completar migrações e verificar instalação a partir de banco vazio.

**Notificação não equivale a acompanhamento em segundo plano.** Há timers de sessão e preparação para inscrição push, mas não um serviço completo de envio no pacote. A única função de servidor incluída é `health`. A fila offline também não demonstra processamento completo. Definir entrega, repetição, falha e confirmação antes de anunciar lembretes confiáveis com o app fechado.

**Exportação/exclusão incompletas.** A exportação ignora erros por tabela; a exclusão tenta apagar pelo navegador, encontra tabelas somente de leitura para o paciente e não remove o usuário de autenticação ou os arquivos armazenados. Operações que afetam zero linhas podem parecer bem-sucedidas. Implementar processo no servidor com status verificável, política de retenção definida e distinção entre solicitação e conclusão. Esta é uma constatação técnica, não um parecer de conformidade legal.

**Histórico limitado.** Consultas genéricas carregam até 200 registros. Com sinais frequentes, períodos longos e resumos podem ficar incompletos. Consultar por intervalo e agregar no servidor, mostrando cobertura e quantidade de medidas.

**Cálculos merecem homologação.** Há escores, triagem, idade do coração e questionário adaptado. Por exemplo, o preenchimento de HAS-BLED fixa alguns fatores como falsos e um como verdadeiro, sem informação individual correspondente. O cálculo de medidas no alvo usa apenas limites máximos. Revisar entradas desconhecidas, faixas, aplicabilidade e regras junto ao cardiologista; registrar versões e casos de teste, sem chamar uma adaptação de instrumento validado.

**Promessas comerciais à frente da implementação.** Planos anunciam SMS, equipes, multiunidade e integração com prontuário. Não encontrei implementação equivalente completa. Os botões de contratação e “Falar com comercial” levam ao cadastro; não há fluxo de cobrança no pacote. Ajustar a oferta ao que estiver entregue.

## 4. Proposta para uma interface amigável e moderna

### Identidade

Manter o azul clínico já usado, com fundo muito claro, cartões brancos, texto escuro e um tom de apoio discreto. Reservar vermelho para situações que exigem atenção. A modernização deve vir da hierarquia, legibilidade e acabamento consistente.

O símbolo nas imagens ainda remete à maternidade. Há texto de pré-natal no manifesto do aplicativo e menção a gestação na exclusão de dados. Atualizar marca, ícones instaláveis, descrições e textos visíveis para “Encorpei Saúde Cardio”. Limpar referências antigas de manutenção também reduzirá confusão futura.

### Paciente

Sugestão de navegação: **Hoje · Minha saúde · Registrar · Minha equipe · Mais**.

- Hoje: próximo cuidado e resumo essencial.
- Minha saúde: evolução, pressão, peso, sono, atividade e exames.
- Registrar: pressão, dose, peso ou sintoma em poucos toques.
- Minha equipe: médico, mensagens, consultas e cuidador.
- Mais: pulseira, conteúdo, conta e suporte.

Na abertura, mostrar saudação, aviso relevante quando existir, tarefa prioritária do plano e último registro com data. Em seguida, um resumo curto da evolução e a próxima consulta. Educação e conquistas entram abaixo, sem competir com a tarefa principal.

Evitar duas listas concorrentes de pendências: hoje existem “O combinado de hoje” e “O que falta hoje”, alimentadas por lógicas diferentes. Fazer toda a experiência responder ao mesmo plano.

A idade do coração pode permanecer na evolução, com explicação próxima ao número. Eu não a colocaria como mensagem dominante de todas as visitas: no exemplo, o número 80 ocupa muito destaque e pode gerar ansiedade. Priorizar ações possíveis e progresso observado, sem prometer rejuvenescimento do órgão.

“Tempo no alvo” deveria ser apresentado ao paciente como **“Medidas de pressão dentro da meta”**, porque o cálculo conta amostras, não monitora continuamente o tempo. Mostrar período, número de medidas e ausência de dados suficientes.

Para legibilidade, propor texto principal de 16–18 px e botões de 44–48 px como meta de produto. Reduzir textos importantes de 10–11 px. Testar teclado, leitor de tela, ampliação, contraste e telas estreitas. Os critérios de [acessibilidade WCAG 2.2](https://www.w3.org/TR/WCAG22/) dão a referência; não houve auditoria completa de conformidade nesta revisão.

Nas imagens, o botão de importar arquivo ultrapassa a largura disponível e o botão flutuante de mal-estar se sobrepõe a conteúdo. Encurtar para “Importar arquivo”, permitir quebra adequada e reservar espaço para navegação e ação fixa. Verificar no aplicativo em execução após a correção.

### Cardiologista

O painel deve responder: **quem precisa de avaliação, por quê e qual foi a última informação confiável?**

Usar busca visível e filtros por prioridade, falta de dados, condição e pendência. Em computador, uma tabela com colunas alinhadas facilita comparar carteiras maiores; no celular, manter cartões. Mostrar motivo, última medida, origem, período, adesão autorrelatada e ação para abrir o caso.

Adicionar um estado **“Sem dados recentes”**. Não classificar como estável apenas porque não há alerta registrado.

No detalhe, manter identificação e alergias acessíveis e organizar uma linha do tempo com medidas, sintomas, doses, exames, mensagens e condutas. Gráficos devem informar período, unidade, meta e quantidade de amostras; lacunas precisam aparecer.

O fluxo de alertas deve evoluir de “lido/dispensado” para responsável, em avaliação, contato realizado, resolvido e justificativa. Separar risco clínico de atraso operacional e informar ao paciente como funciona o acompanhamento.

### Pulseira

Tela principal com nome do dispositivo, última sincronização bem-sucedida, bateria quando disponível, dados recebidos e uma ação principal. Estados claros: não conectada, conectando, sincronizando, atualizada, falhou e dados atrasados.

Diagnóstico de serviços e firmware fica em “Ajuda e detalhes do dispositivo”. Evitar transformar o paciente em responsável por entender protocolos. Não mostrar “ativa” como sinônimo de dados chegando ao médico.

## 5. Integração da pulseira: o que depende do aparelho

O código assume H59/H59 Max e menciona QWatch PRO. A mensagem do usuário não confirma esse modelo; comentários sobre chip, sensores, bateria e aplicativo não foram verificados com o fornecedor. Tratar tudo isso como hipótese até conferir anúncio, manual e unidade recebida.

| Capacidade | Situação encontrada |
|---|---|
| FC ao vivo | Cliente para serviço Bluetooth padrão; depende de o firmware disponibilizá-lo |
| Bateria e firmware | Leitura opcional quando expostos pelo aparelho |
| HRV | Cálculo a partir de intervalos RR, se enviados; fluxo de persistência incompleto |
| SpO₂, passos e sono por Bluetooth | Protocolo proprietário não implementado |
| Histórico completo | Depende de SDK/API/documentação ou arquivo exportável real |
| CSV | Parser e importação parcial; precisa ser ajustado ao arquivo do fabricante |
| Coleta com navegador fechado | Não implementada como serviço confiável |
| ECG, temperatura e glicemia | Não presumir suporte; não há integração demonstrada |

Web Bluetooth tem disponibilidade limitada e depende de contexto seguro e autorização. Isso impede prometer a mesma experiência em todos os celulares. Ver [documentação da API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).

Antes da chegada, solicitar ao fornecedor modelo exato, aplicativo, manual, SDK, protocolo BLE, condições de uso da API e um arquivo de exportação de exemplo. Depois, testar conexão, serviços, leituras, horários, perda de contato, reconexão, duplicatas, ausência de internet e sincronização em cada plataforma pretendida.

A arquitetura deve aceitar adaptadores por fabricante: **dispositivo/app do fabricante → recepção → validação e deduplicação → armazenamento → regras de acompanhamento → painel e notificações**. Preservar horário de medição e recebimento, unidade, dispositivo, versão, qualidade e origem.

Pressão estimada por dispositivo sem validação não deve ser promovida a medida clínica apenas por ter sido importada. A [comunicação da FDA sobre dispositivos de pressão não autorizados](https://www.fda.gov/medical-devices/safety-communications/do-not-use-unauthorized-devices-measuring-blood-pressure-fda-safety-communication) reforça o risco; ela não determina a situação regulatória brasileira deste aparelho específico.

## 6. Ordem recomendada de execução

| Etapa | Entrega | Como aceitar |
|---|---|---|
| 1. Base confiável | Permissões, funções ausentes, gravação e origem, painel com dados reais | Contas separadas não acessam/alteram dados indevidos; migrações completas; indicadores correspondem ao banco |
| 2. Experiência principal | Nova abertura do paciente, navegação, painel e detalhe médico, identidade Cardio | Paciente registra uma medida e uma dose sem ajuda; médico encontra uma pendência e registra a avaliação |
| 3. Pulseira real | Adaptador homologado para o modelo recebido, sincronização e tratamento de falhas | Registro percorre aparelho → banco → paciente/médico com data e origem preservadas, sem duplicar |
| 4. Piloto acompanhado | Operação de alertas, mensagens, suporte e validação clínica | Responsável e tempo de resposta definidos; falhas observáveis; regras revisadas |
| 5. Expansão | Equipes, cobrança, múltiplas unidades e integrações adicionais | Oferta comercial corresponde a funcionalidades testadas |

Medir no piloto: conclusão do cadastro, primeira medida, tempo para registrar, uso recorrente, tarefas concluídas, atraso de sincronização, alertas revisados e tempo do médico por paciente. Definir metas com a equipe após observar o primeiro grupo, sem inventar indicadores de eficácia clínica.

**Recomendação de produto:** concentrar a primeira versão utilizável em medidas, remédios, sintomas, exames, plano do médico, mensagens e sincronização confiável. Preservar os módulos de engajamento já construídos, exibindo-os conforme necessidade. Isso permite uma interface mais leve sem descartar o trabalho existente.
