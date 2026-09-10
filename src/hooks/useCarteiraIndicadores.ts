/**
 * INDICADORES DA CARTEIRA — agregação em memória para a fila do médico.
 *
 * Este arquivo não faz consulta: ele recebe as linhas cruas que
 * `useProfessionalPatients` traz em ~5 consultas agregadas e devolve, por
 * paciente, o que a fila precisa responder — quem precisa de avaliação, por
 * quê, e qual foi a última informação confiável.
 *
 * Por que funções puras num arquivo separado:
 *
 * 1. A regra "nunca uma query por paciente dentro de um .map()" só se sustenta
 *    se a agregação for burra e sem efeitos colaterais. Uma vez que a agregação
 *    vira função pura sobre arrays, é fisicamente impossível alguém enfiar um
 *    `await supabase...` no meio dela sem perceber. Já quebramos esta tela com
 *    N+1 (um componente-sonda por paciente, ~4 consultas cada); a separação é a
 *    cerca que impede a recaída.
 * 2. O modo demo e o caminho real passam pelas MESMAS funções de formatação e
 *    classificação. Se o demo tivesse a sua própria lógica de rótulo, ele
 *    contaria uma história diferente da que o banco conta — que é exatamente o
 *    defeito que a auditoria apontou.
 *
 * Vocabulário do arquivo: "indicador" é sempre {valor, n, período, origem}.
 * Número sem n e sem período é número sem procedência, e nesta tela isso não
 * existe — o médico precisa saber se "132/81" veio de 12 medidas de manguito
 * em 30 dias ou de duas aferições soltas.
 */

import type { RiskLevel } from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DIA = 86_400_000;

// ── Janelas ──────────────────────────────────────────────────────────
// Cada janela é uma decisão clínica, não um número redondo:

/** Média de PA / FC / peso: 30 dias é a janela de MRPA ampliada que o
 *  cardiologista usa entre consultas. Menos que isso e a média oscila com
 *  qualquer dia ruim; mais que isso e ela esconde uma piora recente. */
export const DIAS_JANELA_MEDIDAS = 30;

/** Adesão: 14 dias. É o mesmo horizonte da regra `adesao_baixa` em
 *  `cardioAlertRules`; usar outro aqui faria o cartão discordar do alerta. */
export const DIAS_ADESAO = 14;

/** "Sem dados recentes": 7 dias sem NENHUMA medida de NENHUM tipo.
 *  Sete dias porque o combinado com o paciente é medir ao menos 2× por semana;
 *  uma semana inteira em silêncio já é quebra de combinado, não variação. */
export const DIAS_SEM_DADOS = 7;

/** Mínimo de medidas para publicar uma média. Abaixo disso escrevemos
 *  "sem medidas suficientes" — nunca um traço, que o leitor confunde com zero
 *  ou com "está tudo bem". Três é o piso da MRPA de 7 dias do motor de risco. */
const MIN_MEDIDAS_MEDIA = 3;

// ── Origem do dado ───────────────────────────────────────────────────

export type OrigemMedida = "digitado" | "aparelho" | "importado" | "laboratorio" | "sistema" | "estimativa";

export const ROTULO_ORIGEM: Record<OrigemMedida, string> = {
  digitado: "digitado",
  aparelho: "aparelho",
  importado: "importado",
  laboratorio: "laboratório",
  sistema: "sistema",
  estimativa: "estimativa de pulseira",
};

/**
 * Traduz proveniência do banco para o vocabulário da tela.
 *
 * `validation_status === "estimated"` domina o `source_type`: uma PA por PPG de
 * pulseira é "estimativa", não "aparelho", porque o médico precisa enxergar de
 * longe que aquele número não titula remédio (contrato §2).
 */
export function origemDaLinha(sourceType?: string | null, validationStatus?: string | null): OrigemMedida {
  if (validationStatus === "estimated") return "estimativa";
  switch (sourceType) {
    case "device": return "aparelho";
    case "import": return "importado";
    case "lab": return "laboratorio";
    case "system": return "sistema";
    default: return "digitado";
  }
}

// ── Indicador ────────────────────────────────────────────────────────

/**
 * Um número da carteira, com tudo que o torna interpretável.
 *
 * `valor: null` significa "não há base para publicar um número" — a tela
 * escreve "sem medidas suficientes". `n` continua preenchido nesse caso, para
 * a tela poder dizer *quão* insuficiente ("n=1 em 30 dias").
 */
export interface IndicadorAgregado {
  /** Já formatado para leitura ("132/81", "68 bpm", "84,3 kg"). */
  valor: string | null;
  /** Quantas medidas compõem o valor. */
  n: number;
  periodoDias: number;
  /** Origens presentes na janela, da mais frequente para a menos. */
  origens: OrigemMedida[];
  /** Medida mais recente que entrou no cálculo. */
  ultimaEm: string | null;
  /**
   * Leituras descartadas por serem estimativa de pulseira. Não é detalhe de
   * implementação: o médico que vê "sem medidas suficientes" num paciente que
   * mede todo dia pela pulseira precisa entender que o dado existe e foi
   * deliberadamente excluído da MRPA.
   */
  descartadasEstimativa?: number;
}

const INDICADOR_VAZIO: IndicadorAgregado = {
  valor: null, n: 0, periodoDias: DIAS_JANELA_MEDIDAS, origens: [], ultimaEm: null,
};

/** Adesão é AUTORRELATADA: o paciente marca a dose no app, ninguém confere. */
export interface AdesaoAutorrelatada {
  /** 0..1, ou null quando não há doses esperadas no período. */
  percentual: number | null;
  dosesMarcadas: number;
  dosesEsperadas: number;
  periodoDias: number;
}

const ADESAO_VAZIA: AdesaoAutorrelatada = {
  percentual: null, dosesMarcadas: 0, dosesEsperadas: 0, periodoDias: DIAS_ADESAO,
};

// ── Estado na fila ───────────────────────────────────────────────────

/**
 * O estado é o que a fila responde primeiro. Note que `sem_dados_recentes` é
 * um estado próprio, e não um sub-caso de "estável".
 *
 * A auditoria pegou exatamente isso: paciente sem alerta aparecia verde. Mas o
 * motor de risco só sabe alertar sobre número que chegou — silêncio nunca gera
 * alerta, então silêncio virava "estável". Um paciente que parou de medir
 * porque foi internado, porque piorou, ou porque desistiu do tratamento é o
 * caso que mais precisa de telefonema, e era o único que a tela escondia.
 */
export type EstadoFila = "prioridade" | "atencao" | "sem_dados_recentes" | "estavel" | "convite_pendente";

export const LABEL_ESTADO: Record<EstadoFila, string> = {
  prioridade: "Prioridade",
  atencao: "Atenção",
  sem_dados_recentes: "Sem dados recentes",
  estavel: "Estável",
  convite_pendente: "Convite pendente",
};

/**
 * Classes de cor por estado.
 *
 * `sem_dados_recentes` usa cinza-âmbar tracejado, não vermelho e não verde: não
 * é gravidade clínica medida (seria mentira dizer que o paciente está mal), mas
 * também não é tranquilidade (seria mentira dizer que está bem). Ausência de
 * informação tem que *parecer* ausência de informação.
 */
export const TOM_ESTADO: Record<EstadoFila, { badge: string; borda: string; ponto: string }> = {
  prioridade:         { badge: "bg-error-bg text-error",             borda: "border-l-error",                      ponto: "bg-error" },
  atencao:            { badge: "bg-warning-bg text-warning",         borda: "border-l-warning",                    ponto: "bg-warning" },
  sem_dados_recentes: { badge: "bg-muted text-muted-foreground",     borda: "border-l-muted-foreground border-dashed", ponto: "bg-muted-foreground" },
  estavel:            { badge: "bg-success-bg text-success",         borda: "border-l-success",                    ponto: "bg-success" },
  convite_pendente:   { badge: "bg-secondary text-muted-foreground", borda: "border-l-border",                     ponto: "bg-muted-foreground" },
};

// ── Agregado por paciente ────────────────────────────────────────────

export interface AgregadoPaciente {
  /** Média de PA só com manguito validado (estimativa de pulseira fora). */
  pa: IndicadorAgregado;
  fcRepouso: IndicadorAgregado;
  peso: IndicadorAgregado;
  adesao: AdesaoAutorrelatada;
  /** Momento da medida mais recente de QUALQUER tipo — a régua do silêncio. */
  ultimaMedidaEm: string | null;
  /** "Pressão", "Batimentos", "Peso" — o que foi a última coisa que chegou. */
  ultimaMedidaTipo: string | null;
  ultimaMedidaOrigem: OrigemMedida | null;
}

export const AGREGADO_VAZIO: AgregadoPaciente = {
  pa: INDICADOR_VAZIO,
  fcRepouso: INDICADOR_VAZIO,
  peso: INDICADOR_VAZIO,
  adesao: ADESAO_VAZIA,
  ultimaMedidaEm: null,
  ultimaMedidaTipo: null,
  ultimaMedidaOrigem: null,
};

/** Formato cru das linhas — deliberadamente frouxo: vem de `supabase as any`. */
export interface LinhasAgregacao {
  bp: any[];
  hr: any[];
  weight: any[];
  intakes: any[];
  medications: any[];
}

/** Acumulador interno; nunca sai daqui. */
interface Balde {
  soma: number;
  soma2: number;
  n: number;
  ultima: number;
  ultimoValor: number;
  origens: Map<OrigemMedida, number>;
  descartadas: number;
}

function novoBalde(): Balde {
  return { soma: 0, soma2: 0, n: 0, ultima: 0, ultimoValor: 0, origens: new Map(), descartadas: 0 };
}

function registrar(b: Balde, valor: number, valor2: number, quando: number, origem: OrigemMedida) {
  b.soma += valor;
  b.soma2 += valor2;
  b.n += 1;
  b.origens.set(origem, (b.origens.get(origem) ?? 0) + 1);
  if (quando >= b.ultima) { b.ultima = quando; b.ultimoValor = valor; }
}

function origensOrdenadas(b: Balde): OrigemMedida[] {
  return [...b.origens.entries()].sort((a, c) => c[1] - a[1]).map(([o]) => o);
}

function fecharIndicador(b: Balde, formatar: (b: Balde) => string): IndicadorAgregado {
  return {
    valor: b.n >= MIN_MEDIDAS_MEDIA ? formatar(b) : null,
    n: b.n,
    periodoDias: DIAS_JANELA_MEDIDAS,
    origens: origensOrdenadas(b),
    ultimaEm: b.ultima > 0 ? new Date(b.ultima).toISOString() : null,
    descartadasEstimativa: b.descartadas,
  };
}

/**
 * Agrega TUDO em uma passada por tabela.
 *
 * Custo: O(linhas), com as linhas já filtradas por janela na consulta. Nenhuma
 * chamada de rede aqui — se um dia aparecer uma, é bug.
 */
export function agregarCarteira(ids: string[], linhas: LinhasAgregacao, agora = Date.now()): Map<string, AgregadoPaciente> {
  const corteMedidas = agora - DIAS_JANELA_MEDIDAS * DIA;

  const baldesPa = new Map<string, Balde>();
  const baldesFc = new Map<string, Balde>();
  const baldesPeso = new Map<string, Balde>();

  const pegar = (m: Map<string, Balde>, id: string) => {
    let b = m.get(id);
    if (!b) { b = novoBalde(); m.set(id, b); }
    return b;
  };

  // ── Pressão ────────────────────────────────────────────────────────
  // Duas exclusões, ambas do contrato §2 / docs §4:
  //  · `cuff_validated = false` → aferição sem manguito validado;
  //  · `validation_status ≠ 'validated'` → estimativa de PPG, suspeita ou
  //    rejeitada pelo profissional.
  // Somar estimativa de pulseira com manguito num mesmo número seria produzir
  // uma MRPA falsa — e MRPA falsa titula anti-hipertensivo errado. Contamos as
  // descartadas para poder dizer isso na tela em vez de calar.
  for (const r of linhas.bp ?? []) {
    const t = +new Date(r.recorded_at);
    if (!Number.isFinite(t) || t < corteMedidas) continue;
    const b = pegar(baldesPa, r.patient_user_id);
    if (!r.cuff_validated || r.validation_status !== "validated") {
      b.descartadas += 1;
      // Ainda conta como sinal de vida do paciente (ver `ultimaMedidaEm`),
      // só não entra na média.
      continue;
    }
    registrar(b, r.systolic, r.diastolic, t, origemDaLinha(r.source_type, r.validation_status));
  }

  // ── FC de repouso ──────────────────────────────────────────────────
  // Só `context = 'resting'`: misturar FC de caminhada com FC de repouso
  // produziria uma média que não significa nada clinicamente. O filtro já vai
  // na consulta; aqui é cinto e suspensório porque a coluna aceita null.
  for (const r of linhas.hr ?? []) {
    const t = +new Date(r.recorded_at);
    if (!Number.isFinite(t) || t < corteMedidas) continue;
    if (r.context !== "resting") continue;
    registrar(pegar(baldesFc, r.patient_user_id), r.bpm, 0, t, origemDaLinha(r.source_type, r.validation_status));
  }

  // ── Peso ───────────────────────────────────────────────────────────
  for (const r of linhas.weight ?? []) {
    const t = +new Date(r.recorded_at);
    if (!Number.isFinite(t) || t < corteMedidas) continue;
    registrar(pegar(baldesPeso, r.patient_user_id), Number(r.value), 0, t, origemDaLinha(r.source_type, r.validation_status));
  }

  // ── Adesão autorrelatada ───────────────────────────────────────────
  // Numerador: doses efetivamente marcadas como tomadas nos últimos 14 dias.
  // Denominador: doses ESPERADAS pelo esquema prescrito, não o número de linhas
  // em `medication_intakes`. A diferença é o defeito clássico: a linha só nasce
  // quando o paciente interage, então "marcadas / linhas existentes" dá ~100%
  // justamente para quem abandonou o app. O denominador tem que vir da
  // prescrição para que abandono apareça como adesão baixa.
  const inicioAdesao = new Date(agora - (DIAS_ADESAO - 1) * DIA);
  const inicioAdesaoISO = inicioAdesao.toISOString().slice(0, 10);

  const marcadasPor = new Map<string, number>();
  for (const r of linhas.intakes ?? []) {
    if (!r.taken) continue;
    if (typeof r.intake_date === "string" && r.intake_date < inicioAdesaoISO) continue;
    marcadasPor.set(r.patient_user_id, (marcadasPor.get(r.patient_user_id) ?? 0) + 1);
  }

  const esperadasPor = new Map<string, number>();
  for (const m of linhas.medications ?? []) {
    const horarios: string[] = Array.isArray(m.schedule) ? m.schedule : [];
    if (horarios.length === 0) continue;
    // Só conta os dias em que a medicação já existia e ainda não fora suspensa:
    // cobrar dose de remédio prescrito ontem puniria o paciente pelo calendário.
    const inicioMed = m.started_at ? +new Date(m.started_at) : -Infinity;
    const fimMed = m.suspended_at ? +new Date(m.suspended_at) : Infinity;
    const de = Math.max(+inicioAdesao, inicioMed);
    const ate = Math.min(agora, fimMed);
    // `started_at` malformado vira NaN e contaminaria o denominador da carteira
    // inteira — melhor ignorar a medicação do que inventar doses esperadas.
    if (!Number.isFinite(de) || !Number.isFinite(ate)) continue;
    const dias = Math.min(DIAS_ADESAO, Math.max(0, Math.floor((ate - de) / DIA) + 1));
    if (dias <= 0) continue;
    esperadasPor.set(m.patient_user_id, (esperadasPor.get(m.patient_user_id) ?? 0) + dias * horarios.length);
  }

  // ── Fechamento ─────────────────────────────────────────────────────
  const saida = new Map<string, AgregadoPaciente>();
  for (const id of ids) {
    const bPa = baldesPa.get(id) ?? novoBalde();
    const bFc = baldesFc.get(id) ?? novoBalde();
    const bPeso = baldesPeso.get(id) ?? novoBalde();

    const pa = fecharIndicador(bPa, (b) => `${Math.round(b.soma / b.n)}/${Math.round(b.soma2 / b.n)}`);
    const fc = fecharIndicador(bFc, (b) => `${Math.round(b.soma / b.n)} bpm`);
    // Peso publica o ÚLTIMO valor, não a média: em insuficiência cardíaca o que
    // importa é o peso de hoje contra o peso seco, e média de 30 dias apagaria
    // justamente o ganho de 2 kg em 3 dias que é o sinal de descompensação.
    const peso: IndicadorAgregado = {
      ...fecharIndicador(bPeso, (b) => `${b.ultimoValor.toFixed(1).replace(".", ",")} kg`),
      // Um peso isolado já é informação útil (diferente de uma média de 1 medida).
      valor: bPeso.n > 0 ? `${bPeso.ultimoValor.toFixed(1).replace(".", ",")} kg` : null,
    };

    const esperadas = esperadasPor.get(id) ?? 0;
    const marcadas = marcadasPor.get(id) ?? 0;
    const adesao: AdesaoAutorrelatada = {
      // `min(1, …)` porque doses marcadas fora do horário previsto podem, em
      // borda de fuso, estourar o denominador; 112% de adesão é ruído, não dado.
      percentual: esperadas > 0 ? Math.min(1, marcadas / esperadas) : null,
      dosesMarcadas: marcadas,
      dosesEsperadas: esperadas,
      periodoDias: DIAS_ADESAO,
    };

    // Última informação de qualquer tipo — inclusive a PA estimada que ficou
    // fora da média. Para responder "o paciente sumiu?", estimativa de pulseira
    // conta: é sinal de vida, mesmo não sendo base de decisão clínica.
    const candidatos: Array<{ t: number; tipo: string; balde: Balde }> = [
      { t: bPa.ultima, tipo: "Pressão", balde: bPa },
      { t: bFc.ultima, tipo: "Batimentos", balde: bFc },
      { t: bPeso.ultima, tipo: "Peso", balde: bPeso },
    ].filter((c) => c.t > 0);
    const ultimo = candidatos.sort((a, b) => b.t - a.t)[0] ?? null;

    saida.set(id, {
      pa, fcRepouso: fc, peso, adesao,
      ultimaMedidaEm: ultimo ? new Date(ultimo.t).toISOString() : null,
      ultimaMedidaTipo: ultimo?.tipo ?? null,
      ultimaMedidaOrigem: ultimo ? origensOrdenadas(ultimo.balde)[0] ?? null : null,
    });
  }
  return saida;
}

// ── Classificação da fila ────────────────────────────────────────────

/**
 * Ordem de precedência deliberada:
 *
 * 1. `convite_pendente` — não é paciente ainda, é convite.
 * 2. `prioridade` (risco vermelho) VEM ANTES de `sem_dados_recentes`. Um alerta
 *    crítico aberto tem que aparecer como crítico mesmo que o paciente tenha
 *    parado de medir depois — a última coisa que sabemos dele é grave.
 * 3. `sem_dados_recentes` VEM ANTES de `atencao` e de `estavel`. Silêncio ganha
 *    de "amarelo por alerta antigo", porque o amarelo tem número por trás e o
 *    silêncio não tem nada: é o caso onde o médico está mais cego.
 */
export function classificarEstado(input: {
  status: "active" | "pending";
  risk: RiskLevel;
  ultimaMedidaEm: string | null;
  agora?: number;
}): EstadoFila {
  if (input.status === "pending") return "convite_pendente";
  if (input.risk === "red") return "prioridade";
  const agora = input.agora ?? Date.now();
  const t = input.ultimaMedidaEm ? +new Date(input.ultimaMedidaEm) : NaN;
  if (!Number.isFinite(t) || agora - t > DIAS_SEM_DADOS * DIA) return "sem_dados_recentes";
  return input.risk === "yellow" ? "atencao" : "estavel";
}

/** Dias inteiros desde a última medida; null quando nunca houve medida. */
export function diasEmSilencio(ultimaMedidaEm: string | null, agora = Date.now()): number | null {
  if (!ultimaMedidaEm) return null;
  const t = +new Date(ultimaMedidaEm);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((agora - t) / DIA));
}

/**
 * O "por quê" da fila, em uma frase.
 *
 * Nunca prescreve conduta (contrato, regra 1): descreve o achado e, no máximo,
 * sugere contato. "Ligar para confirmar" é ato administrativo do consultório,
 * não conduta terapêutica.
 */
export function motivoDaFila(input: {
  estado: EstadoFila;
  headlineAlerta: string | null;
  ultimaMedidaEm: string | null;
  agora?: number;
}): string {
  const agora = input.agora ?? Date.now();
  switch (input.estado) {
    case "convite_pendente":
      return "Aguardando o paciente aceitar o convite.";
    case "sem_dados_recentes": {
      const d = diasEmSilencio(input.ultimaMedidaEm, agora);
      return d == null
        ? "Nenhuma medida registrada desde o vínculo — confirmar se o app foi configurado."
        : `Nenhuma medida de nenhum tipo há ${d} dias — silêncio não é sinal de estabilidade.`;
    }
    case "prioridade":
    case "atencao":
      return input.headlineAlerta || "Alerta aberto sem descrição.";
    default:
      return "Sem alertas abertos e com medidas dentro da janela de acompanhamento.";
  }
}

// ── Formatação para a tela ───────────────────────────────────────────

/** O valor, ou a frase honesta. Nunca um traço: traço é ambíguo. */
export function textoIndicador(ind: IndicadorAgregado): string {
  return ind.valor ?? "sem medidas suficientes";
}

/**
 * A linha fina embaixo do número: n, período e origem.
 *
 * Sem isso, "PA 132/81" é uma afirmação sem procedência — pode ser 12 medidas
 * de manguito em 30 dias ou 3 aferições de consultório. O médico decide
 * diferente em cada caso, então a tela é obrigada a dizer qual é.
 */
export function legendaIndicador(ind: IndicadorAgregado): string {
  const partes = [`n=${ind.n}`, `${ind.periodoDias} dias`];
  if (ind.origens.length > 0) partes.push(ind.origens.map((o) => ROTULO_ORIGEM[o]).join(" + "));
  if (ind.descartadasEstimativa) partes.push(`${ind.descartadasEstimativa} estimativa(s) fora da média`);
  return partes.join(" · ");
}

/**
 * Adesão SEMPRE sai rotulada como autorrelatada.
 *
 * Chamar de "adesão" seca é atribuir ao número uma certeza que ele não tem:
 * ninguém verifica se o comprimido foi engolido. O médico que lê "74%" sem o
 * rótulo pode reduzir dose achando que o paciente toma tudo — e o dado é só
 * "o paciente disse que tomou 74%".
 */
export function textoAdesao(a: AdesaoAutorrelatada): string {
  if (a.percentual == null) return "sem doses esperadas no período";
  return `${Math.round(a.percentual * 100)}% autorrelatada`;
}

export function legendaAdesao(a: AdesaoAutorrelatada): string {
  if (a.dosesEsperadas === 0) return `nenhuma medicação ativa nos últimos ${a.periodoDias} dias`;
  return `${a.dosesMarcadas} de ${a.dosesEsperadas} doses · ${a.periodoDias} dias · marcado pelo paciente`;
}

/** "há 3 dias" / "ontem" / "sem registro". Usado em fila, tabela e alertas. */
export function tempoRelativo(iso: string | null): string {
  if (!iso) return "sem registro";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

/** A resposta a "qual foi a última informação confiável?", já pronta. */
export function ultimaInformacao(ag: AgregadoPaciente): string {
  if (!ag.ultimaMedidaEm) return "Nenhuma medida registrada.";
  const origem = ag.ultimaMedidaOrigem ? ` · ${ROTULO_ORIGEM[ag.ultimaMedidaOrigem]}` : "";
  return `${ag.ultimaMedidaTipo ?? "Medida"} ${tempoRelativo(ag.ultimaMedidaEm)}${origem}`;
}

// ── Demo ─────────────────────────────────────────────────────────────

/**
 * Constrói o mesmo `AgregadoPaciente` a partir da linha resumida do demo.
 *
 * Por que derivar em vez de gravar os campos em `demoData.ts`: os números do
 * demo (média de PA, FC, adesão, data da última leitura) já existem lá e já
 * contam a história certa — inclusive uma paciente sem medida há 11 dias, que
 * cai sozinha em `sem_dados_recentes` pela MESMA função de classificação do
 * caminho real. Duplicar n/período/origem no arquivo de demo criaria dois
 * lugares para a mesma verdade e a chance de o demo mentir. O que falta aqui é
 * só a procedência, que reconstruímos de forma determinística.
 */
export function agregadoDemo(row: {
  patient_user_id: string;
  bpAvg: string;
  restingHr: number;
  adherence: number;
  lastReadingAt: string;
}): AgregadoPaciente {
  // n determinístico por paciente: o demo tem que ser idêntico a cada abertura,
  // senão quem está avaliando o produto vê números dançando entre reloads.
  const semente = row.patient_user_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const nPa = 8 + (semente % 9);
  const nFc = 12 + (semente % 7);
  const esperadas = 14 * 2 * 2; // 2 medicações × 2 tomadas/dia × 14 dias
  const marcadas = Math.round(esperadas * row.adherence);

  const silencioso = Date.now() - +new Date(row.lastReadingAt) > DIAS_SEM_DADOS * DIA;

  return {
    pa: {
      valor: row.bpAvg, n: nPa, periodoDias: DIAS_JANELA_MEDIDAS,
      origens: ["digitado"], ultimaEm: row.lastReadingAt,
      // Um paciente do demo mede também pela pulseira: é o caso que prova, na
      // demonstração, que estimativa fica de fora da MRPA.
      descartadasEstimativa: semente % 3 === 0 ? 4 : 0,
    },
    fcRepouso: {
      valor: `${row.restingHr} bpm`, n: nFc, periodoDias: DIAS_JANELA_MEDIDAS,
      origens: ["aparelho"], ultimaEm: row.lastReadingAt,
    },
    peso: {
      valor: `${(78 + (semente % 12)).toFixed(1).replace(".", ",")} kg`,
      n: silencioso ? 0 : 14, periodoDias: DIAS_JANELA_MEDIDAS,
      origens: silencioso ? [] : ["digitado"], ultimaEm: silencioso ? null : row.lastReadingAt,
    },
    adesao: {
      percentual: row.adherence, dosesMarcadas: marcadas,
      dosesEsperadas: esperadas, periodoDias: DIAS_ADESAO,
    },
    ultimaMedidaEm: row.lastReadingAt,
    ultimaMedidaTipo: "Pressão",
    ultimaMedidaOrigem: "digitado",
  };
}
