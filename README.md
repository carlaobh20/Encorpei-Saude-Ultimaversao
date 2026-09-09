# Encorpei Cardio

Acompanhamento cardiológico contínuo: **app do paciente** + **painel do cardiologista**.
Derivado da base do Encorpei Mamãe, com o motor clínico trocado de gestação para
doença cardiovascular.

- **Mapeamento clínico e de produto:** [`docs/MAPEAMENTO-CARDIO.md`](docs/MAPEAMENTO-CARDIO.md) — o que o cardiologista precisa. Leia primeiro.
- **Engajamento:** [`docs/ENGAJAMENTO-CARDIO.md`](docs/ENGAJAMENTO-CARDIO.md) — por que o paciente volta. Leia em seguida.
- **Contrato de código:** [`docs/CONTRATO-DE-CODIGO.md`](docs/CONTRATO-DE-CODIGO.md) — leia antes de escrever tela.

## Stack

React 18 · TypeScript · Vite · Tailwind + shadcn/ui · TanStack Query ·
Supabase (Auth, Postgres com RLS, Storage) · Recharts · PWA · Vercel.

## Rodar localmente

```bash
npm install
cp .env.example .env      # preencha com o projeto Supabase do Cardio
npm run dev               # http://localhost:5173
```

Sem `.env` o app sobe, mas só funciona no **modo demonstração**
(dados fictícios em memória, nada é gravado). Para entrar nele, use os botões
"Ver demonstração" na landing.

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm run build       # build de produção + service worker
```

## Banco de dados

Rode, em ordem, no SQL Editor de um projeto Supabase **novo**:
`supabase/migrations/20260909000000_cardio_baseline.sql` e depois
`supabase/migrations/20260910000000_engajamento.sql`. Ele cria o schema, as políticas de RLS e as funções
de apoio. Depois, ajuste a CSP em `vercel.json` para o hostname real do projeto
(hoje está com wildcard `*.supabase.co`).

## Como o produto está organizado

| Área | Rotas | Quem usa |
|---|---|---|
| Público | `/landing` `/planos` `/termos` `/privacidade` | visitante |
| Paciente | `/hoje` `/meu-coracao` `/como-estou` `/meu-mes` · `/pressao` `/remedios` `/atividade` `/sono` `/alimentacao` `/exames` · `/caminhada` `/metas` `/agenda` `/aprender` `/pulseira` `/cuidadores` `/medico` `/emergencia` | pessoa em acompanhamento |
| Cuidador | `/cuidador` | familiar convidado pelo paciente (somente leitura) |
| Cardiologista | `/pro/dashboard` `/pro/pacientes` `/pro/alertas` `/pro/mensagens` `/pro/agenda` `/pro/exames` `/pro/relatorios` | quem paga |
| Admin | `/admin` | operação Encorpei |

Contas de paciente e de médico são **separadas e mutuamente bloqueadas**: um e-mail
cadastrado como médico não entra pelo portal do paciente, e vice-versa.

## A espinha do app do paciente

Três números respondem "estou melhorando?" e são a razão de alguém abrir o app
sem o médico mandar (ver `docs/ENGAJAMENTO-CARDIO.md`):

| Número | Onde vive | O que faz |
|---|---|---|
| **Idade do Coração** | `src/lib/clinical/heartAge.ts` | traduz risco em algo que dói e recompensa: "seu coração tem 74 anos, você tem 68" |
| **Tempo no Alvo** | `src/lib/clinical/timeInRange.ts` | % de medidas de pressão no alvo — serve ao paciente e ao médico |
| **Capacidade** | `src/lib/clinical/capacity.ts` | caminhada de 6 min, sentar-e-levantar, recuperação da frequência |

Ao redor deles: "Como estou agora" (`comoEstou.ts`, triagem + espelho, nunca
veredito), Modo Cuidador (`useCuidadores.ts`), Aprender (`educacao.ts`),
sódio (`sodio.ts`) e conquistas em texto seco (`conquistas.ts`).

## Três regras que o código precisa preservar

1. **O app não prescreve conduta.** Alerta e orientação terminam em "avise seu médico"
   ou "procure atendimento". Motivo: software que sugere conduta é dispositivo médico
   regulado (ANVISA RDC 657/2022) — ver `docs/MAPEAMENTO-CARDIO.md` §6.
2. **Pressão vinda da pulseira é estimativa.** Entra com `validation_status: "estimated"`,
   aparece rotulada, e é proibida de disparar alerta ou entrar na média de MRPA. A regra
   vive em `src/lib/clinical/cardioRiskEngine.ts` (`mediaMrpa`) e em
   `src/lib/wearable/normalize.ts`. Ver §4.
3. **Dor torácica em repouso e síncope não entram em fila.** Vão direto para
   `/emergencia`, com o 192. A tela "Como estou agora" nunca diz que o
   paciente está bem — descreve os números dele e escala quando há sinal de
   alarme (`src/lib/clinical/comoEstou.ts`).
4. **A faixa de esforço da caminhada é prescrita pelo médico.** Sem
   `training_hr_min/max` gravado por ele, a sessão roda livre — o app não
   inventa intensidade de exercício para cardiopata.
5. **O cuidador é convidado pelo paciente, vê só o que ele liberou, e o
   acesso é revogável a qualquer momento.**

## Pulseira H59

`src/lib/wearable/` implementa três caminhos: Bluetooth Web (frequência cardíaca e
bateria pelos serviços GATT padrão — funciona hoje, exceto em iPhone), importação de
arquivo do app do fabricante (plano B universal) e um decodificador plugável para o
protocolo proprietário, à espera do SDK do fornecedor. O que é medida e o que é
estimativa está documentado em §4.
