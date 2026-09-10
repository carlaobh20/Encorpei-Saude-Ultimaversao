/**
 * Importação de arquivo exportado pelo app que acompanha a pulseira.
 * É o plano B universal: funciona em iPhone, funciona sem SDK, funciona
 * quando o Bluetooth falha. Ver docs/MAPEAMENTO-CARDIO.md §4.
 *
 * HIPÓTESE NÃO CONFIRMADA: a ficha do aparelho veio de anúncio de fornecedor,
 * não de manual. Não sabemos qual app companheiro o paciente vai usar nem em
 * que formato ele exporta. Por isso o parser não assume cabeçalho de nenhum
 * fabricante específico: ele detecta delimitador, reconhece coluna por lista
 * de sinônimos EXATOS e, quando não tem certeza, devolve `precisaConfirmacao`
 * para a tela perguntar ao paciente qual coluna é o quê.
 *
 * Três decisões que custaram bug antes e agora estão explícitas aqui:
 *
 * 1. **Aspas.** Exportação com vírgula dentro de campo ("1.234,5", "12/03/2026,
 *    manhã") quebrava o `split(",")` e deslocava TODAS as colunas da linha —
 *    silenciosamente, gerando leitura com valor de outra coluna. Agora existe
 *    um tokenizador que respeita aspas e aspas escapadas ("").
 * 2. **Data brasileira.** `new Date("03/09/2026")` devolve 9 de março, não 3 de
 *    setembro. Um paciente que importa em setembro via a leitura cair em março.
 *    Agora dd/mm/aaaa é interpretado EXPLICITAMENTE antes de qualquer fallback,
 *    e o fallback genérico só roda em formato ISO (aaaa-mm-dd), onde não há
 *    ambiguidade.
 * 3. **Cabeçalho por `includes`.** "sono total" contém "sono", e "sono" era
 *    sinônimo de sleepMinutes — mas "sono profundo" também contém "sono", então
 *    a coluna de sono profundo era lida como sono total. Agora a comparação é
 *    de igualdade contra sinônimos normalizados, e cada coluna só pode alimentar
 *    um campo.
 */

import type { ValidationStatus } from "@/types/cardio";

export interface LinhaImportada {
  recordedAt: string;
  heartRate?: number;
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  steps?: number;
  sleepMinutes?: number;
  deepMinutes?: number;
  lightMinutes?: number;
  calories?: number;
  /**
   * Tudo que vem de PPG/acelerômetro nasce "estimated". Ver docs §4.2: o
   * aparelho não tem eletrodo nem manguito, então nenhuma linha importada tem
   * comprovação de validação clínica.
   */
  validation: ValidationStatus;
}

/** Campos que o parser sabe procurar num cabeçalho. */
export type CampoImportado = keyof Omit<LinhaImportada, "validation">;

export const CAMPO_ROTULO: Record<CampoImportado, string> = {
  recordedAt: "Data e hora",
  heartRate: "Batimentos por minuto",
  spo2: "Oxigenação do sangue",
  systolic: "Pressão — número maior",
  diastolic: "Pressão — número menor",
  steps: "Passos",
  sleepMinutes: "Sono (total)",
  deepMinutes: "Sono profundo",
  lightMinutes: "Sono leve",
  calories: "Calorias",
};

/** Uma linha de exemplo já interpretada, para a prévia antes de gravar. */
export interface ExemploLinha {
  quando: string;
  itens: { rotulo: string; valor: string }[];
}

export interface ContagemPorTipo {
  batimentos: number;
  oxigenacao: number;
  pressao: number;
  atividade: number;
  sono: number;
}

export interface ResultadoImportacao {
  linhas: LinhaImportada[];
  /** Linhas do arquivo descartadas (sem data válida ou sem nenhum valor). */
  ignoradas: number;
  /** Cabeçalhos do arquivo, na ordem — a tela usa para o mapeamento manual. */
  cabecalho: string[];
  /** Índice de coluna escolhido para cada campo (manual ou automático). */
  mapeamento: Partial<Record<CampoImportado, number>>;
  colunasReconhecidas: string[];
  colunasNaoReconhecidas: string[];
  /** Quantos registros de cada tipo sairão daqui — base da prévia. */
  contagem: ContagemPorTipo;
  /** Período coberto pelo arquivo (ISO), para a prévia. */
  periodo: { inicio: string; fim: string } | null;
  exemplos: ExemploLinha[];
  /**
   * `true` quando o parser não conseguiu reconhecer as colunas com confiança.
   * A tela NÃO grava nesse caso: pergunta ao paciente qual coluna é o quê.
   */
  precisaConfirmacao: boolean;
  avisos: string[];
}

/**
 * Sinônimos por campo — normalizados (minúsculo, sem acento, sem unidade).
 * A comparação é de IGUALDADE contra esta lista. Se um cabeçalho novo aparecer
 * no campo, ele entra aqui — de propósito: é mais barato manter uma lista do
 * que caçar por que "sono profundo" virou sono total em produção.
 */
const SINONIMOS: Record<CampoImportado, string[]> = {
  recordedAt: [
    "date", "time", "datetime", "date time", "data", "hora", "data hora",
    "data e hora", "timestamp", "measure time", "measurement time", "tempo",
    "record time", "start time",
    // "dia" fica de fora de propósito: em export de pressão ele é diastólica.
  ],
  heartRate: [
    "heart rate", "heartrate", "hr", "bpm", "avg heart rate", "average heart rate",
    "frequencia cardiaca", "frequencia", "batimentos", "batimento", "pulse",
    "pulso", "fc", "heart rate bpm",
  ],
  spo2: [
    "spo2", "sp o2", "blood oxygen", "oxygen", "oxygen saturation", "oxigenio",
    "oxigenacao", "saturacao", "saturacao de oxigenio", "o2", "spo2 %",
  ],
  systolic: [
    "systolic", "systolic bp", "sbp", "sistolica", "pressao sistolica",
    "pressao maxima", "maxima", "high pressure", "hp", "sys",
  ],
  diastolic: [
    "diastolic", "diastolic bp", "dbp", "diastolica", "pressao diastolica",
    "pressao minima", "minima", "low pressure", "lp", "dia",
  ],
  steps: ["steps", "step", "step count", "passos", "total steps", "numero de passos"],
  sleepMinutes: [
    "sleep", "total sleep", "sleep total", "total sleep time", "sleep duration",
    "sono", "sono total", "total de sono", "duracao do sono", "tempo de sono",
    "horas de sono",
  ],
  deepMinutes: ["deep sleep", "deep", "deep sleep time", "sono profundo", "profundo"],
  lightMinutes: ["light sleep", "light", "light sleep time", "sono leve", "leve"],
  calories: ["calories", "calorias", "kcal", "cal", "energy", "energia"],
};

/**
 * Ordem de resolução: campos mais específicos primeiro. Mesmo com igualdade
 * exata, isso garante que se um arquivo trouxer "deep" e "sleep" a coluna de
 * sono profundo seja consumida antes de a de sono total olhar para ela.
 */
const ORDEM_RESOLUCAO: CampoImportado[] = [
  "recordedAt", "deepMinutes", "lightMinutes", "sleepMinutes",
  "systolic", "diastolic", "spo2", "heartRate", "steps", "calories",
];

/** Faixas de plausibilidade — o que estiver fora é descartado, não gravado. */
const FAIXAS: Partial<Record<CampoImportado, [number, number]>> = {
  heartRate: [20, 260],
  spo2: [50, 100],
  systolic: [50, 300],
  diastolic: [30, 200],
  steps: [0, 200_000],
  sleepMinutes: [1, 1440],
  deepMinutes: [0, 1440],
  lightMinutes: [0, 1440],
  calories: [0, 20_000],
};

/** Campos cujo valor é duração e pode vir como "7h30", "7:30" ou "7,5". */
const CAMPOS_DURACAO: CampoImportado[] = ["sleepMinutes", "deepMinutes", "lightMinutes"];

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Unidade entre parênteses/colchetes não identifica a coluna: "sono (min)".
    .replace(/[([{][^)\]}]*[)\]}]/g, " ")
    .replace(/[_\-./\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Tokenizador CSV ──────────────────────────────────────────────────
//
// Escrito à mão em vez de trazer uma dependência: são 40 linhas, o formato é
// RFC4180 com delimitador variável, e uma lib a mais no bundle de um PWA que
// paciente de 70 anos abre no 3G custa mais do que estas 40 linhas.

/** Quebra o texto inteiro em linhas de células, respeitando aspas. */
function tokenizar(texto: string, sep: string): string[][] {
  const linhas: string[][] = [];
  let celula = "";
  let linha: string[] = [];
  let dentroDeAspas = false;

  // BOM do Excel: se ficar, o primeiro cabeçalho nunca casa com sinônimo nenhum.
  const t = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;

  for (let i = 0; i < t.length; i++) {
    const c = t[i];

    if (dentroDeAspas) {
      if (c === '"') {
        // "" dentro de campo entre aspas é uma aspa literal (RFC4180).
        if (t[i + 1] === '"') { celula += '"'; i++; }
        else dentroDeAspas = false;
      } else {
        celula += c;
      }
      continue;
    }

    if (c === '"') { dentroDeAspas = true; continue; }
    if (c === sep) { linha.push(celula); celula = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
      continue;
    }
    celula += c;
  }

  linha.push(celula);
  linhas.push(linha);

  // Linha vazia (só separadores ou espaço) não é dado.
  return linhas.filter((l) => l.some((c) => c.trim().length > 0));
}

/**
 * Detecta o delimitador contando ocorrências FORA de aspas na primeira linha
 * não vazia. Contar com aspas incluídas fazia um cabeçalho como
 * `"Pressão (sistólica, diastólica)";"FC"` parecer separado por vírgula.
 */
function detectarSeparador(texto: string): string {
  const primeira = texto.split(/\r?\n/).find((l) => l.trim().length > 0) ?? "";
  const candidatos = [",", ";", "\t"];
  let melhor = ",";
  let melhorContagem = -1;

  for (const c of candidatos) {
    let contagem = 0;
    let dentro = false;
    for (const ch of primeira) {
      if (ch === '"') dentro = !dentro;
      else if (ch === c && !dentro) contagem++;
    }
    if (contagem > melhorContagem) { melhorContagem = contagem; melhor = c; }
  }
  return melhor;
}

// ── Valores ──────────────────────────────────────────────────────────

/**
 * Número em formato brasileiro OU inglês. A heurística: se há vírgula e ponto,
 * o último a aparecer é o separador decimal. Se só há vírgula, ela é decimal
 * (é o caso do export em pt-BR). Milhar é removido.
 */
function parseNumero(v: string): number | undefined {
  if (!v) return undefined;
  const bruto = v.trim();
  if (!bruto) return undefined;

  const limpo = bruto.replace(/[^\d.,-]/g, "");
  if (!limpo || !/\d/.test(limpo)) return undefined;

  // Agrupamento de milhar sem decimal: "5.432" (pt-BR) e "5,432" (en-US) são
  // 5432 passos, não 5,432 passos. O padrão de grupos de exatamente 3 dígitos
  // desfaz a ambiguidade — ninguém exporta contagem com 3 casas decimais.
  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.split(".").join(""));
  if (/^-?\d{1,3}(,\d{3})+$/.test(limpo)) return Number(limpo.split(",").join(""));

  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  let normalizado = limpo;

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    const decimal = ultimaVirgula > ultimoPonto ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (ultimaVirgula >= 0) {
    normalizado = limpo.replace(",", ".");
  }

  const n = Number.parseFloat(normalizado);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Duração de sono. Os exports que vimos usam três formatos para a mesma coisa:
 * minutos ("450"), horas decimais ("7,5") e horas:minutos ("7:30" / "7h30m").
 * A desambiguação por magnitude é grosseira mas segura: ninguém dorme 7 minutos
 * e ninguém dorme 450 horas.
 */
function parseDuracaoMinutos(v: string): number | undefined {
  if (!v) return undefined;
  const bruto = v.trim().toLowerCase();
  if (!bruto) return undefined;

  const hm = bruto.match(/^(\d{1,2})\s*(?:h|:)\s*(\d{1,2})?\s*m?$/);
  if (hm) {
    const h = Number(hm[1]);
    const m = hm[2] ? Number(hm[2]) : 0;
    if (m > 59) return undefined;
    return h * 60 + m;
  }

  const n = parseNumero(bruto);
  if (n === undefined) return undefined;
  if (/\bh\b|hora|hour/.test(bruto)) return Math.round(n * 60);
  // ≤ 24 sem unidade: quase certamente horas.
  return n <= 24 ? Math.round(n * 60) : Math.round(n);
}

const LIMITE_ANTIGO = Date.UTC(2000, 0, 1);
/** Tolerância de relógio: pulseira e celular desencontram alguns minutos. */
const TOLERANCIA_FUTURO_MS = 10 * 60_000;

function montar(ano: number, mes: number, dia: number, h: number, min: number, seg: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const d = new Date(ano, mes - 1, dia, h, min, seg);
  // Rejeita 31/02 e afins: o Date "corrige" para 03/03 em silêncio.
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  if (t < LIMITE_ANTIGO) return null;
  if (t > Date.now() + TOLERANCIA_FUTURO_MS) return null;
  return d.toISOString();
}

/**
 * Interpreta data/hora. A ORDEM importa e é o conserto principal deste arquivo:
 *
 *   1. dd/mm/aaaa (e dd-mm-aaaa) — formato do paciente brasileiro, explícito;
 *   2. ISO com "T" ou fuso — só aqui o `Date` nativo é usado, porque só aqui
 *      ele não tem como confundir dia com mês;
 *   3. aaaa-mm-dd solto — hora local;
 *   4. epoch em segundos ou milissegundos.
 *
 * O que NÃO existe mais: fallback genérico `new Date(texto)`. Era ele que lia
 * "03/09/2026" como 9 de março.
 *
 * Datas inválidas (31/02), anteriores a 2000 ou no futuro são rejeitadas —
 * pulseira com relógio zerado exporta 01/01/1970 ou 2099 e isso ia parar no
 * gráfico do médico.
 */
export function parseData(v: string): string | null {
  if (!v) return null;
  const bruto = v.trim();
  if (!bruto) return null;

  const hora = bruto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  const h = hora ? Number(hora[1]) : 0;
  const min = hora ? Number(hora[2]) : 0;
  const seg = hora && hora[3] ? Number(hora[3]) : 0;
  const pm = /\bpm\b/i.test(bruto) && h < 12;
  const am = /\bam\b/i.test(bruto) && h === 12;
  const hFinal = pm ? h + 12 : am ? 0 : h;
  if (hFinal > 23 || min > 59 || seg > 59) return null;

  // 1. dd/mm/aaaa — brasileiro, explícito, antes de qualquer fallback.
  //
  // ANCORADO no início de propósito: sem a âncora, "2026-09-01" casava a partir
  // do terceiro caractere ("26-09-01") e virava 26 de setembro de 2001. Foi
  // assim que a versão anterior transformou data ISO em data de vinte anos atrás.
  const br = bruto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const anoBruto = Number(br[3]);
    const ano = br[3].length === 2 ? 2000 + anoBruto : anoBruto;
    // Único caso em que aceitamos mm/dd: o primeiro campo não pode ser dia.
    if (dia > 12 && mes <= 12) return montar(ano, mes, dia, hFinal, min, seg);
    if (dia <= 12 && mes > 12) return montar(ano, dia, mes, hFinal, min, seg);
    return montar(ano, mes, dia, hFinal, min, seg);
  }

  // 2. ISO completo (com "T" ou com fuso explícito): o próprio Date resolve, e
  // é o único caso em que ele não pode errar dia por mês. Precisa vir antes do
  // ISO "solto" porque só aqui o fuso do arquivo é respeitado.
  if (/^\d{4}-\d{2}-\d{2}T/.test(bruto) || /(Z|[+-]\d{2}:?\d{2})$/.test(bruto)) {
    const d = new Date(bruto);
    const t = d.getTime();
    if (Number.isNaN(t) || t < LIMITE_ANTIGO || t > Date.now() + TOLERANCIA_FUTURO_MS) return null;
    return d.toISOString();
  }

  // 3. aaaa-mm-dd sem fuso — hora local do paciente.
  const iso = bruto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return montar(Number(iso[1]), Number(iso[2]), Number(iso[3]), hFinal, min, seg);

  // 4. Epoch (alguns exports trazem só o número).
  const soDigitos = bruto.match(/^\d{10}$|^\d{13}$/);
  if (soDigitos) {
    const ms = bruto.length === 10 ? Number(bruto) * 1000 : Number(bruto);
    if (ms < LIMITE_ANTIGO || ms > Date.now() + TOLERANCIA_FUTURO_MS) return null;
    return new Date(ms).toISOString();
  }

  // Não reconhecido. `new Date(v)` genérico NÃO é chamado aqui de propósito:
  // é ele que lê "03/09/2026" como 9 de março. Melhor a linha ser contada como
  // ignorada e o paciente ver isso na prévia do que entrar com data errada.
  return null;
}

// ── Leitura do arquivo ───────────────────────────────────────────────

const fmtData = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Lê o arquivo e devolve TUDO que a tela precisa para montar a prévia —
 * inclusive quando não conseguiu reconhecer as colunas.
 *
 * @param override mapeamento manual campo → índice de coluna, vindo da tela
 *                 quando o paciente confirma qual coluna é o quê.
 */
export function importarCsv(
  texto: string,
  override?: Partial<Record<CampoImportado, number>>
): ResultadoImportacao {
  const vazio = (avisos: string[]): ResultadoImportacao => ({
    linhas: [], ignoradas: 0, cabecalho: [], mapeamento: {},
    colunasReconhecidas: [], colunasNaoReconhecidas: [],
    contagem: { batimentos: 0, oxigenacao: 0, pressao: 0, atividade: 0, sono: 0 },
    periodo: null, exemplos: [], precisaConfirmacao: false, avisos,
  });

  if (!texto || !texto.trim()) return vazio(["O arquivo está vazio."]);

  const sep = detectarSeparador(texto);
  const grade = tokenizar(texto, sep);
  if (grade.length < 2) {
    return vazio(["O arquivo não tem linhas de dados — só o cabeçalho, ou nada."]);
  }

  const cabecalhoBruto = grade[0].map((c) => c.trim());
  const cabecalho = cabecalhoBruto.map(normalizar);
  const avisos: string[] = [];

  // ── Reconhecimento de coluna: igualdade contra sinônimo, nunca `includes` ──
  const indices: Partial<Record<CampoImportado, number>> = {};
  const usadas = new Set<number>();
  const reconhecidas: string[] = [];

  // Mapeamento manual do paciente tem prioridade absoluta sobre a heurística.
  for (const campo of ORDEM_RESOLUCAO) {
    const forcado = override?.[campo];
    if (forcado !== undefined && forcado >= 0 && forcado < cabecalho.length) {
      indices[campo] = forcado;
      usadas.add(forcado);
      reconhecidas.push(`${cabecalhoBruto[forcado] || `coluna ${forcado + 1}`} → ${CAMPO_ROTULO[campo]}`);
    }
  }

  for (const campo of ORDEM_RESOLUCAO) {
    if (indices[campo] !== undefined) continue;
    const alvos = SINONIMOS[campo];
    const idx = cabecalho.findIndex((col, i) => !usadas.has(i) && col.length > 0 && alvos.includes(col));
    if (idx >= 0) {
      indices[campo] = idx;
      usadas.add(idx);
      reconhecidas.push(`${cabecalhoBruto[idx]} → ${CAMPO_ROTULO[campo]}`);
    }
  }

  const naoReconhecidas = cabecalhoBruto.filter((_, i) => !usadas.has(i) && cabecalhoBruto[i].length > 0);

  const camposDeValor = ORDEM_RESOLUCAO.filter((c) => c !== "recordedAt" && indices[c] !== undefined);
  const semData = indices.recordedAt === undefined;
  const precisaConfirmacao = semData || camposDeValor.length === 0;

  if (semData) {
    avisos.push("Não encontrei a coluna de data e hora. Confirme qual coluna é a data antes de continuar.");
  }
  if (camposDeValor.length === 0) {
    avisos.push("Não reconheci nenhuma coluna de medida neste arquivo. Confirme abaixo qual coluna é o quê.");
  }
  if (indices.systolic !== undefined || indices.diastolic !== undefined) {
    avisos.push(
      "A pressão medida pela pulseira é uma estimativa do sensor de luz, sem manguito. Ela entra marcada como estimativa: não entra na sua média de pressão e não dispara aviso."
    );
  }

  // Sem confiança, não interpretamos linha nenhuma — a tela só monta o
  // mapeamento manual. Evita mostrar prévia baseada em coluna errada.
  if (precisaConfirmacao) {
    return {
      linhas: [], ignoradas: 0, cabecalho: cabecalhoBruto, mapeamento: indices,
      colunasReconhecidas: reconhecidas, colunasNaoReconhecidas: naoReconhecidas,
      contagem: { batimentos: 0, oxigenacao: 0, pressao: 0, atividade: 0, sono: 0 },
      periodo: null, exemplos: [], precisaConfirmacao: true, avisos,
    };
  }

  const linhas: LinhaImportada[] = [];
  let ignoradas = 0;

  const valor = (cols: string[], campo: CampoImportado): number | undefined => {
    const i = indices[campo];
    if (i === undefined) return undefined;
    const cru = (cols[i] ?? "").trim();
    if (!cru) return undefined;
    const n = CAMPOS_DURACAO.includes(campo) ? parseDuracaoMinutos(cru) : parseNumero(cru);
    if (n === undefined) return undefined;
    const faixa = FAIXAS[campo];
    if (faixa && (n < faixa[0] || n > faixa[1])) return undefined;
    return campo === "spo2" ? Math.round(n) : Math.round(n);
  };

  // Garantido não-nulo: `precisaConfirmacao` já retornou acima se faltasse data.
  const idxData = indices.recordedAt as number;

  for (let i = 1; i < grade.length; i++) {
    const cols = grade[i];
    const at = parseData(cols[idxData] ?? "");
    if (!at) { ignoradas++; continue; }

    const sistolica = valor(cols, "systolic");
    const diastolica = valor(cols, "diastolic");

    const linha: LinhaImportada = {
      recordedAt: at,
      heartRate: valor(cols, "heartRate"),
      spo2: valor(cols, "spo2"),
      // Pressão só entra completa: sistólica sem diastólica não é medida.
      systolic: sistolica != null && diastolica != null ? sistolica : undefined,
      diastolic: sistolica != null && diastolica != null ? diastolica : undefined,
      steps: valor(cols, "steps"),
      sleepMinutes: valor(cols, "sleepMinutes"),
      deepMinutes: valor(cols, "deepMinutes"),
      lightMinutes: valor(cols, "lightMinutes"),
      calories: valor(cols, "calories"),
      validation: "estimated",
    };

    const temAlgo =
      linha.heartRate != null || linha.spo2 != null || linha.systolic != null ||
      linha.steps != null || linha.sleepMinutes != null || linha.calories != null;

    if (temAlgo) linhas.push(linha);
    else ignoradas++;
  }

  // ── Prévia ────────────────────────────────────────────────────────
  const contagem: ContagemPorTipo = {
    batimentos: linhas.filter((l) => l.heartRate != null).length,
    oxigenacao: linhas.filter((l) => l.spo2 != null).length,
    pressao: linhas.filter((l) => l.systolic != null && l.diastolic != null).length,
    atividade: linhas.filter((l) => l.steps != null || l.calories != null).length,
    sono: linhas.filter((l) => l.sleepMinutes != null).length,
  };

  const ordenadas = [...linhas].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const periodo = ordenadas.length > 0
    ? { inicio: ordenadas[0].recordedAt, fim: ordenadas[ordenadas.length - 1].recordedAt }
    : null;

  const exemplos: ExemploLinha[] = ordenadas.slice(0, 3).map((l) => {
    const itens: { rotulo: string; valor: string }[] = [];
    if (l.heartRate != null) itens.push({ rotulo: "Batimentos", valor: `${l.heartRate} bpm` });
    if (l.spo2 != null) itens.push({ rotulo: "Oxigenação", valor: `${l.spo2}%` });
    if (l.systolic != null && l.diastolic != null) {
      itens.push({ rotulo: "Pressão (estimativa)", valor: `${l.systolic} por ${l.diastolic}` });
    }
    if (l.steps != null) itens.push({ rotulo: "Passos", valor: `${l.steps}` });
    if (l.calories != null) itens.push({ rotulo: "Calorias", valor: `${l.calories}` });
    if (l.sleepMinutes != null) {
      const hh = Math.floor(l.sleepMinutes / 60);
      const mm = l.sleepMinutes % 60;
      itens.push({ rotulo: "Sono", valor: `${hh}h${String(mm).padStart(2, "0")}` });
    }
    return { quando: fmtData(l.recordedAt), itens };
  });

  if (linhas.length === 0 && ignoradas > 0) {
    avisos.push("Nenhuma linha pôde ser lida. Confira se a coluna de data está no formato dia/mês/ano.");
  }

  return {
    linhas, ignoradas, cabecalho: cabecalhoBruto, mapeamento: indices,
    colunasReconhecidas: reconhecidas, colunasNaoReconhecidas: naoReconhecidas,
    contagem, periodo, exemplos, precisaConfirmacao: false, avisos,
  };
}
