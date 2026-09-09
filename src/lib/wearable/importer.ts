/**
 * Importação de arquivo exportado pelo app da pulseira (Wearfit / FitCloudPro
 * / H Band). É o plano B universal: funciona em iPhone, funciona sem SDK,
 * funciona quando o Bluetooth falha. Ver docs/MAPEAMENTO-CARDIO.md §4.
 *
 * O parser é tolerante de propósito: cada lote de pulseira exporta com nomes
 * de coluna diferentes, então mapeamos por sinônimo em vez de exigir um
 * cabeçalho exato.
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
  /** PA de pulseira nasce "estimated"; o resto é medida de sensor. */
  validation: ValidationStatus;
}

export interface ResultadoImportacao {
  linhas: LinhaImportada[];
  ignoradas: number;
  colunasReconhecidas: string[];
  avisos: string[];
}

/** Sinônimos por campo — minúsculos, sem acento. */
const SINONIMOS: Record<keyof Omit<LinhaImportada, "validation">, string[]> = {
  recordedAt: ["date", "time", "datetime", "data", "hora", "data/hora", "timestamp", "measure time", "tempo"],
  heartRate: ["heart rate", "heartrate", "hr", "bpm", "frequencia cardiaca", "batimentos", "pulse", "pulso"],
  spo2: ["spo2", "blood oxygen", "oxygen", "oxigenio", "saturacao", "o2"],
  systolic: ["systolic", "sbp", "sistolica", "pressao sistolica", "high pressure", "hp"],
  diastolic: ["diastolic", "dbp", "diastolica", "pressao diastolica", "low pressure", "lp"],
  steps: ["steps", "step", "passos", "step count"],
  sleepMinutes: ["sleep", "total sleep", "sono", "sono total", "sleep duration", "duracao do sono"],
  deepMinutes: ["deep sleep", "deep", "sono profundo", "profundo"],
  lightMinutes: ["light sleep", "light", "sono leve", "leve"],
  calories: ["calories", "calorias", "kcal", "cal"],
};

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function detectarSeparador(linha: string): string {
  const candidatos = [",", ";", "\t"];
  return candidatos.reduce((melhor, c) =>
    linha.split(c).length > linha.split(melhor).length ? c : melhor
  , ",");
}

function parseNumero(v: string): number | undefined {
  if (!v) return undefined;
  const limpo = v.replace(/[^\d.,-]/g, "").replace(",", ".");
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : undefined;
}

/** Aceita "2026-09-01 08:30", "01/09/2026 08:30", "09/01/2026 8:30 AM". */
function parseData(v: string): string | null {
  if (!v) return null;
  const direto = new Date(v);
  if (!Number.isNaN(direto.getTime())) return direto.toISOString();

  const m = v.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})[\s,]*(\d{1,2}):(\d{2})?/);
  if (m) {
    const [, a, b, c, h, min] = m;
    const ano = c.length === 2 ? 2000 + Number(c) : Number(c);
    // Formato brasileiro (dd/mm) é o padrão; se o primeiro campo > 12, é dia.
    const dia = Number(a) > 12 ? Number(a) : Number(a);
    const mes = Number(b);
    const d = new Date(ano, mes - 1, dia, Number(h ?? 0), Number(min ?? 0));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export function importarCsv(texto: string): ResultadoImportacao {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const avisos: string[] = [];
  if (linhas.length < 2) {
    return { linhas: [], ignoradas: 0, colunasReconhecidas: [], avisos: ["Arquivo vazio ou sem dados."] };
  }

  const sep = detectarSeparador(linhas[0]);
  const cabecalho = linhas[0].split(sep).map(normalizar);

  const indices: Partial<Record<keyof typeof SINONIMOS, number>> = {};
  const reconhecidas: string[] = [];

  (Object.keys(SINONIMOS) as (keyof typeof SINONIMOS)[]).forEach((campo) => {
    const idx = cabecalho.findIndex((col) =>
      SINONIMOS[campo].some((s) => col === s || col.includes(s))
    );
    if (idx >= 0) {
      indices[campo] = idx;
      reconhecidas.push(`${cabecalho[idx]} → ${campo}`);
    }
  });

  if (indices.recordedAt === undefined) {
    avisos.push("Nenhuma coluna de data/hora reconhecida — as linhas serão datadas pela importação.");
  }
  if (indices.systolic !== undefined) {
    avisos.push(
      "A pressão vinda da pulseira é estimativa por sensor óptico. Ela entra marcada como estimativa e não é usada para alerta nem para média de MRPA."
    );
  }

  const resultado: LinhaImportada[] = [];
  let ignoradas = 0;
  const agora = new Date().toISOString();

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep);
    const at = indices.recordedAt !== undefined ? parseData(cols[indices.recordedAt] ?? "") : agora;
    if (!at) { ignoradas++; continue; }

    const get = (campo: keyof typeof SINONIMOS) =>
      indices[campo] !== undefined ? parseNumero(cols[indices[campo]!] ?? "") : undefined;

    const linha: LinhaImportada = {
      recordedAt: at,
      heartRate: get("heartRate"),
      spo2: get("spo2"),
      systolic: get("systolic"),
      diastolic: get("diastolic"),
      steps: get("steps"),
      sleepMinutes: get("sleepMinutes"),
      deepMinutes: get("deepMinutes"),
      lightMinutes: get("lightMinutes"),
      calories: get("calories"),
      validation: "estimated",
    };

    const temAlgo =
      linha.heartRate != null || linha.spo2 != null || linha.systolic != null ||
      linha.steps != null || linha.sleepMinutes != null;

    if (temAlgo) resultado.push(linha);
    else ignoradas++;
  }

  return { linhas: resultado, ignoradas, colunasReconhecidas: reconhecidas, avisos };
}
