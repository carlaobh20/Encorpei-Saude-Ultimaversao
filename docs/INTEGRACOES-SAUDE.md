# Integrações de saúde — estado da implementação

## O que funciona na web

`/integracoes`, em Preferências e Pulseira: importação de `export.xml` do Apple Saúde, com prévia, seleção de uma origem, período e confirmação. Até 25 MB e 100 mil registros; ZIP precisa ser descompactado. Importação JSON `encorpei.health.v1` é contrato Encorpei, NÃO backup oficial do Health Connect.

Batimentos, SpO2, passos, calorias ativas e sono. Tipos desconhecidos não geram registros; dados não ficam em localStorage. Importador antigo preservado: estimativas e proveniência, deduplicação de leituras pontuais; dias de atividade existentes não são substituídos. Não soma celular e relógio, não presume repouso. Sono usa união de intervalos; atividade só importa dias encerrados (UTC).

## Implementado nesta etapa, dependente de ativação

- Capacitor 8.6.0 + `@capgo/capacitor-health` 8.11.14, versões fixadas e lockfile.
- Leitura nativa HealthKit/Health Connect, somente 5 permissões de leitura, nenhum envio para a plataforma de saúde. Solicitação iniciada pelo paciente após consentimento no Encorpei.
- Leitura dos últimos 7 dias, recorte recursivo de páginas lotadas, erro explícito se não puder garantir cobertura. Sem falsa indicação de leitura autorizada no iOS (HealthKit não revela necessariamente permissões de leitura negadas).
- Identidade da amostra inclui origem, ID nativo, tipo e instante (uma série de FC no Android pode conter várias amostras com o mesmo ID de registro). Correções com a mesma identidade fazem upsert.
- Depois de autorizar, tenta sincronizar a cada 15 minutos **somente enquanto o app nativo estiver aberto/visível**. Ao retomar ou voltar a internet, tenta novamente respeitando intervalo. Exclusão/recriação e mudanças de timestamp na origem ainda exigem fluxo nativo de changes/anchors.
- RPC transacional `health_sync_batch`, 500 operações/lote, revisão otimista, idempotência com ID/hash, upsert, exclusões explícitas, validação e rollback integral de lote inválido. Retry mantém ID e conteúdo. Cursor avança apenas com commit. Lotes anteriores sobrevivem à falha de um lote posterior.
- Tabelas `health_connections`, `health_samples`, `health_sync_batches`, todas com RLS. Paciente escreve apenas seus dados; médico vinculado só lê conexões/amostras. Sem service-role no cliente, sem SECURITY DEFINER. Registro por lote contém contagens/hash, sem cópia do conteúdo clínico. Não representa auditoria imutável, pois dados do próprio paciente são editáveis sob RLS.
- Pausa de novos envios no servidor. Histórico permanece. Revogar permissão do sistema é outra ação, nas configurações de saúde do telefone.
- Painel nativo em `/integracoes` e na ficha do paciente do médico: última recepção, atraso >24h, amostras por origem. Atualiza a consulta a cada 60 segundos enquanto aberto. Exibe até 100 amostras recentes, com aviso de limite. Não soma intervalos nem fontes, não classifica clinicamente, não alimenta alertas ou médias existentes. A importação XML continua alimentando o histórico existente.
- Novas tabelas incluídas no manifesto de exportação/exclusão LGPD. A exclusão do usuário também remove via cascata.

## Ativar no ambiente correto

Projeto de produção: **rmodoqflmabzfsqieiln**. As conexões Supabase disponíveis nesta execução não possuem acesso a ele. NÃO aplicar em `lcwtiswemmslcibjitny` (NewEncorpeiSaude): é outro projeto.

1. Conectar a conta com acesso ao projeto correto, conferir estrutura e aplicar SOMENTE `supabase/migrations/20261105144003_health_sync_incremental.sql` por migração. Não executar todas as migrações antigas sem conferir o histórico.
2. Rodar advisors e verificar RLS com contas de teste: titular, outro paciente e médico vinculado. O frontend detecta tabela ausente e mostra aguardando ativação; não acusa conectado.
3. Republicar as Edge Functions `exportar-meus-dados` e `excluir-minha-conta` para incluir as novas tabelas na portabilidade/exclusão. Não armazenar dados reais antes disso.
4. Compilar e instalar o aplicativo nativo; conceder permissões no próprio celular.

## Gerar Android/iOS

Node >=22, `npm ci`, depois:

```sh
npm run native:android
# abrir android/ no Android Studio; compilar/assinar/instalar
npm run native:ios
# abrir ios/App/App.xcodeproj no Xcode; configurar Team e assinatura
```

O gerador cria projetos locais reproduzíveis, copia o build web, sincroniza o plugin, configura privacidade e entitlement HealthKit, e remove do manifest Android permissões de saúde extras trazidas pela dependência (inclusive todas as de escrita). Não usa uma URL remota na WebView. Reexecutar após alterar a web. App ID inicial `com.encorpei.cardio`: registrar nas contas Apple/Google antes de distribuir.

**Geração/sync não equivalem a compilação nativa ou aplicativo distribuído.** Nesta execução foram geradas/sincronizadas ambas as plataformas; não há APK/IPA assinado, TestFlight ou Play Store.

## Ainda falta para o objetivo de não abrir o aplicativo

- Serviço nativo de segundo plano: WorkManager + permissão background no Android; HealthKit observer/anchored queries no iOS. O plugin selecionado não entrega, por si, um uploader background. Não fingir que timer web funciona com app fechado.
- Persistência cifrada de fila e tokens no Keystore/Keychain, refresh de sessão fora da WebView, retry/backoff e cancelamento/revogação. O fluxo atual mantém amostras em memória e releitura de 7 dias, sem prometer recuperação de interrupções maiores.
- Changes tokens/anchors para capturar exclusões, alterações e histórico além da janela; RPC já recebe exclusões, mas o leitor atual não as descobre sozinho.
- Armazenamento normalizado não é agregação clínica: integrar séries nativas às médias/gráficos existentes com regras por tipo/origem e sem contar novamente dados previamente importados.
- Testes físicos de permissões parciais, tela bloqueada, processo encerrado, bateria, offline, troca de conta, revogação e exclusões. Aprovações e formulários das lojas.
- Confirmar QWatch Pro -> Health Connect no Android. Nenhuma API pública/integrabilidade H59MAX foi comprovada. O sistema não consegue buscar um dado que o app fabricante não disponibiliza.
- APIs cloud de outros fabricantes exigem integração oficial/credenciais; nenhuma autorização Fitbit/Garmin/Google Health API foi configurada. Google Fit legado não é base nova.

## Verificação

25 testes TypeScript (importação, unidades, origem, paginação e sono); 4 testes PostgreSQL via PGlite (transações, replays, revisão, validação, RLS titular/outro/médico/anon e revogação); TypeScript e build Vite. PGlite testa migração real sobre auth/vínculo mínimos de teste: não substitui advisors ou verificação no Supabase de produção.

Referências oficiais:
- https://developer.android.com/health-and-fitness/health-connect/read-data
- https://developer.apple.com/documentation/healthkit/executing-observer-queries
- https://capgo.app/docs/plugins/health/
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://supabase.com/docs/guides/database/functions
