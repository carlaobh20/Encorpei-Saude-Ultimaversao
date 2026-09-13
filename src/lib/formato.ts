/**
 * ══════════════════════════════════════════════════════════════════════
 * FORMATO — como este app escreve número, duração, data e hora em pt-BR
 * ══════════════════════════════════════════════════════════════════════
 *
 * Existe por causa de um achado da auditoria de setembro/2026: a mesma tela
 * mostrava "85.2 kg" e, dois centímetros abaixo, o campo de digitar com
 * marcador "78,5". "5.9 %" ao lado de "Referência: < 5,7". "1.18 mg/dL" ao
 * lado de "0,7–1,3". O paciente de 68 anos não conclui que é a mesma notação
 * escrita de dois jeitos — ele conclui que o app aceita ponto, digita 78.5,
 * e o campo recusa (ou pior, aceita e grava outra coisa).
 *
 * A causa é sempre a mesma linha: `valor.toFixed(1)`. `toFixed` é notação de
 * máquina — devolve ponto decimal em qualquer idioma. Todo número que o
 * paciente LÊ passa por aqui; nenhum número que o app CALCULA passa.
 *
 * Duas regras que este módulo carrega e que não são estética:
 *
 *  1. **Duração não se escreve como hora do dia.** O histórico de caminhada
 *     mostrava "24:34 · 12/09", e 24:34 não existe no relógio — era 24 min
 *     34 s. `duracaoCurta` escreve a unidade por extenso justamente para que
 *     não haja leitura alternativa.
 *
 *  2. **Ausência não é zero.** Nenhuma função aqui inventa "0" para
 *     `null`/`NaN`: devolvem `null`, e quem chama decide a frase ("sem
 *     registro"). Trocar ausência por zero é mentir com aparência de dado.
 *
 * Nada aqui interpreta clínica. É tradução de número em texto, só isso.
 */

const LOCALE = "pt-BR";

function valido(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

// ── Números ───────────────────────────────────────────────────────────

/**
 * "85,2" · "1.450" · "7,5".
 *
 * `casas` fixa as decimais (como `toFixed`, mas com vírgula e com separador
 * de milhar); sem `casas`, mostra até 1 decimal e omite o ",0" — que é o que
 * o paciente espera ver em "6.000 passos" e não "6.000,0 passos".
 */
export function numero(valor: number | null | undefined, casas?: number): string | null {
  if (!valido(valor)) return null;
  return valor.toLocaleString(LOCALE, {
    minimumFractionDigits: casas ?? 0,
    maximumFractionDigits: casas ?? 1,
  });
}

/** "85,2 kg" — número e unidade sempre separados por espaço, nunca colados. */
export function medida(
  valor: number | null | undefined,
  unidade: string,
  casas?: number,
): string | null {
  const n = numero(valor, casas);
  return n == null ? null : `${n} ${unidade}`;
}

/**
 * "136%" — inteiro e SEM teto.
 *
 * O teto é decisão de quem desenha a barra, não de quem escreve o texto:
 * limitar aqui foi exatamente o que produziu o "100% de 2000 mg" embaixo da
 * frase "2720 mg, acima da referência de 2000 mg".
 */
export function porcentagem(valor: number | null | undefined): string | null {
  if (!valido(valor)) return null;
  return `${Math.round(valor)}%`;
}

/** "+0,8 kg" · "−1,2 kg" — o sinal é o dado quando se fala de variação. */
export function variacao(
  valor: number | null | undefined,
  unidade: string,
  casas = 1,
): string | null {
  const n = numero(Math.abs(valor as number), casas);
  if (!valido(valor) || n == null) return null;
  if (valor === 0) return `0 ${unidade}`;
  // Sinal de menos de verdade (U+2212): o hífen do teclado é mais curto e,
  // em fonte tabular, fica quase invisível ao lado de um dígito.
  return `${valor > 0 ? "+" : "−"}${n} ${unidade}`;
}

// ── Durações ──────────────────────────────────────────────────────────

/**
 * "24 min 34 s" · "48 s" · "1 h 05 min".
 *
 * Nunca "24:34": dois pontos entre números é hora do dia para quem lê, e
 * "24:34" não é hora nenhuma. Use em histórico, resumo e relatório.
 */
export function duracaoCurta(segundos: number | null | undefined): string | null {
  if (!valido(segundos) || segundos < 0) return null;
  const total = Math.round(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return s > 0 ? `${m} min ${String(s).padStart(2, "0")} s` : `${m} min`;
  return `${s} s`;
}

/**
 * Cronômetro correndo: "24:34". É o ÚNICO lugar em que dois pontos é certo —
 * o número está mudando na tela e o paciente lê como tempo decorrido, não
 * como registro. Fora do cronômetro, use `duracaoCurta`.
 */
export function cronometro(segundos: number | null | undefined): string {
  if (!valido(segundos) || segundos < 0) return "0:00";
  const total = Math.round(segundos);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * "6 h 17 min" a partir de minutos — o sono, o exercício da semana.
 *
 * O app escrevia isto de dois jeitos ao mesmo tempo: "7.5 h" na tela de metas
 * e "6h17" na tela de sono. São a mesma grandeza; passaram a ter uma escrita.
 */
export function duracaoEmMinutos(minutos: number | null | undefined): string | null {
  if (!valido(minutos) || minutos < 0) return null;
  return duracaoCurta(Math.round(minutos) * 60);
}

/** "7,5 h" — quando o que interessa é a grandeza decimal, e não h + min. */
export function horasDecimais(horas: number | null | undefined, casas = 1): string | null {
  return medida(horas, "h", casas);
}

// ── Data e hora ───────────────────────────────────────────────────────

function comoData(iso: string | Date | null | undefined): Date | null {
  if (!iso) return null;
  const d = iso instanceof Date ? iso : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "13/09/2026". */
export function data(iso: string | Date | null | undefined): string | null {
  const d = comoData(iso);
  return d?.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" }) ?? null;
}

/** "13/09" — eixo de gráfico e lista densa, onde o ano não decide nada. */
export function diaCurto(iso: string | Date | null | undefined): string | null {
  const d = comoData(iso);
  return d?.toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit" }) ?? null;
}

/** "13 de setembro de 2026" — data que o paciente lê uma vez e precisa entender. */
export function dataPorExtenso(iso: string | Date | null | undefined): string | null {
  const d = comoData(iso);
  return d?.toLocaleDateString(LOCALE, { day: "2-digit", month: "long", year: "numeric" }) ?? null;
}

/** "08:10" — 24 h, que é como o brasileiro lê horário de remédio. */
export function hora(iso: string | Date | null | undefined): string | null {
  const d = comoData(iso);
  return d?.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) ?? null;
}

/** "13/09/2026 às 08:10". */
export function dataHora(iso: string | Date | null | undefined): string | null {
  const d = comoData(iso);
  if (!d) return null;
  return `${data(d)} às ${hora(d)}`;
}

// ── Data em frase, e nome em iniciais ─────────────────────────────────
//
// Vieram de `components/hoje/formato.ts`, que reimplementava data, hora e
// `diaCurto` por conta própria. Dois módulos de formatação é como a mesma
// leitura acaba escrita de dois jeitos na mesma tela; este é o único.

const DIA_MS = 86_400_000;

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * "Hoje, 08:10" · "Ontem, 21:30" · "12 de set, 08:10".
 *
 * "Hoje/Ontem" existe porque é a única parte da data que muda a decisão do
 * paciente ("já medi hoje?"). Passado isso, o dia absoluto informa mais que
 * "há 6 dias" — que obriga a fazer conta de cabeça.
 */
export function quandoLegivel(iso?: string | null): string | null {
  const d = comoData(iso);
  if (!d) return null;

  const agora = new Date();
  if (mesmoDia(d, agora)) return `Hoje, ${hora(d)}`;
  if (mesmoDia(d, new Date(+agora - DIA_MS))) return `Ontem, ${hora(d)}`;

  return (
    d.toLocaleDateString(LOCALE, { day: "2-digit", month: "short" }).replace(".", "") +
    `, ${hora(d)}`
  );
}

/** "11 de setembro às 14:30" — para consulta, onde a data por extenso cabe. */
export function dataHoraPorExtenso(iso: string | Date | null | undefined): string {
  const d = comoData(iso);
  if (!d) return "";
  return d.toLocaleDateString(LOCALE, { day: "2-digit", month: "long" }) + " às " + hora(d);
}

/** Dias inteiros decorridos desde o instante dado. `null` se não houver data. */
export function diasDesde(iso?: string | null): number | null {
  const d = comoData(iso);
  return d ? Math.floor((Date.now() - +d) / DIA_MS) : null;
}

/** Tratamentos que não são nome: "Dr. Marcelo Puzzi" tem de dar "MP", não "DP". */
const TRATAMENTOS = new Set(["dr", "dra", "sr", "sra", "prof", "profa", "de", "da", "do", "dos", "das"]);

/** "AR" a partir de "Antônio Ribeiro". Uma letra quando só há um nome. */
export function iniciais(nome?: string | null): string {
  const partes = (nome ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !TRATAMENTOS.has(p.replace(/\./g, "").toLowerCase()));
  if (partes.length === 0) return "?";
  const primeira = partes[0].charAt(0);
  if (partes.length === 1) return primeira.toUpperCase();
  return (primeira + partes[partes.length - 1].charAt(0)).toUpperCase();
}
