import assert from "node:assert/strict";
import { test } from "node:test";
import { metricaDisponivelH59, origemDeAparelho } from "./h59Capabilities.ts";

test("H59MAX não oferece cards de sensores ausentes ou sem integração", () => {
  for (const tipo of ["weight", "glucose", "ecg", "temperature", "hrv", "stress"]) {
    assert.equal(metricaDisponivelH59(tipo), false, tipo);
  }
  for (const tipo of ["heart_rate", "spo2", "sleep", "activity", "blood_pressure"]) {
    assert.equal(metricaDisponivelH59(tipo), true, tipo);
  }
});
test("leituras importadas aparecem com as de aparelho, sem incluir entrada manual", () => {
  assert.equal(origemDeAparelho("device"), true);
  assert.equal(origemDeAparelho("import"), true);
  assert.equal(origemDeAparelho("manual"), false);
  assert.equal(origemDeAparelho("lab"), false);
});
