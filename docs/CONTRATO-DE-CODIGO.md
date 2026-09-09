# Contrato de código — Encorpei Cardio

Referência obrigatória para quem escreve tela neste projeto.
O domínio clínico está em `docs/MAPEAMENTO-CARDIO.md`; aqui está a mecânica.

## Stack

React 18 + TypeScript + Vite · Tailwind + shadcn/ui (`@/components/ui/*`) ·
TanStack Query · Supabase · react-router-dom v6 · lucide-react · recharts ·
framer-motion · sonner (toast). Alias `@/` → `src/`.

## Idioma

Interface, comentários e nomes de domínio em **português do Brasil**.
Nomes técnicos herdados (hooks `use*`, props) podem ficar em inglês.

## Design

Tokens em `src/index.css` + `tailwind.config.ts`. **Nunca** hex solto:
use `bg-primary`, `text-muted-foreground`, `border-border`, `bg-cardio-50`,
`text-cardio-dark`, `bg-success/bg`, `text-warning`, `text-error`.
Fonte de display: `font-display` (Sora). Cantos: `rounded-xl` / `rounded-2xl`.
Cores hex para gráficos: `DOMAIN_COLORS` em `@/theme/colors`.

Componentes prontos que **devem** ser reaproveitados:
`@/components/shell/*` → `PageHeader`, `SectionHeader`, `SurfaceCard`,
`StatCard`, `EmptyState`, `ContentGrid`, `AppModal`, `Skeletons`, `StatusBadge`.
`@/components/ui/*` → button, card, input, select, dialog, sheet, badge,
textarea, label, tooltip, alert-dialog, skeleton.

## Dados — hooks disponíveis

Todos funcionam em **modo demo** (dados em memória, nada é gravado).
Todos aceitam `patientUserId` opcional: sem argumento = paciente logado;
com argumento = paciente que o médico está vendo.

```ts
// @/hooks/useCardioReadings
useBloodPressure(uid?)  // { readings, ultima, registrar, isLoading }
useHeartRate(uid?)      // { readings, repouso, ultima, registrar }
useWeight(uid?)         // { readings, ultimo, registrar }
useSpo2(uid?)           // { readings, ultima, registrar }
useGlucose(uid?)        // { readings, registrar }
useSleep(uid?)          // { records, ultima, mediaMinutos }
useActivity(uid?)       // { records, hoje, passosMedia, mvpaSemana }

// @/hooks/useCardioPatient
useCardioPatient(uid?)  // useQuery → { data: CardioPatient | null }
useSalvarCardioPatient()
useTargets(uid?)        // { targets, ehSugestao, isLoading }
useSalvarTargets()

// @/hooks/useCardioMedications
useCardioMedications(uid?)
// { medications, ativas, dosesDeHoje, adesao: {d7,d14,d30}, marcarDose, titular, salvarMedicacao }
// MED_CLASS_LABEL, MED_CLASS_MONITORAR

// @/hooks/useCardioClinical
useSymptoms(uid?)       // { symptoms, registrar }
useLabResults(uid?)     // { labs, ultimoPorMarcador, salvar }
useCardioExams(uid?)    // { exams, salvar }
useCardioAlerts(uid?)   // { alerts, naoLidos, marcarLido, dispensar }
useDevices(uid?)        // { devices, registrar }
useRiskAssessment(uid?) // { risk: { level, score, alerts, headline } }

// @/hooks/useProfessional
useProfessionalProfile()  // { profile, isLoading, isError, refetch, salvar }
useProfessionalPatients() // { patients (fila ordenada por risco), ativos, pendentes, contagem, desvincular }
useProfessionalAlerts()   // { alerts, naoLidos, criticos, marcarLido, dispensar }
usePatientMessages(patientUserId, "patient"|"doctor", senderUserId)
                          // { messages, naoLidas, enviar, marcarLidas }
useAppointments(uid?)     // { appointments, proxima, salvar }

// @/hooks/useProfile  → perfil básico (nome, telefone)
// @/hooks/useInviteCode → código de convite do médico
// @/contexts/AuthContext → useAuth(): { user, session, loading, signOut, isDevMode }
```

Mutations do TanStack: use `.mutate(...)` / `.mutateAsync(...)` e
`.isPending` para estado de carregando.

## Domínio clínico

```ts
// @/lib/clinical/cardioRiskEngine
avaliarRisco(input) → { level: "green"|"yellow"|"red", score, alerts, headline }
mediaMrpa(leituras, now, dias?) → { systolic, diastolic, n } | null
RISK_LABEL

// @/lib/clinical/cardioAlertRules
ALERT_RULES  // código → { label, severity, patientMessage, doctorMessage, defaultThreshold }
podeDispararAlerta(validationStatus)

// @/lib/clinical/cardioTargets
DEFAULT_TARGETS, LDL_TARGET_BY_RISK, RISK_CATEGORY_LABEL, sugerirAlvos, avaliarMeta

// @/lib/clinical/scores
calcularIMC, classificarIMC, calcularTFG, idadeEmAnos, ldlFriedewald, naoHDL,
cha2ds2Vasc, cha2ds2VascDoPaciente, hasBled, classificarNyha, NYHA_DESCRICAO,
framinghamRisco10a

// @/lib/wearable
conectarPulseira, bluetoothDisponivel, motivoIndisponivel   (bleClient)
importarCsv                                                  (importer)
amostraParaLeituras, linhasParaLeituras, rotuloProveniencia  (normalize)
```

Tipos: `@/types/cardio`.

## Três regras que não se quebram

1. **Nenhuma tela prescreve conduta.** Alerta e orientação terminam em
   "avise seu médico" / "procure atendimento". Nunca "aumente a dose",
   "tome mais diurético", "pare o remédio". Motivo em docs §6 (SaMD/ANVISA).
2. **PA da pulseira é estimativa.** Onde aparecer leitura com
   `validation_status === "estimated"`, mostre o badge de
   `rotuloProveniencia()` e a frase curta "estimativa — não usar para decisão
   clínica". Nunca some com medida de manguito no mesmo número.
3. **Dor torácica em repouso não vira card na fila.** Vira tela de emergência
   com o telefone 192 (`EMERGENCIA_TELEFONE` em `@/lib/config`).

## Tom de escrita

O paciente típico tem 60–75 anos e não gosta de app. Frases curtas, números
grandes, uma ação por tela, zero jargão ("pressão", não "PA"; "batimentos",
não "FC"). O médico é o oposto: densidade de informação alta, jargão correto,
tudo com data e origem.

## Padrões de tela

- Toda página começa com `<PageHeader title=... subtitle=... />`.
- Estado vazio: `<EmptyState />`, nunca uma tela em branco.
- Carregando: skeleton, nunca spinner de tela cheia dentro do shell.
- Erro: mensagem em português + botão "Tentar de novo".
- Toda página é `export default function NomePage()`.
- Nada de `localStorage` para dado clínico.

---

## Camada de engajamento (docs/ENGAJAMENTO-CARDIO.md)

Leia o documento antes de mexer nestas telas. A espinha do app do paciente é
**Idade do Coração + Tempo no Alvo + Capacidade** — não a lista de medições.

### Motores (funções puras, sem React)

```ts
// @/lib/clinical/heartAge
calcularIdadeDoCoracao(entrada) → { idadeReal, idadeDoCoracao, diferenca, riscoPercentual, fatores[] }
projetarIdadeDoCoracao(entrada, { sistolicaAlvo, pararDeFumar, colesterolAlvo }) → number | null
idadeCoracaoSeAplica(patient) → { aplicavel, motivo? }   // não vale em doença estabelecida

// @/lib/clinical/timeInRange
calcularTempoNoAlvo(readings, targets, dias?) → { percentual, dentro, total, variacao, frase }
serieTempoNoAlvo(readings, targets, semanas?) → [{ semana, percentual, total }]
responderMedida(nova, readings, targets) → string   // a regra da reciprocidade

// @/lib/clinical/capacity
distanciaPrevista6min(sexo, idade, alturaCm, pesoKg) · referenciaSentarLevantar(sexo, idade)
lerRecuperacaoFc(quedaBpm) → { rotulo, tom, texto }
evolucaoCapacidade(testes, tipo) → { atual, anterior, variacao, variacaoPct, unidade, frase }
zonaDeTreino(targets) → { definidaPeloMedico, min, max, aviso }
estadoNaZona(bpm, zona) → "abaixo"|"dentro"|"acima"|"sem_alvo" · TEXTO_ZONA · MOTIVOS_PARA_PARAR

// @/lib/clinical/comoEstou
SINAIS_DE_ALARME · montarEspelho(ctx) · avaliarComoEstou(resposta, ctx)
  → { desfecho: "emergencia"|"avisar_medico"|"registrar", titulo, mensagem, espelho[], alarmesMarcados[] }

// @/lib/clinical/educacao   licoesPara({ patient, exams, labs, medications }) → Licao[]
// @/lib/clinical/conquistas conquistasDe({...}) → Conquista[] · sequenciaDeAdesao · sequenciaDeMedidas
// @/lib/clinical/sodio      OPCOES_REFEICAO · REFEICOES · lerSodioDoDia · mediaSemanal · SODIO_ALVO_PADRAO
```

### Hooks

```ts
// @/hooks/useEngajamento
useIdadeDoCoracao(uid?)   // { resultado, aplicavel, motivo, faltando[], historico[], projecao, isLoading }
useTempoNoAlvo(uid?)      // { mes, semana, serie, responder(nova) }
useCapacidade(uid?)       // { testes, evolucao: {caminhada, sentarLevantar, recuperacao}, registrar }
useCaminhadas(uid?)       // { sessoes, zona, daSemana, minutosSemana, salvar }
useCheckins(uid?)         // { checkins, registrar }
useContextoComoEstou(uid?)// contexto pronto para avaliarComoEstou()
useSodio(uid?)            // { registros, hoje, alvo, leitura, mediaSemana, registrar }
useQualidadeDeVida(uid?)  // { respostas, ultima, variacao, devePerguntar, responder }
                          // PERGUNTAS_QOL · OPCOES_QOL · calcularScoreQol
useAprender(uid?)         // { licoes, naoLidas, proxima, jaLidas, marcarLida }
useConquistas(uid?)       // Conquista[]

// @/hooks/useCuidadores
useMeusCuidadores()       // { cuidadores, ativos, pendentes, convidar, atualizarPermissoes, revogar }
useDeQuemCuido()          // { vinculos, aceitarConvite }   // lado do familiar
PARENTESCOS · PERMISSOES_ROTULO
```

### Quatro regras a mais nestas telas

1. **Toda medida devolve uma frase.** Nada de "salvo com sucesso": use
   `responderMedida`, `lerSodioDoDia`, `evolucaoCapacidade().frase`.
2. **"Como estou agora" nunca diz que o paciente está bem.** Descreve os
   números dele e escala para `/emergencia` em qualquer sinal de alarme.
3. **A faixa de esforço da caminhada vem do médico** (`zonaDeTreino`). Sem
   faixa definida, a sessão é livre — o app não inventa intensidade.
4. **Cuidador é convidado pelo paciente, vê só o que ele liberou, e o acesso
   é revogável a qualquer momento.**
