/**
 * Cliente Web Bluetooth para a pulseira H59.
 *
 * Funciona em Chrome/Edge (Android, Windows, macOS, Linux). NÃO funciona em
 * iOS — lá o caminho é HealthKit via app nativo ou importação de arquivo.
 * Ver docs/MAPEAMENTO-CARDIO.md §4.
 *
 * Este módulo é deliberadamente burro: conecta, escuta FC e bateria, entrega
 * amostras por callback. Normalização e gravação ficam em `normalize.ts` e nos
 * hooks — assim a mesma tela serve para BLE, importação e Health Connect.
 */

import {
  GATT,
  H59_DEVICE_NAME_PREFIXES,
  PROPRIETARY_SERVICE_UUIDS,
  calcularRmssd,
  calcularSdnn,
  decodeHeartRateMeasurement,
  fcPlausivel,
  type HeartRateSample,
} from "./h59Protocol";

// A tipagem do Web Bluetooth não vem no lib.dom padrão de todos os targets.
/* eslint-disable @typescript-eslint/no-explicit-any */
type BleDevice = any;
type BleServer = any;

export interface WearableSample {
  bpm: number;
  rmssd: number | null;
  sdnn: number | null;
  contactDetected: boolean | null;
  at: string;
}

export interface BleConnection {
  deviceName: string;
  deviceId: string;
  disconnect: () => Promise<void>;
  readBattery: () => Promise<number | null>;
  firmware: string | null;
}

export function bluetoothDisponivel(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export function motivoIndisponivel(): string | null {
  if (typeof navigator === "undefined") return "Ambiente sem navegador.";
  if (!("bluetooth" in navigator)) {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return "O iPhone não permite Bluetooth pelo navegador. Use a importação do app da pulseira — ou o app nativo, quando estiver disponível.";
    }
    return "Este navegador não tem Bluetooth. Use o Chrome ou o Edge no Android ou no computador.";
  }
  if (!window.isSecureContext) return "O Bluetooth só funciona em conexão segura (https).";
  return null;
}

export interface ConectarOpts {
  onSample: (s: WearableSample) => void;
  onDisconnect?: () => void;
  /** Janela de RR acumulados para calcular HRV. */
  hrvWindow?: number;
}

/**
 * Abre o seletor nativo do navegador, conecta e passa a emitir amostras.
 * Precisa ser chamado a partir de um gesto do usuário (clique) — exigência
 * do próprio Web Bluetooth.
 */
export async function conectarPulseira(opts: ConectarOpts): Promise<BleConnection> {
  const impedimento = motivoIndisponivel();
  if (impedimento) throw new Error(impedimento);

  const bluetooth = (navigator as any).bluetooth;
  const device: BleDevice = await bluetooth.requestDevice({
    filters: [
      ...H59_DEVICE_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
      { services: [GATT.heartRateService] },
    ],
    optionalServices: [
      GATT.heartRateService,
      GATT.batteryService,
      GATT.deviceInfoService,
      ...PROPRIETARY_SERVICE_UUIDS,
    ],
  });

  const server: BleServer = await device.gatt.connect();

  // Firmware (rastreabilidade da leitura — vai junto no registro clínico).
  let firmware: string | null = null;
  try {
    const info = await server.getPrimaryService(GATT.deviceInfoService);
    const ch = await info.getCharacteristic(GATT.firmwareRevision);
    firmware = new TextDecoder().decode(await ch.readValue());
  } catch {
    /* nem todo firmware expõe — não é erro */
  }

  // Frequência cardíaca ao vivo.
  const rrBuffer: number[] = [];
  const janela = opts.hrvWindow ?? 60;

  const hrService = await server.getPrimaryService(GATT.heartRateService);
  const hrChar = await hrService.getCharacteristic(GATT.heartRateMeasurement);
  await hrChar.startNotifications();

  hrChar.addEventListener("characteristicvaluechanged", (event: any) => {
    const value: DataView = event.target.value;
    let sample: HeartRateSample;
    try {
      sample = decodeHeartRateMeasurement(value);
    } catch {
      return;
    }
    if (!fcPlausivel(sample.bpm)) return;

    rrBuffer.push(...sample.rrIntervals);
    while (rrBuffer.length > janela) rrBuffer.shift();

    opts.onSample({
      bpm: sample.bpm,
      rmssd: calcularRmssd(rrBuffer),
      sdnn: calcularSdnn(rrBuffer),
      contactDetected: sample.contactDetected,
      at: new Date().toISOString(),
    });
  });

  device.addEventListener("gattserverdisconnected", () => opts.onDisconnect?.());

  const readBattery = async (): Promise<number | null> => {
    try {
      const svc = await server.getPrimaryService(GATT.batteryService);
      const ch = await svc.getCharacteristic(GATT.batteryLevel);
      const v = await ch.readValue();
      return v.getUint8(0);
    } catch {
      return null;
    }
  };

  return {
    deviceName: device.name ?? "Pulseira",
    deviceId: device.id ?? "unknown",
    firmware,
    readBattery,
    disconnect: async () => {
      try {
        await hrChar.stopNotifications();
      } catch { /* ignora */ }
      if (device.gatt?.connected) device.gatt.disconnect();
    },
  };
}

// ── Diagnóstico ──────────────────────────────────────────────────────

export interface ServicoEncontrado {
  uuid: string;
  nome: string;
  caracteristicas: number;
  /** O app consegue usar este serviço hoje? */
  suportado: boolean;
}

export interface DiagnosticoPulseira {
  nome: string;
  id: string;
  firmware: string | null;
  bateria: number | null;
  servicos: ServicoEncontrado[];
  /** Conclusão em linguagem de paciente. */
  resumo: string;
  /** Dá para ler frequência cardíaca ao vivo? */
  temFrequenciaCardiaca: boolean;
  /** Existe serviço proprietário (histórico/sono) que precisaria do SDK? */
  temServicoProprietario: boolean;
}

const NOMES_CONHECIDOS: Record<string, { nome: string; suportado: boolean }> = {
  "0000180d": { nome: "Frequência cardíaca (padrão Bluetooth)", suportado: true },
  "0000180f": { nome: "Nível de bateria", suportado: true },
  "0000180a": { nome: "Informações do dispositivo", suportado: true },
  "00001800": { nome: "Identificação genérica", suportado: true },
  "00001801": { nome: "Atributos genéricos", suportado: true },
  "0000fee7": { nome: "Serviço proprietário do fabricante", suportado: false },
  "0000fff0": { nome: "Serviço proprietário do fabricante", suportado: false },
  "0000ffe0": { nome: "Serviço proprietário do fabricante", suportado: false },
  "0000fe59": { nome: "Atualização de firmware", suportado: false },
};

/**
 * Conecta em QUALQUER dispositivo e relata o que ele expõe.
 *
 * Por que existe: cada lote dessas pulseiras ODM anuncia um nome diferente e
 * expõe um conjunto diferente de serviços. Em vez de assumir e errar, o
 * paciente (ou você, no teste do primeiro aparelho) conecta uma vez e o app
 * responde o que dá para ler de verdade daquele hardware específico.
 */
export async function diagnosticarPulseira(): Promise<DiagnosticoPulseira> {
  const impedimento = motivoIndisponivel();
  if (impedimento) throw new Error(impedimento);

  const bluetooth = (navigator as any).bluetooth;
  const device: BleDevice = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [
      GATT.heartRateService,
      GATT.batteryService,
      GATT.deviceInfoService,
      ...PROPRIETARY_SERVICE_UUIDS,
    ],
  });

  const server: BleServer = await device.gatt.connect();
  const servicos: ServicoEncontrado[] = [];

  let encontrados: any[] = [];
  try {
    encontrados = await server.getPrimaryServices();
  } catch {
    // Alguns navegadores só entregam os serviços declarados em optionalServices.
    for (const uuid of [GATT.heartRateService, GATT.batteryService, GATT.deviceInfoService]) {
      try { encontrados.push(await server.getPrimaryService(uuid)); } catch { /* ausente */ }
    }
  }

  for (const svc of encontrados) {
    const uuid = String(svc.uuid).toLowerCase();
    const curto = uuid.slice(0, 8);
    const conhecido = NOMES_CONHECIDOS[curto];
    let caracteristicas = 0;
    try { caracteristicas = (await svc.getCharacteristics()).length; } catch { /* sem permissão */ }
    servicos.push({
      uuid,
      nome: conhecido?.nome ?? "Serviço não identificado",
      caracteristicas,
      suportado: conhecido?.suportado ?? false,
    });
  }

  let firmware: string | null = null;
  try {
    const info = await server.getPrimaryService(GATT.deviceInfoService);
    const ch = await info.getCharacteristic(GATT.firmwareRevision);
    firmware = new TextDecoder().decode(await ch.readValue());
  } catch { /* nem todo firmware expõe */ }

  let bateria: number | null = null;
  try {
    const svc = await server.getPrimaryService(GATT.batteryService);
    const ch = await svc.getCharacteristic(GATT.batteryLevel);
    bateria = (await ch.readValue()).getUint8(0);
  } catch { /* ausente */ }

  const temFrequenciaCardiaca = servicos.some((s) => s.uuid.startsWith("0000180d"));
  const temServicoProprietario = servicos.some((s) => !s.suportado && s.caracteristicas > 0);

  if (device.gatt?.connected) device.gatt.disconnect();

  const resumo = temFrequenciaCardiaca
    ? "Esta pulseira conversa com o app: dá para ler seus batimentos ao vivo direto por aqui."
    : temServicoProprietario
    ? "Esta pulseira só conversa pelo aplicativo do fabricante. Aqui os dados entram pela importação de arquivo."
    : "Não consegui identificar o que esta pulseira oferece. Tente aproximá-la do celular e conectar de novo.";

  return {
    nome: device.name ?? "Dispositivo sem nome",
    id: device.id ?? "desconhecido",
    firmware,
    bateria,
    servicos,
    resumo,
    temFrequenciaCardiaca,
    temServicoProprietario,
  };
}
