# Encorpei Cardio — Mapeamento clínico e de produto

Documento-base. Define **o que** o cardiologista precisa acompanhar, **de onde** vem cada dado
(paciente, médico, pulseira H59, laboratório) e **como** isso vira tela, alerta e receita.

> Marcação de confiança usada aqui:
> **[Certo]** protocolo/diretriz consolidada · **[Provável]** inferência forte de prática clínica ·
> **[Palpite]** hipótese de produto a validar com o cardiologista piloto.

---

## 1. A tese do produto (e o risco dela)

O Mamãe funciona porque a gestação tem **prazo, roteiro e desfecho**: 40 semanas, exames por
trimestre, um evento final. O médico entra porque o roteiro já existe e o app o executa.

Cardiologia **não tem esse roteiro natural**. O paciente crônico não tem semana 24. Copiar a
estrutura sem trocar o motor produz um app bonito que o cardiologista abre duas vezes e abandona.

**[Certo]** O que substitui a "semana gestacional" no cardio é o **ciclo de titulação**: a cada
consulta o médico define alvos (PA, LDL, FC, peso, passos) e uma dose; entre consultas o app
mede a distância até o alvo e a adesão. O eixo do produto passa a ser **alvo → medida → titulação**,
não "semana → conteúdo".

**Risco principal que você está ignorando:** o valor do Mamãe para o médico é *engajamento da
paciente* (ela quer usar). No cardio, o paciente típico (55–75 anos, hipertenso, assintomático)
**não quer usar app nenhum**. Se a entrada de dados depender da disciplina dele, o painel do
médico fica vazio em 3 semanas e o produto morre.

**Mitigação mínima (é por isso que a pulseira importa mais aqui do que lá):** o caminho padrão de
dado no cardio precisa ser **automático** (pulseira + aparelho de PA), com entrada manual como
exceção. A tela do paciente deve ser desenhada para quem abre 1×/semana, não 3×/dia.

---

## 2. O que o cardiologista precisa — mapa completo

### 2.1 Identificação e estratificação (uma vez, revisada anualmente)

| Bloco | Campos | Fonte |
|---|---|---|
| Demografia | idade, sexo biológico, cor/etnia (usada em escores), altura, peso, IMC, circunferência abdominal | paciente (onboarding) |
| Hábitos | tabagismo (nunca/ex/atual, maços-ano), álcool (doses/semana), atividade física (min/semana), padrão de sono | paciente |
| História familiar | DAC precoce (H<55a, M<65a), morte súbita, miocardiopatia, dislipidemia familiar | paciente |
| Comorbidades | HAS, DM2, dislipidemia, DRC (com TFG), AOS/apneia, hipotireoidismo, DPOC, obesidade, doença reumatológica | paciente + médico |
| Cardiopatia estabelecida | IAM prévio, angina estável, ICC (FEVE + NYHA), FA/flutter, valvopatia, miocardiopatia, doença arterial periférica, AVC/AIT | médico |
| Procedimentos | angioplastia + stent (data, vasos, tipo), CRM, ablação, marcapasso/CDI/TRC (modelo, data), troca valvar | médico |
| Alergias/intolerâncias | ex.: estatina→mialgia, IECA→tosse, alergia a iodo/contraste | ambos |

**Escores calculados pelo sistema [Certo]:**

| Escore | Para quê | Entradas |
|---|---|---|
| **SCORE2 / SCORE2-OP** | risco CV 10 anos, prevenção primária (Europa, adotado no BR) | idade, sexo, tabagismo, PAS, colesterol não-HDL |
| **ASCVD Pooled Cohort** | alternativa americana | + HDL, DM, tratamento anti-HAS |
| **Framingham (global)** | ainda pedido por muitos convênios BR | idade, sexo, CT, HDL, PAS, tratamento, tabagismo, DM |
| **CHA₂DS₂-VASc** | anticoagular ou não em FA | IC, HAS, idade, DM, AVC, doença vascular, sexo |
| **HAS-BLED** | risco de sangramento sob anticoagulação | HAS, função renal/hepática, AVC, sangramento, INR lábil, idade, drogas/álcool |
| **NYHA** | classe funcional na IC | questionário de 4 perguntas ao paciente |
| **Escore de cálcio (CAC)** | reclassificação de risco | resultado de angio-TC (entrada manual) |

### 2.2 Monitoramento domiciliar — o coração do app

| Variável | Frequência-alvo | Fonte primária | Fonte alternativa |
|---|---|---|---|
| **Pressão arterial (sist/diast)** | MRPA: 2× manhã + 2× noite, 5–7 dias antes da consulta | aparelho de braço validado (manual) | H59 (**estimativa**, ver §4) |
| **Frequência cardíaca de repouso** | contínua | H59 | manual |
| **Peso** | diário na IC, semanal nos demais | balança (manual) | — |
| **SpO₂** | noturna + sob demanda | H59 | oxímetro |
| **Passos / distância** | contínua | H59 | celular |
| **Minutos em zona (MVPA)** | contínua | H59 (FC + passos) | — |
| **Sono: duração, estágios, eficiência, despertares** | diária | H59 | — |
| **HRV (RMSSD/SDNN)** | diária, noturna | H59 | — |
| **Glicemia / HbA1c** | conforme DM | glicosímetro (manual) / lab | — |
| **Sintomas** | evento | paciente (check-in) | — |
| **Adesão medicamentosa** | diária | paciente (1 toque) | — |

**Metas terapêuticas que o app precisa versionar por paciente [Certo]:**
PA alvo (ex. <130/80), LDL alvo por estrato de risco (<70 / <55 / <40 mg/dL), FC de repouso alvo
(IC: 50–70 bpm em uso de betabloqueador), peso seco (IC), passos/dia, min/semana de exercício,
sódio/dia.

### 2.3 Sintomas — o questionário que muda conduta

Cada sintoma tem gatilho de alerta próprio. **[Certo]** Dor torácica em repouso, prolongada,
com irradiação/sudorese **não é alerta para o painel: é tela de emergência com telefone do SAMU**.
O app nunca deve enfileirar isso para o médico ver "quando abrir".

| Sintoma | Qualificadores coletados |
|---|---|
| Dor torácica | local, tipo (aperto/queimação/pontada), duração, gatilho (esforço/repouso/emoção), irradiação, alívio com repouso/nitrato, sintomas associados (sudorese, náusea, dispneia) |
| Dispneia | NYHA I–IV, ortopneia (nº de travesseiros), dispneia paroxística noturna |
| Palpitações | início súbito/gradual, regular/irregular, duração, gatilho, associação com síncope |
| Edema | local (tornozelo/perna/abdome), cacifo, período do dia |
| Síncope / pré-síncope | contexto (esforço, ortostase, micção), pródromos, testemunhado, trauma |
| Claudicação | distância percorrida até a dor |
| Tosse seca | (rastreio de efeito de IECA) |
| Fadiga | escala 0–10 |

### 2.4 Medicações — classes que o motor precisa conhecer

**[Certo]** Titulação é o trabalho central do cardiologista. O app precisa registrar não só "toma
losartana", mas **dose atual, dose-alvo, data da última mudança e por que parou de subir**
(hipotensão, K+, creatinina, bradicardia).

| Classe | Exemplos | O que monitorar após ajuste |
|---|---|---|
| IECA / BRA | enalapril, losartana, valsartana | K+, creatinina, PA, tosse (IECA) |
| ARNI | sacubitril-valsartana | PA, K+, creatinina |
| Betabloqueador | carvedilol, bisoprolol, metoprolol | FC, PA, fadiga, broncoespasmo |
| iSGLT2 | dapagliflozina, empagliflozina | ITU/candidíase, volemia, glicemia |
| ARM | espironolactona | K+, creatinina, ginecomastia |
| Diurético de alça | furosemida | peso, K+, Na+, creatinina, sede |
| Estatina | atorvastatina, rosuvastatina | LDL, mialgia, TGO/TGP, CK |
| Ezetimiba / iPCSK9 | ezetimiba, alirocumabe | LDL |
| Antiagregante | AAS, clopidogrel, ticagrelor | sangramento, dispepsia |
| Anticoagulante | rivaroxabana, apixabana, varfarina | sangramento, INR (varfarina) |
| Antiarrítmico | amiodarona, propafenona | TSH/T4, FC, QT, função hepática |
| Nitrato | isossorbida | cefaleia, hipotensão |
| Bloqueador de canal de cálcio | anlodipino | edema de MMII, PA |

### 2.5 Exames — cronograma e leitura

**Laboratório** — com periodicidade padrão e faixa de referência para colorir o resultado:

lipidograma completo (CT, LDL, HDL, TG, não-HDL), ApoB, **Lp(a)** (uma vez na vida [Certo]),
glicemia de jejum, HbA1c, creatinina + TFG (CKD-EPI), ureia, sódio, potássio, magnésio,
**NT-proBNP** (IC), troponina de alta sensibilidade (evento), TSH/T4L, hemograma, ácido úrico,
TGO/TGP, CPK (sob estatina), EAS + relação albumina/creatinina urinária, vitamina D, INR (varfarina).

**Métodos gráficos e de imagem** — cada um com laudo estruturado no app:

| Exame | Campos estruturados que o app guarda |
|---|---|
| ECG de repouso | ritmo, FC, eixo, PR, QRS, QTc, alterações ST-T, laudo, arquivo |
| Ecocardiograma | FEVE (%), método, diâmetros, AE, septo, PSAP, disfunção diastólica, valvas, strain global |
| Teste ergométrico | protocolo, METs, FC máx, % FC máx prevista, PA pico, duração, motivo de interrupção, alterações de ST, arritmias, conclusão |
| Holter 24h | FC média/mín/máx, pausas, ESV, ESSV, TVNS, % FA, correlação sintoma-ritmo |
| MAPA 24h | médias 24h/vigília/sono, descenso noturno, carga pressórica, variabilidade |
| Angio-TC de coronárias | escore de cálcio (Agatston), percentil, estenoses por vaso, CAD-RADS |
| Cintilografia miocárdica | isquemia (extensão/gravidade), FEVE estresse/repouso |
| RM cardíaca | FEVE, massa, realce tardio, T1/T2 |
| Cateterismo | vasos, lesões %, conduta (angioplastia/CRM/clínico), stents |
| Doppler de carótidas | EMI, placas, estenose % |

### 2.6 Alertas automáticos — a régua

Esta tabela vira código em `src/lib/clinical/cardioAlertRules.ts`. Todo limiar é
**configurável por paciente** (o cardiologista sobrepõe o padrão).

| Código | Regra padrão | Severidade | Ação no app |
|---|---|---|---|
| `pa_crise` | PAS ≥ 180 **ou** PAD ≥ 110 | crítico | tela de orientação imediata + alerta ao médico |
| `pa_alta_sustentada` | 3 medidas ≥ 140/90 em 7 dias | atenção | alerta ao médico |
| `pa_baixa` | PAS < 90 **ou** queda > 20 mmHg com sintoma | crítico | orientação + alerta |
| `fc_taqui_repouso` | FC repouso > 100 bpm por > 30 min | atenção | alerta |
| `fc_bradi` | FC repouso < 45 bpm (ou <50 com sintoma) | crítico | alerta |
| `ritmo_irregular` | H59 sinaliza irregularidade recorrente | atenção | sugere ECG/Holter |
| `peso_ic_dia` | ganho > 1,5 kg em 24 h | crítico | protocolo IC (diurético conforme prescrição) |
| `peso_ic_semana` | ganho > 2,0 kg em 7 dias | atenção | alerta |
| `spo2_baixa` | SpO₂ < 90% sustentada | crítico | alerta |
| `spo2_noturna` | ≥ 5% do sono com SpO₂ < 90% | atenção | rastrear apneia |
| `dor_toracica_repouso` | sintoma de dor em repouso > 10 min | **emergência** | tela SAMU 192, sem fila |
| `sincope` | relato de síncope | crítico | alerta imediato |
| `dispneia_piora` | subida de classe NYHA | atenção | alerta |
| `adesao_baixa` | < 80% de doses em 14 dias | atenção | alerta + nudge ao paciente |
| `sem_dados` | 10 dias sem qualquer registro | info | nudge ao paciente, sinaliza no painel |
| `ldl_fora_alvo` | LDL acima do alvo do paciente | atenção | sugere titulação |
| `k_alterado` | K⁺ < 3,5 ou > 5,5 | crítico | alerta (pós ARM/IECA) |
| `tfg_queda` | queda > 30% da TFG basal | crítico | alerta |

### 2.7 O que o médico vê no painel

1. **Fila de risco** — pacientes ordenados por semáforo, não lista alfabética.
2. **Paciente em uma tela** — alvos vs. atual, 4 gráficos (PA, FC/HRV, peso, sono/atividade),
   medicações com dose e adesão, últimos exames, sintomas do período, alertas abertos.
3. **Resumo entre consultas** — "o que aconteceu desde 12/06": média de PA, adesão, eventos,
   exames novos. É a tela que economiza os 10 minutos da consulta. **[Provável]** é o que vende.
4. **Titulação em 1 clique** — mudar dose gera prescrição, notifica o paciente, marca reavaliação.
5. **Relatório PDF** — para prontuário/convênio.

---

## 3. Reaproveitamento do Encorpei Mamãe

### Aproveitado quase intacto (≈60% da base)
`components/ui/*` (shadcn), `components/shell/*` (AppShell, cards, estados vazios),
`contexts/AuthContext` + `DevBypass` (modo demo), guardas de rota com **bloqueio de login
cruzado** (paciente ↔ médico), `ProProtectedRoute` com fluxo de aprovação do médico,
`professional_patient_links` + código de convite, chat paciente↔médico, prescrições +
check-in de adesão, alertas profissionais, área admin, auditoria (`auditLogger`), LGPD
(`consent`, `dataPrivacy`, `security.clearLocalClinicalData`), Sentry/monitor, PWA, CSP.

### Adaptado
Motor de risco (gestacional → cardiovascular), navegação e hubs, landing, onboarding,
planos/preços, tema (terracotta → azul clínico), `queryKeys`, demo data.

### Descartado
Semana gestacional, bebê 3D, chutes, contrações, DPP/DUM, puerpério, vacinas maternas,
laudos de USG obstétrico, "posso comer", mala de maternidade.

---

## 4. Pulseira H59 Max — ficha confirmada e limites reais

Atualizado em 10/09/2026 com a ficha do anúncio do fornecedor (o modelo comprado é o
**H59 Max**, não o H59 comum).

### 4.1 O que o hardware é [Certo]

| Item | Valor |
|---|---|
| MCU | Realtek **RTL8762E** |
| Bluetooth | **BLE 5.2** |
| Sensor óptico | **Vcare VC30F-S** (PPG) |
| Acelerômetro | **Sensortek STK8321-W** |
| Tela | nenhuma (*screenless*) |
| Bateria | 180 mAh · 45–50 dias de uso · 100 dias em espera · carga magnética em 1,5 h |
| Água | 1 ATM |
| App do fabricante | **QWatch PRO** (`com.qcwireless.qcwatch`) |
| Preço | US$ 11,50–12,80 · MOQ 1 |

**Só existem dois sensores neste aparelho: um PPG óptico e um acelerômetro.** Tudo o que
o produto entrega sai desses dois — não há eletrodo, não há termistor.

### 4.2 O que ele mede, estima e não faz

| Medida | Como sai | Vale clinicamente? |
|---|---|---|
| Frequência cardíaca | PPG, contínua | **Sim**, para tendência e repouso |
| SpO₂ | PPG, contínua e noturna | **Sim**, para tendência e rastreio de dessaturação |
| HRV | intervalos entre batimentos | Sim, para tendência |
| Passos, distância, calorias | acelerômetro | Sim (calorias é estimativa grosseira) |
| Sono e estágios | acelerômetro | Aproximado — actigrafia, não polissonografia |
| **Pressão arterial "24h"** | **PPG, sem manguito** | **Não.** Estimativa sem validação |
| ECG | **não existe** neste hardware | — |
| Temperatura | **não existe** | — |
| Glicemia | **não existe** | — |

**[Certo]** O anúncio vende "24h Blood Pressure" e "AI health reports". A pressão vem do
mesmo sensor óptico da frequência cardíaca, sem manguito e sem aferição — é o mesmo caso
já tratado no código: entra com `validation_status: "estimated"`, aparece rotulada, e é
proibida de disparar alerta ou entrar na média de MRPA.

### 4.3 O problema que o app QWatch PRO cria [Certo]

O app companheiro integra com o **Google Fit**, e o Google Fit **é desligado no fim de
2026** — novos desenvolvedores já não conseguem nem se cadastrar desde 01/05/2024. O
substituto é o **Health Connect**, e não há garantia de que este fabricante migre.

Traduzindo: **o caminho "deixa o app do fabricante exportar para o Google Fit e a gente
lê de lá" tem prazo de validade, e o prazo é agora.** Ele deixa de ser plano A.

Além disso, a ficha de privacidade do QWatch PRO na Play Store declara que os dados
**não são criptografados** e que o app pode compartilhar identificadores de dispositivo
com terceiros. Para dado de saúde de paciente brasileiro (LGPD art. 11), isso é um
problema de conformidade que não é nosso, mas passa a ser assim que orientarmos um
paciente a usar aquele app.

### 4.4 Os caminhos, reordenados

1. **Web Bluetooth direto no PWA — plano A.** Se o firmware expuser o serviço padrão
   Heart Rate (`0x180D`), o Encorpei lê os batimentos ao vivo sem depender de app
   nenhum. O RTL8762E suporta; se este firmware expõe, **só o teste no aparelho
   responde**. Por isso existe agora a tela de diagnóstico (`diagnosticarPulseira`).
2. **SDK do fabricante — o que destrava o resto.** Sono, SpO₂ histórico e passos vivem
   num serviço proprietário (`0xFEE7`/`0xFFF0`). Sem a documentação, o app guarda o
   pacote cru e não inventa nada. **Pedir o SDK ao fornecedor é a ação de maior
   retorno neste projeto.**
3. **Health Connect (Android)** — depende de o fabricante migrar do Google Fit. Fora do
   nosso controle.
4. **Importação de arquivo** — plano B universal, já implementado, se o app exportar.

### 4.5 O que pedir ao fornecedor, literalmente

> Please send the BLE communication protocol document and the Android/iOS SDK for the
> H59 Max (RTL8762E). We need: GATT service and characteristic UUIDs, the packet format
> for historical data (sleep, SpO2, steps, heart rate), and whether the standard Heart
> Rate Service 0x180D is enabled in this firmware.

## 5. A experiência que se vende ao cardiologista

**[Provável]** O cardiologista não compra "app para paciente". Ele compra **tempo de consulta e
segurança jurídica**. A demo tem que mostrar, nessa ordem:

1. **A fila** — "seus 40 pacientes, 3 precisam de você hoje, e o app te diz por quê."
2. **O resumo entre consultas** — "abra o paciente e leia 8 linhas em vez de perguntar."
3. **A titulação** — "mudou a dose aqui, o paciente recebe no celular dele agora."
4. **O PDF** — "isso vai para o prontuário, com data e origem de cada número."
5. **A pulseira** — última, como diferencial, com a honestidade do §4. Uma pulseira que ele
   entrega ao paciente com a marca da clínica é um argumento de retenção forte. **[Palpite]**
   Aqui pode estar a margem: hardware + assinatura.

**Modelo de negócio herdado do Mamãe:** médico paga, paciente usa de graça. No cardio isso se
sustenta melhor do que na gestação, porque o paciente é crônico — o médico paga por 24 meses de
acompanhamento, não por 9.

---

## 6. Riscos regulatórios (não são detalhe)

**[Certo]** Um software que **calcula escore de risco, gera alerta clínico e sugere conduta** é
**SaMD — software como dispositivo médico** perante a ANVISA (RDC 657/2022). Acompanhamento e
registro de dados ficam fora; **sugestão de conduta e alerta diagnóstico ficam dentro**.
O caminho prático é manter o app como **registro + comunicação + alerta que aponta para o médico**,
nunca "faça X". Todo alerta no código é redigido como *"avise seu médico"*, jamais *"aumente a dose"*.

**[Certo]** Dado de saúde é dado sensível (LGPD art. 11): consentimento específico e destacado,
registro auditável de quem viu o quê, direito de eliminação. A estrutura do Mamãe
(`consent_records`, `audit_logs`, RLS por paciente) já cobre isso e foi mantida.

---

## 7. Decisões que tomei por você (ratificar ou vetar)

1. **PA da pulseira não decide nada clinicamente** — entra como estimativa marcada. (§4)
2. **Eixo do produto = alvo/titulação**, não conteúdo semanal. (§1)
3. **Dor torácica em repouso vira tela de emergência**, não item de fila. (§2.3)
4. **Web Bluetooth agora, Health Connect depois** — PWA primeiro, app nativo quando houver
   volume que justifique. (§4)
5. **Nome/rota do portal do médico mantidos em `/pro`** para reaproveitar todo o código de
   vínculo, convite e aprovação sem reescrita.
</content>
