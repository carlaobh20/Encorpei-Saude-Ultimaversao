/**
 * ══════════════════════════════════════════════════════════════════════
 * PULSEIRA H59 MAX — protocolo e limites honestos
 * ══════════════════════════════════════════════════════════════════════
 *
 * FICHA CONFIRMADA no anúncio do fornecedor (set/2026):
 *   MCU .............. Realtek RTL8762E
 *   Bluetooth ........ BLE 5.2
 *   Sensor óptico .... Vcare VC30F-S (PPG — frequência cardíaca e SpO2)
 *   Acelerômetro ..... Sensortek STK8321-W (passos e sono)
 *   Tela ............. nenhuma (screenless)
 *   Bateria .......... 180 mAh · 45–50 dias de uso · 100 dias em espera
 *   Água ............. 1 ATM
 *   App .............. QWatch PRO (com.qcwireless.qcwatch)
 *
 * O QUE NÃO EXISTE NESTE HARDWARE: eletrodo de ECG, sensor de temperatura,
 * glicemia. O que o anúncio chama de "pressão arterial 24h" é estimativa por
 * PPG — o mesmo sensor da frequência cardíaca, sem manguito.
 *
 * Ver docs/MAPEAMENTO-CARDIO.md §4 antes de mexer aqui.
 *
 * O QUE ESTE ARQUIVO FAZ HOJE
 * - Lê os serviços GATT PADRÃO, que qualquer firmware desses chips expõe:
 *   Heart Rate (0x180D) e Battery (0x180F). Isso funciona sem SDK.
 *
 * O QUE ELE NÃO FAZ (e por quê)
 * - Histórico de sono, SpO₂ e passos vivem num serviço PROPRIETÁRIO
 *   (0xFEE7 / 0xFFF0 conforme o lote). Sem a documentação do fabricante,
 *   decodificar isso é adivinhação. O decodificador fica plugável abaixo:
 *   quando o SDK chegar, implementa-se `decodeProprietaryPacket` e o resto
 *   do app não muda.
 *
 * REGRA DE OURO
 * A "pressão arterial" da H59 é estimada por PPG, sem manguito e sem
 * validação clínica. Tudo que sai daqui como PA nasce marcado
 * `validation_status: "estimated"` e é proibido de disparar alerta ou
 * entrar em média de MRPA (ver cardioRiskEngine.mediaMrpa).
 */

// ── UUIDs ────────────────────────────────────────────────────────────

export const GATT = {
  heartRateService: "heart_rate",
  heartRateMeasurement: "heart_rate_measurement",
  batteryService: "battery_service",
  batteryLevel: "battery_level",
  deviceInfoService: "device_information",
  firmwareRevision: "firmware_revision_string",
} as const;

/**
 * Serviços proprietários conhecidos nesses chips (histórico, sono, SpO₂).
 * O RTL8762E costuma expor 0xFEE7 ou 0xFFF0 — mas o formato dos pacotes é do
 * fabricante do firmware, não do chip. Sem a documentação do fornecedor, o que
 * chega aqui é guardado cru (ver `decodeProprietaryPacket`).
 */
export const PROPRIETARY_SERVICE_UUIDS = [
  0xfee7,
  0xfff0,
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
] as const;

/**
 * Nomes que a pulseira pode anunciar no Bluetooth.
 *
 * Varia por lote e por firmware — por isso a tela de diagnóstico existe
 * (`conectarQualquerDispositivo`): em vez de adivinhar, o paciente conecta uma
 * vez e o app registra o nome real.
 */
export const H59_DEVICE_NAME_PREFIXES = [
  "H59", "H-59", "H59 Max", "QWatch", "QCWireless", "Smart Band", "WearFit", "R3L", "TEK",
];

// ── Decodificação padrão (Heart Rate Measurement, spec Bluetooth SIG) ─

export interface HeartRateSample {
  bpm: number;
  /** Intervalos RR em ms, quando o firmware os envia — base para HRV. */
  rrIntervals: number[];
  /** Contato com a pele detectado. */
  contactDetected: boolean | null;
}

/**
 * Formato oficial da característica 0x2A37:
 * byte 0 = flags; bit0 = formato do BPM (0 = uint8, 1 = uint16);
 * bits 1-2 = contato; bit3 = energia gasta presente; bit4 = RR presente.
 */
export function decodeHeartRateMeasurement(value: DataView): HeartRateSample {
  const flags = value.getUint8(0);
  const is16bit = (flags & 0x01) !== 0;
  const contactBits = (flags >> 1) & 0x03;
  const hasEnergy = (flags & 0x08) !== 0;
  const hasRR = (flags & 0x10) !== 0;

  let offset = 1;
  const bpm = is16bit ? value.getUint16(offset, true) : value.getUint8(offset);
  offset += is16bit ? 2 : 1;
  if (hasEnergy) offset += 2;

  const rrIntervals: number[] = [];
  if (hasRR) {
    while (offset + 1 < value.byteLength) {
      // RR vem em unidades de 1/1024 s.
      rrIntervals.push(Math.round((value.getUint16(offset, true) / 1024) * 1000));
      offset += 2;
    }
  }

  const contactDetected = contactBits < 2 ? null : contactBits === 3;
  return { bpm, rrIntervals, contactDetected };
}

/** RMSSD a partir dos intervalos RR — medida de HRV de curto prazo. */
export function calcularRmssd(rrIntervals: number[]): number | null {
  if (rrIntervals.length < 3) return null;
  let soma = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const d = rrIntervals[i] - rrIntervals[i - 1];
    soma += d * d;
  }
  return +Math.sqrt(soma / (rrIntervals.length - 1)).toFixed(1);
}

/** SDNN — desvio-padrão dos intervalos RR. */
export function calcularSdnn(rrIntervals: number[]): number | null {
  if (rrIntervals.length < 3) return null;
  const media = rrIntervals.reduce((a, b) => a + b, 0) / rrIntervals.length;
  const varia = rrIntervals.reduce((a, b) => a + (b - media) ** 2, 0) / (rrIntervals.length - 1);
  return +Math.sqrt(varia).toFixed(1);
}

// ── Ponto de extensão para o protocolo proprietário ───────────────────

export interface ProprietaryPacket {
  kind: "sleep" | "spo2" | "steps" | "bp_estimate" | "unknown";
  payload: Record<string, number | string>;
  deviceTimestamp?: string;
}

export type ProprietaryDecoder = (data: DataView) => ProprietaryPacket | null;

/**
 * Sem SDK, todo pacote proprietário é guardado cru em `raw_device_data`
 * e marcado como "unknown" — nada é inventado. Quando o fabricante entregar
 * a documentação, registre o decodificador com `setProprietaryDecoder`.
 */
let decoder: ProprietaryDecoder = () => null;

export function setProprietaryDecoder(fn: ProprietaryDecoder) {
  decoder = fn;
}

export function decodeProprietaryPacket(data: DataView): ProprietaryPacket {
  const decoded = decoder(data);
  if (decoded) return decoded;
  return {
    kind: "unknown",
    payload: { hex: bufferParaHex(data) },
  };
}

export function bufferParaHex(view: DataView): string {
  const bytes: string[] = [];
  for (let i = 0; i < view.byteLength; i++) {
    bytes.push(view.getUint8(i).toString(16).padStart(2, "0"));
  }
  return bytes.join(" ");
}

// ── Sanidade fisiológica ─────────────────────────────────────────────

/** Descarta leitura absurda antes de gravar (PPG com mau contato inventa número). */
export function fcPlausivel(bpm: number): boolean {
  return Number.isFinite(bpm) && bpm >= 25 && bpm <= 240;
}

export function spo2Plausivel(v: number): boolean {
  return Number.isFinite(v) && v >= 50 && v <= 100;
}
