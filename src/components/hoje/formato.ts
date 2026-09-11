/**
 * Formatação de data/hora da tela inicial do paciente.
 *
 * Vive fora dos componentes porque os quatro blocos da home ("último
 * registro", gráfico, pulseira, consulta) precisam falar da MESMA data do
 * mesmo jeito. Quando cada bloco formatava sozinho, a mesma leitura aparecia
 * como "11/09 08:10" num cartão e "hoje às 8h" no outro — e o paciente de 68
 * anos lê isso como dois registros diferentes.
 *
 * Nenhuma função aqui interpreta número: só traduz instante em frase.
 */

const DIA_MS = 86_400_000;

function mesmoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function hora(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * "Hoje, 08:10" · "Ontem, 21:30" · "12 de set, 08:10".
 *
 * "Hoje/Ontem" existe porque é a única parte da data que muda a decisão do
 * paciente ("já medi hoje?"). Passado isso, o dia absoluto informa mais que
 * "há 6 dias" — que obriga a fazer conta de cabeça.
 */
export function quandoLegivel(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(+d)) return null;

  const agora = new Date();
  if (mesmoDia(d, agora)) return `Hoje, ${hora(d)}`;
  if (mesmoDia(d, new Date(+agora - DIA_MS))) return `Ontem, ${hora(d)}`;

  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") +
    `, ${hora(d)}`
  );
}

/** "11 de setembro às 14:30" — para consulta, onde a data por extenso cabe. */
export function dataHoraPorExtenso(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) +
    " às " +
    hora(d)
  );
}

/** "11/09" — eixo do gráfico, onde só cabe o dia. */
export function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Dias inteiros decorridos desde o instante dado. `null` se não houver data. */
export function diasDesde(iso?: string | null): number | null {
  if (!iso) return null;
  const t = +new Date(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DIA_MS);
}

/** "AR" a partir de "Antônio Ribeiro". Uma letra quando só há um nome. */
export function iniciais(nome?: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0].charAt(0);
  if (partes.length === 1) return primeira.toUpperCase();
  return (primeira + partes[partes.length - 1].charAt(0)).toUpperCase();
}
