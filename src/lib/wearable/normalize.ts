/**
 * Converte o que vem do dispositivo (BLE ou importação) em leituras clínicas
 * com proveniência completa.
 *
 * Este é o único lugar onde um dado de pulseira vira registro clínico — e é
 * por isso que a marcação de "estimativa" é aplicada aqui, uma vez, em vez de
 * ficar espalhada por telas.
 */

import type {
  BloodPressureReading,
  HeartRateReading,
  HrvReading,
  Spo2Reading,
  ActivityReading,
  SleepReading,
} from "@/types/cardio";
import type { WearableSample } from "./bleClient";
import type { LinhaImportada } from "./importer";

export interface DeviceContext {
  patientUserId: string;
  deviceId?: string | null;
  deviceName: string;
}

type Novo<T> = Omit<T, "id" | "created_at">;

const base = (ctx: DeviceContext, at: string) => ({
  patient_user_id: ctx.patientUserId,
  recorded_at: at,
  source_type: "device" as const,
  source_device_id: ctx.deviceId ?? null,
  source_device_name: ctx.deviceName,
  entered_by: "device" as const,
  entered_by_user_id: null,
});

export function amostraParaLeituras(
  s: WearableSample,
  ctx: DeviceContext
): { heartRate: Novo<HeartRateReading>; hrv: Novo<HrvReading> | null } {
  const heartRate: Novo<HeartRateReading> = {
    ...base(ctx, s.at),
    vital_type: "heart_rate",
    bpm: s.bpm,
    context: "resting",
    irregular_flag: null,
    // FC por PPG é medida de sensor aceita para tendência: validated.
    validation_status: s.contactDetected === false ? "suspect" : "validated",
  };

  const hrv: Novo<HrvReading> | null =
    s.rmssd != null || s.sdnn != null
      ? {
          ...base(ctx, s.at),
          vital_type: "hrv",
          rmssd: s.rmssd,
          sdnn: s.sdnn,
          validation_status: "validated",
        }
      : null;

  return { heartRate, hrv };
}

export interface LeiturasImportadas {
  heartRate: Novo<HeartRateReading>[];
  spo2: Novo<Spo2Reading>[];
  bloodPressure: Novo<BloodPressureReading>[];
  activity: Novo<ActivityReading>[];
  sleep: Novo<SleepReading>[];
}

export function linhasParaLeituras(
  linhas: LinhaImportada[],
  ctx: DeviceContext
): LeiturasImportadas {
  const out: LeiturasImportadas = { heartRate: [], spo2: [], bloodPressure: [], activity: [], sleep: [] };

  for (const l of linhas) {
    const b = { ...base(ctx, l.recordedAt), source_type: "import" as const };
    const dia = l.recordedAt.slice(0, 10);

    if (l.heartRate != null) {
      out.heartRate.push({
        ...b, vital_type: "heart_rate", bpm: l.heartRate,
        context: "resting", irregular_flag: null, validation_status: "validated",
      });
    }
    if (l.spo2 != null) {
      out.spo2.push({
        ...b, vital_type: "spo2", value: l.spo2, context: "spot",
        time_below_90_pct: null, validation_status: "validated",
      });
    }
    if (l.systolic != null && l.diastolic != null) {
      out.bloodPressure.push({
        ...b,
        vital_type: "blood_pressure",
        systolic: l.systolic,
        diastolic: l.diastolic,
        pulse: l.heartRate ?? null,
        context: "random",
        position: null,
        arm: null,
        // A regra do §4, aplicada de uma vez só:
        cuff_validated: false,
        validation_status: "estimated",
        validation_note:
          "Estimativa por sensor óptico da pulseira — sem manguito, sem validação clínica. Não usar para decisão terapêutica.",
      });
    }
    if (l.steps != null || l.calories != null) {
      out.activity.push({
        ...b, vital_type: "steps", activity_date: dia,
        steps: l.steps ?? null, calories: l.calories ?? null,
        distance_km: null, moderate_minutes: null, vigorous_minutes: null,
        avg_heart_rate: l.heartRate ?? null, max_heart_rate: null,
        validation_status: "validated",
      });
    }
    if (l.sleepMinutes != null) {
      out.sleep.push({
        ...b, vital_type: "sleep", sleep_date: dia,
        total_minutes: l.sleepMinutes,
        deep_minutes: l.deepMinutes ?? null,
        light_minutes: l.lightMinutes ?? null,
        rem_minutes: null, awake_minutes: null, awakenings: null,
        efficiency_pct: null, min_heart_rate: null, min_spo2: null,
        validation_status: "validated",
      });
    }
  }

  return out;
}

/** Rótulo curto de proveniência, usado nos badges das telas. */
export function rotuloProveniencia(
  sourceType: string,
  validation: string,
  deviceName?: string | null
): { label: string; tone: "neutral" | "warning" } {
  if (validation === "estimated") {
    return { label: `Estimativa · ${deviceName ?? "pulseira"}`, tone: "warning" };
  }
  if (sourceType === "device") return { label: deviceName ?? "Dispositivo", tone: "neutral" };
  if (sourceType === "import") return { label: "Importado", tone: "neutral" };
  if (sourceType === "lab") return { label: "Laboratório", tone: "neutral" };
  if (sourceType === "manual") return { label: "Registro manual", tone: "neutral" };
  return { label: "Sistema", tone: "neutral" };
}
