/**
 * Leitura de `sleep_records`.
 *
 * A janela padrão das outras séries é 90 dias — feita para frequência
 * cardíaca, que grava o tempo todo. Sono é uma linha por noite. Duas noites
 * de janeiro não cabem nesses 90 dias e a tela dizia "sem dados" com o
 * registro já no banco. O teto de linhas continua no hook (400).
 *
 * O fim é o dia local ou o dia UTC, o que for mais tarde: em fuso positivo
 * a noite de hoje ainda é "amanhã" em UTC.
 */
export const DESDE_SONO = "2000-01-01T00:00:00.000Z";

export function limitesSono(agora = new Date()): { desde: string; ate: string } {
  const fimUtc = new Date(agora);
  fimUtc.setUTCHours(23, 59, 59, 999);
  const fimLocal = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
  const fim = fimLocal.getTime() > fimUtc.getTime() ? fimLocal : fimUtc;
  return { desde: DESDE_SONO, ate: fim.toISOString() };
}

export function noiteNaJanela(sleepDate: string, agora = new Date()): boolean {
  const { desde, ate } = limitesSono(agora);
  const dia = sleepDate.slice(0, 10);
  return dia >= desde.slice(0, 10) && dia <= ate.slice(0, 10);
}
