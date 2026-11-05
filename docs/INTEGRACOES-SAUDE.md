# Integrações de saúde

## Entrega web

`/integracoes` no app do paciente, acessível em Preferências. Importação explícita de `export.xml` do Apple Saúde, incluindo origens Apple Watch e apps que gravem no Saúde. Prévia local; seleção de uma origem e período; confirmação antes de persistir. Limite 25 MB / 100 mil registros. ZIP deve ser descompactado. Dados não vão para localStorage.

Reutiliza `useWearableSync` com sessão autenticada, tabelas clínicas existentes, vínculo `source_device_id` e categorias `apple_health` / `health_connect`. Não altera RLS nem permite escolher outro paciente. Não equivale a autorização HealthKit. Nenhum selo de conexão automática é exibido.

Suporte: frequência cardíaca (bpm), SpO2 (%), passos, calorias ativas (kcal/kJ), sono (união de intervalos dormindo). Tipos desconhecidos, unidades inválidas, futuro e valores fora das faixas são descartados. Sono acordado/no leito não é duração dormida. Estágios sobrepostos não são somados. Atividade só em dias encerrados, sem sobreposição e sem cruzar meia-noite. O limite de dia encerrado usa UTC; registros próximos à meia-noite podem esperar a próxima importação. Todos entram como estimated. Não importa ECG, HRV, pressão, glicose ou peso por este adaptador.

Deduplicação e persistência usam o importador existente: medidas pontuais por minuto/valor; atividade e sono com granularidade diária. Não é motor de atualização incremental: dias de atividade existentes não são substituídos. Falhas parciais são reportadas. O painel do médico usa as mesmas tabelas; acesso depende do vínculo e das políticas existentes.

## Contrato para futuro adaptador Android

Entrada JSON de integração, NÃO é formato de backup/exportação oficial do Health Connect:

```json
{"schema":"encorpei.health.v1","platform":"health_connect","samples":[{"type":"heart_rate","source":"Aplicativo do relógio","start":"2026-01-01T10:00:00-03:00","end":"2026-01-01T10:00:00-03:00","value":72,"unit":"bpm"}]}
```

Tipos/unidades: heart_rate/bpm, spo2/%, steps/count, active_calories/kcal, sleep/asleep (value 1). Datas com fuso obrigatórias. Nenhum ID de usuário fornecido no arquivo é utilizado. Esse contrato prepara o recebimento; não existe app Android nativo nem endpoint de sincronização automática nesta entrega.

## Próxima etapa necessária para automático

- iOS: aplicativo nativo com HealthKit, permissões por tipo, consultas ancoradas, observer/background delivery e envio autenticado ao backend. Não garante tempo real.
- Android: aplicativo nativo com Health Connect, permissões por tipo e para leitura em segundo plano quando disponível; trabalho periódico e envio autenticado. Depende de o app do fabricante gravar no Health Connect. QWatch Pro/H59MAX ainda não confirmado.
- Backend incremental: IDs estáveis por origem/amostra, upsert, exclusões e revogação, cursor, retentativas idempotentes, auditoria e estado de última sincronização. Não reutilizar totais diários atuais como se fossem incrementais.
- Serviços cloud: avaliar APIs oficiais e credenciais/aprovação do fabricante, incluindo Google Health API quando aplicável. Não criar integração nova com Google Fit legado.
- Testar em dispositivos físicos, com consentimento, Android/iOS em segundo plano, desconexões e revogação. Não há garantia de suporte a qualquer smartwatch.

Referências oficiais: https://developer.android.com/health-and-fitness/health-connect/read-data ; https://developer.apple.com/documentation/healthkit/executing-observer-queries ; https://support.apple.com/en-ie/guide/iphone/iph5ede58c3d/ios ; https://developer.android.com/health-and-fitness/health-connect/migration/fit

Validação desta entrega: testes unitários de adaptação/normalização, TypeScript e build. Não validada com exportação real do usuário, aparelho físico ou escrita na conta de produção.
