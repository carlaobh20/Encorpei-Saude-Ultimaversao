import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AVISO_IPHONE,
  MEDIDAS_SO_NO_ARQUIVO,
  acrescentarPendente,
  algumGravou,
  ambienteDaqui,
  bloqueioDeRetomada,
  escolherPermitido,
  deveRetomarAposQueda,
  efeitoDaLigacao,
  filaAposFlush,
  lerFila,
  medidaEntraNaLigacao,
  salvarFila,
  type BatimentoPendente,
} from "./conexaoFixa.ts";

const item: BatimentoPendente = {
  at: "2026-09-28T12:00:00.000Z",
  bpm: 72,
  deviceName: "Pulseira",
  deviceId: "dev-1",
};

function memoria() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

const chrome = ambienteDaqui({
  userAgent: "Mozilla/5.0 Chrome/120.0.0.0",
  bluetooth: { getDevices() { return Promise.resolve([]); } },
  secure: true,
});

test("só frequência cardíaca entra na ligação; o resto fica no arquivo", () => {
  assert.equal(medidaEntraNaLigacao("heart_rate"), true);
  for (const medida of MEDIDAS_SO_NO_ARQUIVO) {
    assert.equal(medidaEntraNaLigacao(medida), false);
  }
});

test("iPhone não retoma Bluetooth e aponta o arquivo", () => {
  const bloqueio = bloqueioDeRetomada(ambienteDaqui({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
    bluetooth: { getDevices() {} },
    secure: true,
  }));
  assert.equal(bloqueio, AVISO_IPHONE);
  assert.match(bloqueio, /arquivo/i);
  assert.doesNotMatch(bloqueio, /bluetooth funciona/i);
  assert.equal(efeitoDaLigacao("iphone").tipo, "arquivo");
});

test("Chrome seguro com aparelho já autorizado pode retomar sem arquivo", () => {
  assert.equal(bloqueioDeRetomada(chrome), null);
  assert.equal(escolherPermitido([{ id: "a" }, { id: "b" }], "b")?.id, "b");
  assert.equal(escolherPermitido([{ id: "a" }], null), null);
  assert.equal(escolherPermitido([{ id: "a" }], "outro"), null);
});

test("sair da página mantém a ligação; queda retoma; encerrar solta", () => {
  assert.equal(efeitoDaLigacao("saiu-da-pagina").tipo, "manter");
  assert.equal(efeitoDaLigacao("queda-radio").tipo, "retomar");
  assert.equal(efeitoDaLigacao("falha-rede").tipo, "enfileirar");
  assert.equal(efeitoDaLigacao("encerrar").tipo, "desconectar");
  assert.equal(deveRetomarAposQueda(0), true);
  assert.equal(deveRetomarAposQueda(2), true);
  assert.equal(deveRetomarAposQueda(3), false);
});

test("falha de rede não marca sync; gravação confirmada tira da fila", () => {
  const fila = acrescentarPendente(acrescentarPendente([], item), item);
  assert.equal(fila.length, 1);
  assert.equal(algumGravou([false]), false);
  assert.deepEqual(filaAposFlush(fila, [false]), fila);
  assert.equal(algumGravou([false, true]), true);
  assert.deepEqual(filaAposFlush([item, { ...item, at: "2026-09-28T12:01:00.000Z" }], [true, false]), [
    { ...item, at: "2026-09-28T12:01:00.000Z" },
  ]);
});

test("fila persiste fora da página", () => {
  const storage = memoria();
  assert.deepEqual(lerFila(storage), []);
  salvarFila(storage, [item]);
  assert.deepEqual(lerFila(storage), [item]);
  salvarFila(storage, []);
  assert.deepEqual(lerFila(storage), []);
  salvarFila(storage, [item]);
  storage.setItem("encorpei.hr.outbox", "não-json");
  assert.deepEqual(lerFila(storage), []);
});

test("a tela da pulseira não desconecta ao desmontar", () => {
  const src = readFileSync(new URL("../../pages/PulseiraPage.tsx", import.meta.url), "utf8");
  assert.equal(src.includes("() => { conexao?.disconnect().catch(() => {}); }, [conexao]"), false);
  assert.match(src, /fixa:\s*true/);
});
