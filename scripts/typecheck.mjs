#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────
 * TYPECHECK DE VERDADE — com catraca
 * ─────────────────────────────────────────────────────────────
 *
 * Por que este script existe:
 * `tsc --noEmit` no tsconfig.json da raiz NÃO CHECA NADA. O tsconfig da raiz
 * é do tipo "solution style": tem `"files": []` e só aponta referências para
 * tsconfig.app.json e tsconfig.node.json. Sem `-b` ou `-p`, o tsc compila zero
 * arquivos e sai com código 0 — sempre verde, sempre inútil.
 *
 * Isso significa que todo "typecheck limpo" reportado neste projeto até
 * 04/08/2026 não verificou uma linha sequer. Havia 59 erros reais escondidos.
 *
 * O que este script faz:
 * roda `tsc -p tsconfig.app.json --noEmit` (o projeto de verdade) e compara o
 * número de erros com a linha de base registrada em `typecheck-baseline.json`.
 *
 *   - erros ACIMA da base  → falha. Alguém piorou a tipagem.
 *   - erros ABAIXO da base → passa, e avisa para baixar a base.
 *
 * A base só desce. Zerar depende de regenerar
 * `src/integrations/supabase/types.ts` a partir do banco: a maioria dos erros
 * é query contra tabela que os types gerados não conhecem (`daily_logs`,
 * `anamnese`, `consent_records`).
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arquivoBase = resolve(raiz, "typecheck-baseline.json");

let saida = "";
try {
  execSync("npx tsc -p tsconfig.app.json --noEmit", { cwd: raiz, encoding: "utf-8", stdio: "pipe" });
} catch (e) {
  saida = `${e.stdout ?? ""}${e.stderr ?? ""}`;
}

const linhas = saida.split("\n").filter((l) => /error TS\d+/.test(l));
const total = linhas.length;

const porArquivo = {};
for (const l of linhas) {
  const m = l.match(/^(src\/[^(]+)\(/);
  if (m) porArquivo[m[1]] = (porArquivo[m[1]] ?? 0) + 1;
}

const base = existsSync(arquivoBase)
  ? JSON.parse(readFileSync(arquivoBase, "utf-8"))
  : { total: Number.POSITIVE_INFINITY };

console.log(`\nTypecheck real (tsconfig.app.json): ${total} erro(s). Linha de base: ${base.total}.`);

if (total > base.total) {
  console.error(`\n✖ A tipagem PIOROU: ${total - base.total} erro(s) a mais que a linha de base.\n`);
  const novos = Object.entries(porArquivo)
    .filter(([f, n]) => n > (base.porArquivo?.[f] ?? 0))
    .sort((a, b) => b[1] - a[1]);
  for (const [f, n] of novos) console.error(`   ${f}: ${n} (base: ${base.porArquivo?.[f] ?? 0})`);
  console.error("\nCorrija os erros novos ou explique por que a base deve subir.\n");
  process.exit(1);
}

if (total < base.total) {
  console.log(`\n✓ A tipagem MELHOROU: ${base.total - total} erro(s) a menos.`);
  console.log(`  Atualize typecheck-baseline.json para "total": ${total} e trave o ganho.\n`);
} else {
  console.log("✓ Sem piora.\n");
}
process.exit(0);
