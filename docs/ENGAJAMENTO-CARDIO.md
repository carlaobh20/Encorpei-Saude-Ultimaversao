# O que faz o paciente QUERER abrir o app

Documento de produto. O `MAPEAMENTO-CARDIO.md` responde "o que o cardiologista precisa".
Este responde a pergunta mais difícil: **por que o Antônio, 68 anos, hipertenso, abriria isso
de novo amanhã?**

> **[Certo]** fato/evidência · **[Provável]** inferência forte · **[Palpite]** hipótese a validar

---

## 1. A premissa que não sobrevive ao teste

A ideia era: "vamos fazer bem completo, com várias funcionalidades e medições, aí ele passa a
ter melhor controle da vida dele."

**Quantidade de funcionalidade não produz vontade de usar — produz abandono.** [Provável, e é
o padrão mais consistente em saúde digital] Um app com 40 telas para um homem de 68 anos que
não gosta de tecnologia entrega uma sensação específica: *"isso é trabalho"*. E trabalho sem
recompensa imediata some do celular em três semanas.

O erro está numa palavra: **"controle"**. Controle é o que **você** quer (e o que o médico
quer). Não é o que o paciente sente falta. Ninguém acorda querendo controlar a própria pressão.
As pessoas acordam querendo:

- **não ter medo** — o paciente cardíaco vive com um susto de fundo: cada palpitação, cada dor
  no braço, cada noite mal dormida é "será que é o coração?";
- **ver que está melhorando** — prova visível de que o esforço vale;
- **não dar trabalho para a família** — e, do outro lado, a família quer saber se ele está bem.

Quem entrega essas três coisas ganha o hábito. As 40 medições são consequência, não causa.

## 2. O que o Mamãe tinha e o Cardio não tem (e como devolver isso)

No Mamãe, o motor de vontade não é o app: **é o bebê**. Toda semana tem uma novidade que a
mãe quer ver, e ela não precisa de disciplina para isso — ela quer.

Cardiologia não tem bebê. Mas tem um equivalente, e ele é forte: **o próprio corpo mudando, com
prova**. A gestação mostra progresso semana a semana; o coração também mostra — só que ninguém
nunca mostrou para o paciente de um jeito que ele entenda.

Então o motor narrativo do Cardio é:

> **"Seu coração está melhorando, e aqui está a prova."**

Três números fazem esse trabalho. Eles são o coração do produto — literalmente:

### 2.1 Idade do Coração
**[Certo]** Conceito consolidado (*heart age* / idade vascular): a idade de uma pessoa com
fatores de risco ideais que teria o mesmo risco cardiovascular que o paciente tem hoje.
Calculada a partir do próprio Framingham que já está no código.

Por que funciona: "LDL 78 mg/dL" não significa nada para o Antônio. **"Seu coração tem 74 anos,
mas você tem 68"** significa tudo — e dói na medida certa. E o inverso também: quando ele baixa
a pressão e anda mais, o número **cai**, e cai por causa dele. É a única métrica do app que
transforma esforço em recompensa visível e emocional.

Com projeção: *"mantendo a pressão no alvo e 6 mil passos, em 6 meses seu coração tem 71 anos."*
Isso é a "semana 24" do Cardio.

### 2.2 Tempo no Alvo
Percentual das medidas de pressão dentro do alvo, na semana e no mês. Um número só, de 0 a 100%.
**[Provável]** É o que o paciente entende sem explicação, e é o que o médico quer olhar — o mesmo
número serve aos dois, o que é raro e valioso.

### 2.3 Capacidade
O que o corpo consegue fazer: distância no teste de caminhada de 6 minutos, teste de sentar-e-
levantar de 30 segundos, e **recuperação da frequência cardíaca em 1 minuto** (queda < 12 bpm é
marcador prognóstico ruim [Certo] — e é medível pela pulseira). Repetido a cada 4–8 semanas,
vira uma curva. Uma curva subindo é a melhor propaganda que o app pode fazer de si mesmo.

## 3. As quatro alavancas de hábito

### 3.1 Reciprocidade: toda medida devolve algo
Regra de design: **nenhuma tela aceita um dado sem devolver uma frase que só faz sentido para
aquele paciente.** Registrou 138/86? A resposta não é "salvo com sucesso" — é *"essa é a sua
terceira medida acima do alvo esta semana; nas últimas 4 semanas você estava em 71% no alvo."*
Um app que só engole dado é um formulário. Um app que responde é um interlocutor.

### 3.2 "Como estou agora?" — o botão contra o medo
A necessidade emocional nº 1 do paciente cardíaco é **tranquilização**, e hoje ela é atendida
por Google às 3 da manhã, o que é péssimo. O app assume esse papel — com um limite rígido:

- **Nunca diz "você está bem".** Diz o que os números dele mostram hoje, comparados ao padrão
  dele mesmo, e registra para o médico ver.
- **Sinal de alarme → emergência, sem rodeio.** Dor no peito em repouso, síncope, falta de ar
  súbita, sinais de AVC: vai direto para a tela do 192.
- É triagem e espelho, nunca diagnóstico (ver `MAPEAMENTO-CARDIO.md` §6).

### 3.3 Modo Cuidador — o usuário que ninguém lembra
**[Provável] Esta é a maior alavanca de retenção do produto, e é a mais barata de construir.**
Quem realmente cuida da adesão do cardiopata de 68 anos é a esposa, a filha, o filho. Eles são
os *power users* escondidos: querem saber se ele tomou o remédio, se a pressão está boa, e
querem ser avisados se algo sair do lugar.

Um cuidador convidado pelo paciente (leitura apenas, revogável a qualquer momento) faz três
coisas ao mesmo tempo: aumenta a adesão, cria um segundo usuário engajado por paciente, e
transforma o app em algo que **a família pede para o pai usar**. O médico ganha um aliado.

### 3.4 Educação sobre o SEU caso, não sobre "o coração"
Micro-conteúdo de 40 segundos, disparado pelo dado real do paciente: quando o eco dele registra
FEVE 45%, o app explica o que é fração de ejeção **com o número dele dentro da frase**. Quando
o médico sobe a dose do carvedilol, aparece uma nota curta do que esperar. É o "semana a semana"
do Mamãe, só que puxado pelo prontuário em vez do calendário.

## 4. O mapa completo de funcionalidades e medições

Organizado por camada. A camada 1 é o que faz voltar; a 2 é o "tudo" que você pediu; a 3 é o que
sustenta as duas.

### Camada 1 — espinha emocional (faz querer usar)
| Funcionalidade | O que é |
|---|---|
| Idade do Coração | número + evolução + projeção do que muda se mantiver o comportamento |
| Tempo no Alvo | % de medidas de pressão no alvo, semana/mês, com série histórica |
| Capacidade | 6 minutos de caminhada, sentar-e-levantar 30s, recuperação da FC em 1 min |
| Como estou agora | triagem de sintoma + espelho dos próprios números + rota de emergência |
| Modo Cuidador | familiar convidado, leitura, alertas, revogável |
| Meu Mês | uma página bonita com o mês do paciente, para ele e para levar na consulta |
| Conquistas discretas | sem infantilizar: "12 dias sem esquecer nenhum remédio" |
| Caminhada guiada | sessão com faixa de FC **definida pelo médico**, ao vivo pela pulseira |
| Aprender | micro-lições puxadas pelos exames e pelas medicações do próprio paciente |

### Camada 2 — medições e registros (o "tudo")
**Cardiovascular:** pressão (com contexto de MRPA), frequência de repouso, ritmo irregular,
HRV, recuperação da FC, pressão de pulso.
**Corpo:** peso, IMC, circunferência abdominal, temperatura, edema (escala visual de 0–3).
**Metabólico:** glicemia (jejum/pós/aleatória), HbA1c, lipidograma completo, ApoB, Lp(a).
**Rim e eletrólitos:** creatinina, TFG, potássio, sódio, relação albumina/creatinina.
**Coração (marcadores):** NT-proBNP, troponina.
**Respiratório e sono:** SpO₂ pontual e noturna, dessaturação, roncos relatados, escala de
sonolência de Epworth, duração/estágios/eficiência do sono.
**Funcional:** NYHA por perguntas simples, Borg (esforço percebido), 6MWT, sentar-e-levantar,
distância de claudicação.
**Estilo de vida:** passos, minutos em zona, sessões de caminhada, sódio estimado por refeição,
água, álcool, cigarros (e dias sem fumar), estresse percebido.
**Sintomas:** dor torácica, dispneia, palpitação, edema, síncope/pré-síncope, claudicação,
tosse seca, fadiga, tontura — cada um com seus qualificadores.
**Medicações:** classe, dose atual, dose-alvo, horários, adesão por dose, efeitos relatados,
histórico de titulação.
**Exames:** ECG, eco, ergométrico, Holter, MAPA, angio-TC com escore de cálcio, cintilografia,
RM, cateterismo, doppler de carótidas — com campos estruturados.
**Qualidade de vida:** questionário curto mensal (derivado do KCCQ, simplificado) — vira curva.

### Camada 3 — o que sustenta
Lembretes inteligentes (não notificação genérica: "faltam as duas doses da noite"), modo
offline, sincronização da pulseira, importação de arquivo, relatório PDF, canal com o médico,
auditoria e LGPD, acessibilidade (fonte grande, contraste alto, alvos de toque grandes).

## 5. O que eu recomendo NÃO fazer

- **Gamificação com medalhas, pontos e mascote.** [Provável] Infantiliza, e o público de 65+
  lê isso como desrespeito. Conquista em texto seco funciona; troféu colorido não.
- **Diário alimentar com contagem de calorias.** Abandono altíssimo e não é o que muda desfecho
  cardiovascular. Sódio, sim — é uma pergunta por refeição, não uma tabela.
- **Chat com IA respondendo dúvida clínica do paciente.** É onde o produto vira dispositivo
  médico regulado e onde um erro tem consequência real. O canal é com o cardiologista.
- **Notificação diária fixa.** Vira ruído em uma semana. O app só fala quando tem o que dizer.

## 6. Decisões que tomei por você (ratificar ou vetar)

1. **A espinha do app do paciente passa a ser Idade do Coração + Tempo no Alvo + Capacidade**,
   e não a lista de medições. As medições continuam todas lá — só deixam de ser a primeira coisa
   que ele vê.
2. **"Como estou agora" nunca emite veredito de "está tudo bem"** — mostra os números do paciente
   e escala para emergência quando houver sinal de alarme.
3. **A faixa de frequência da caminhada guiada é definida pelo médico**, não pelo app. Sem isso,
   prescrição de exercício para cardiopata seria conduta clínica automatizada.
4. **Cuidador tem acesso somente de leitura**, convidado pelo paciente e revogável por ele a
   qualquer momento — nunca cadastrado pelo médico ou pela clínica.
