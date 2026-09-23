import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, test } from "node:test";
import {
  bufferParaHex,
  classificarPacoteProprietario,
  dataLocalDaNoite,
  pacoteEhFrequenciaCardiaca,
  pacoteHistoricoBatimento,
  pacoteIniciarBatimento,
  pacotePararBatimento,
  setProprietaryDecoder,
} from "./h59Protocol.ts";
import { importarCsv } from "./importer.ts";
import { decidirGravacaoSono, linhasParaLeituras, noiteDePacote, type NoiteGravada } from "./normalize.ts";
import { noiteNaJanela } from "../janelaSono.ts";

afterEach(() => setProprietaryDecoder(() => null));

function view(bytes: number[]): DataView {
  return new DataView(new Uint8Array(bytes).buffer);
}

const ctx = { patientUserId: "paciente", deviceName: "Pulseira" };

function noiteVazia(id: string, dia: string, parcial: Partial<NoiteGravada> = {}): NoiteGravada {
  return {
    id,
    sleep_date: dia,
    deep_minutes: null,
    light_minutes: null,
    rem_minutes: null,
    awake_minutes: null,
    awakenings: null,
    efficiency_pct: null,
    min_heart_rate: null,
    min_spo2: null,
    ...parcial,
  };
}

test("comandos 21, 105 e 106 continuam sendo só frequência cardíaca", () => {
  const iniciar = pacoteIniciarBatimento();
  const parar = pacotePararBatimento();
  const historico = pacoteHistoricoBatimento(0);
  assert.deepEqual([...iniciar], [105, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 107]);
  assert.deepEqual([...parar], [106, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 107]);
  assert.equal(historico[0], 21);
  assert.equal(historico[15], 21);
  for (const p of [iniciar, parar, historico]) {
    assert.equal(pacoteEhFrequenciaCardiaca(new DataView(p.buffer, p.byteOffset, p.byteLength)), true);
  }
  assert.equal(pacoteEhFrequenciaCardiaca(view([22, 1, 2])), false);

  const cliente = readFileSync(new URL("./bleClient.ts", import.meta.url), "utf8");
  const escuta = cliente.slice(cliente.indexOf("characteristicvaluechanged"));
  assert.match(escuta, /if \(!parado && !pacoteEhFrequenciaCardiaca\(view\)\) \{\s*opts\.onPacoteProprietario\?\.\(pacote\);/);
});

test("arquivo com total, profundo e leve continua estimado, uma noite", () => {
  const csv = "data,sono total,sono profundo,sono leve\n03/09/2026,7h30,2h,4h\n";
  const lido = importarCsv(csv);
  assert.equal(lido.linhas.length, 1);
  assert.equal(lido.linhas[0].sleepMinutes, 450);
  assert.equal(lido.linhas[0].deepMinutes, 120);
  assert.equal(lido.linhas[0].lightMinutes, 240);
  assert.equal(lido.linhas[0].validation, "estimated");

  const sono = linhasParaLeituras(lido.linhas, ctx).sleep;
  assert.equal(sono.length, 1);
  assert.equal(sono[0].total_minutes, 450);
  assert.equal(sono[0].deep_minutes, 120);
  assert.equal(sono[0].light_minutes, 240);
  assert.equal(sono[0].rem_minutes, null);
  assert.equal(sono[0].source_type, "import");
  assert.equal(sono[0].entered_by, "device");
  assert.equal(sono[0].validation_status, "estimated");
  assert.equal(sono[0].sleep_date, lido.linhas[0].recordedAt.slice(0, 10));
});

test("noite desta semana no formato da tela original entra na leitura", () => {
  // A tela da pulseira mostra 8 h 11 min = profundo 2 h 17 + leve 4 h 44 + REM 1 h 10 + desperto 0.
  const csv = [
    "data,sono profundo,sono leve,rem,desperto",
    "22/09/2026,2 h 17 min,4 h 44 min,1 h 10 min,0 h 0 min",
    "23/09/2026,2 h 17 min,4 h 44 min,1 h 10 min,0 h 0 min",
  ].join("\n");
  const lido = importarCsv(csv);
  assert.equal(lido.linhas.length, 2);
  const sono = linhasParaLeituras(lido.linhas, ctx).sleep;
  assert.equal(sono.length, 2);
  const agora = new Date("2026-09-23T15:00:00.000Z");
  assert.equal(new Set(sono.map((s) => s.sleep_date)).size, 2);
  for (const noite of sono) {
    assert.equal(noite.total_minutes, 8 * 60 + 11);
    assert.equal(noite.deep_minutes, 2 * 60 + 17);
    assert.equal(noite.light_minutes, 4 * 60 + 44);
    assert.equal(noite.rem_minutes, 1 * 60 + 10);
    assert.equal(noite.awake_minutes, 0);
    assert.equal(noite.efficiency_pct, null);
    assert.equal(noiteNaJanela(noite.sleep_date, agora), true);
  }

  const comTotal = importarCsv("data,sono total\n23/09/2026,8 h 11 min\n");
  assert.equal(comTotal.linhas.length, 1);
  assert.equal(comTotal.linhas[0].sleepMinutes, 8 * 60 + 11);
});

test("coluna nova só entra por mapeamento manual; fora da faixa cai o campo, não a noite", () => {
  const csv = "data,sono,fase rem,eficiencia\n03/09/2026,400,90,150\n";
  const semMapa = importarCsv(csv);
  assert.equal(semMapa.linhas[0].sleepMinutes, 400);
  assert.equal(semMapa.linhas[0].remMinutes, undefined);
  assert.equal(semMapa.colunasNaoReconhecidas.includes("fase rem"), true);

  const lido = importarCsv(csv, { remMinutes: 2, efficiencyPct: 3 });
  assert.equal(lido.linhas.length, 1);
  assert.equal(lido.linhas[0].sleepMinutes, 400);
  assert.equal(lido.linhas[0].remMinutes, 90);
  assert.equal(lido.linhas[0].efficiencyPct, undefined);

  const sono = linhasParaLeituras(lido.linhas, ctx).sleep[0];
  assert.equal(sono.rem_minutes, 90);
  assert.equal(sono.efficiency_pct, null);
  assert.equal(sono.awake_minutes, null);
  assert.equal(sono.min_spo2, null);
  assert.equal(sono.validation_status, "estimated");
});

test("cabeçalho desconhecido não vira sono por includes", () => {
  const lido = importarCsv("data,sono rem\n03/09/2026,90\n");
  assert.equal(lido.linhas.length, 0);
  assert.equal(lido.precisaConfirmacao, true);
});

test("decodificador sleep com total válido vira noite de aparelho, sem campo extra", () => {
  setProprietaryDecoder(() => ({
    kind: "sleep",
    deviceTimestamp: "2026-09-04T03:00:00.000Z",
    payload: {
      sleep_date: "2026-09-03",
      total_minutes: 400,
      deep_minutes: 80,
      rem_minutes: 90,
      efficiency_pct: 92.5,
      min_spo2: 88,
      steps: 1000,
    },
  }));
  const classificado = classificarPacoteProprietario(view([10, 20]));
  assert.equal(classificado.destino, "sono");
  if (classificado.destino !== "sono") return;
  assert.equal(classificado.sleepDate, "2026-09-03");
  assert.equal(classificado.campos.total_minutes, 400);
  assert.equal(classificado.campos.deep_minutes, 80);
  assert.equal(classificado.campos.rem_minutes, 90);
  assert.equal(classificado.campos.efficiency_pct, 92.5);
  assert.equal(classificado.campos.min_spo2, 88);
  assert.equal("steps" in classificado.campos, false);
  assert.equal(classificado.campos.awake_minutes, undefined);

  const noite = noiteDePacote(classificado, ctx);
  assert.equal(noite.source_type, "device");
  assert.equal(noite.validation_status, "estimated");
  assert.equal(noite.entered_by, "device");
  assert.equal(noite.total_minutes, 400);
  assert.equal(noite.min_heart_rate, null);
});

test("sem total válido ou sem decodificador o pacote fica cru e não vira noite", () => {
  const bytes = view([0xab, 0x00]);
  const cru = classificarPacoteProprietario(bytes);
  assert.equal(cru.destino, "cru");
  if (cru.destino !== "cru") return;
  assert.equal(cru.raw_payload.hex, bufferParaHex(bytes));
  assert.equal(cru.raw_payload.hex, "ab 00");
  assert.equal(cru.payload_format, "hex");
  assert.equal(cru.processed, false);
  assert.equal(cru.device_timestamp, null);

  setProprietaryDecoder(() => ({
    kind: "sleep",
    deviceTimestamp: "2026-09-03T03:00:00.000Z",
    payload: { total_minutes: 0, deep_minutes: 40 },
  }));
  assert.equal(classificarPacoteProprietario(view([1])).destino, "cru");

  setProprietaryDecoder(() => ({
    kind: "sleep",
    payload: { total_minutes: 400.5, sleep_date: "2026-09-03" },
  }));
  assert.equal(classificarPacoteProprietario(view([2])).destino, "cru");

  setProprietaryDecoder(() => ({ kind: "spo2", payload: { value: 98 } }));
  assert.equal(classificarPacoteProprietario(view([3])).destino, "outro");
  setProprietaryDecoder(() => ({ kind: "steps", payload: { steps: 10 } }));
  assert.equal(classificarPacoteProprietario(view([4])).destino, "outro");
  setProprietaryDecoder(() => ({ kind: "bp_estimate", payload: { systolic: 120 } }));
  assert.equal(classificarPacoteProprietario(view([5])).destino, "outro");
});

test("data da noite segue o calendário local da pulseira", () => {
  assert.equal(dataLocalDaNoite("2026-09-03"), "2026-09-03");
  assert.equal(dataLocalDaNoite("2026-02-31"), null);
  const iso = "2026-09-03T03:00:00.000Z";
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  assert.equal(dataLocalDaNoite(iso), `${d.getFullYear()}-${m}-${dia}`);
});

test("duas noites salvas antes dos 90 dias entram na leitura", () => {
  const agora = new Date("2026-09-23T15:00:00.000Z");
  const corte90 = new Date(agora);
  corte90.setUTCDate(corte90.getUTCDate() - 90);
  const limite90 = corte90.toISOString().slice(0, 10);
  for (const dia of ["2026-01-15", "2026-03-01"]) {
    assert.ok(dia < limite90);
    assert.equal(noiteNaJanela(dia, agora), true);
  }
  assert.equal(noiteNaJanela("2026-09-23", agora), true);
});

test("reimportar preenche só o que estava vazio", () => {
  const existente = noiteVazia("id-1", "2026-09-03", { deep_minutes: 80, light_minutes: 200 });
  const decisao = decidirGravacaoSono(
    [{
      sleep_date: "2026-09-03",
      total_minutes: 500,
      deep_minutes: 10,
      rem_minutes: 90,
      efficiency_pct: 91,
    }],
    [existente],
  );
  assert.equal(decisao.inserir.length, 0);
  assert.equal(decisao.ignoradas, 0);
  assert.equal(decisao.completar.length, 1);
  assert.deepEqual(decisao.completar[0].patch, { rem_minutes: 90, efficiency_pct: 91 });

  const repetida = decidirGravacaoSono(
    [{ sleep_date: "2026-09-03", deep_minutes: 10, rem_minutes: 90 }],
    [noiteVazia("id-1", "2026-09-03", { deep_minutes: 80, rem_minutes: 90 })],
  );
  assert.equal(repetida.completar.length, 0);
  assert.equal(repetida.ignoradas, 1);

  const nova = decidirGravacaoSono(
    [
      { sleep_date: "2026-09-04", total_minutes: 400, deep_minutes: 70 },
      { sleep_date: "2026-09-04", rem_minutes: 40, deep_minutes: 1 },
    ],
    [],
  );
  assert.equal(nova.inserir.length, 1);
  assert.equal(nova.inserir[0].deep_minutes, 70);
  assert.equal(nova.inserir[0].rem_minutes, 40);
  assert.equal(nova.mescladasNoInsert, 1);
  assert.equal(nova.ignoradas, 0);
});
