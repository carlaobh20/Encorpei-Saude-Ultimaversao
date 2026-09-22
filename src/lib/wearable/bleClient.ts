/**
 * Cliente Web Bluetooth para a pulseira do paciente.
 *
 * HIPÓTESE NÃO CONFIRMADA (docs §4): a ficha que temos do aparelho — modelo,
 * MCU, sensores, app companheiro — veio de anúncio de fornecedor, não de manual
 * nem de documento de protocolo. Os prefixos de nome e os UUIDs proprietários
 * em `h59Protocol.ts` são palpite informado, e é justamente por isso que existe
 * `diagnosticarPulseira()`: quem responde o que este hardware expõe é o teste no
 * aparelho, não a ficha. Nenhuma tela deve afirmar modelo ao paciente.
 *
 * Funciona em Chrome/Edge (Android, Windows, macOS, Linux). NÃO funciona em
 * iOS — lá o caminho é HealthKit via app nativo ou importação de arquivo.
 *
 * Este módulo é deliberadamente burro: conecta, escuta FC e bateria, entrega
 * amostras por callback. Normalização e gravação ficam em `normalize.ts` e nos
 * hooks — assim a mesma tela serve para BLE, importação e Health Connect.
 */

import {
  COLMI,
  GATT,
  H59_DEVICE_NAME_PREFIXES,
  PROPRIETARY_SERVICE_UUIDS,
  calcularRmssd,
  calcularSdnn,
  decodeHeartRateMeasurement,
  fcPlausivel,
  lerBatimentoColmi,
  medicaoColmiEncerrou,
  pacoteIniciarBatimento,
  pacotePararBatimento,
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

/**
 * O que fazer com a frase que o navegador devolveu ao recusar a conexão.
 *
 * "bloqueio" acontece antes de qualquer aparelho: o Chrome nem abre a lista.
 * A frase crua mais comum é "Web Bluetooth API globally disabled." — o
 * navegador (preview embutido, WebView, ou a opção de site desligada em
 * Configurações → Bluetooth) recusou a API inteira. Isso não é falha de
 * envio e não pode virar "Não deu certo" na tela.
 *
 * "tentativa" é o que sobra: a busca chegou a começar e quebrou no meio.
 */
export type ClasseFalhaBluetooth = "bloqueio" | "tentativa";

const AVISO_API_BLOQUEADA =
  "Este navegador bloqueou o Bluetooth, então a pulseira nem chega a ser procurada. Abra o app no Chrome ou no Edge, com o Bluetooth do celular ou do computador ligado. Se já estiver neles, vá em Configurações do site, Bluetooth, e permita que os sites peçam para conectar. Enquanto isso, os dados entram pelo arquivo, logo abaixo.";

export function classificarFalhaBluetooth(erro: unknown): {
  classe: ClasseFalhaBluetooth;
  mensagem: string;
} {
  const bruto = erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "";
  const m = bruto.toLowerCase();

  if (
    m.includes("globally disabled") ||
    m.includes("disabled web bluetooth") ||
    m.includes("enterprise policy") ||
    m.includes("permissions policy") ||
    m.includes("fenced frame") ||
    m.includes("opaque origin")
  ) {
    return { classe: "bloqueio", mensagem: AVISO_API_BLOQUEADA };
  }

  if (m.includes("adapter not available")) {
    return {
      classe: "bloqueio",
      mensagem: "O Bluetooth deste celular ou computador está desligado. Ligue e toque em conectar de novo.",
    };
  }

  if (m.includes("user cancelled") || m.includes("chooser")) {
    return {
      classe: "bloqueio",
      mensagem: "Você fechou a lista de aparelhos. Toque em conectar e escolha a pulseira.",
    };
  }

  if (m.includes("denied the browser permission") || m.includes("not allowed")) {
    return {
      classe: "bloqueio",
      mensagem: "O navegador não deixou procurar a pulseira. Quando ele perguntar, permita o Bluetooth e tente de novo.",
    };
  }

  if (m.includes("user gesture")) {
    return {
      classe: "bloqueio",
      mensagem: "Toque de novo no botão de conectar para o navegador permitir a busca.",
    };
  }

  if (m.includes("no services matching") || m.includes("0000180d")) {
    return {
      classe: "tentativa",
      mensagem: "Este aparelho conectou, mas não envia batimentos por aqui. Use o arquivo exportado do aplicativo dele, logo abaixo.",
    };
  }

  return {
    classe: "tentativa",
    mensagem: bruto.trim() || "Não consegui conectar. Tente de novo.",
  };
}

export interface ConectarOpts {
  onSample: (s: WearableSample) => void;
  onDisconnect?: () => void;
  /** Janela de RR acumulados para calcular HRV. */
  hrvWindow?: number;
}

const SERVICOS_OPCIONAIS = [
  GATT.heartRateService,
  GATT.batteryService,
  GATT.deviceInfoService,
  COLMI.service,
  ...PROPRIETARY_SERVICE_UUIDS,
];

function emitirAmostra(opts: ConectarOpts, bpm: number, extra?: Partial<WearableSample>) {
  if (!fcPlausivel(bpm)) return;
  opts.onSample({
    bpm,
    rmssd: extra?.rmssd ?? null,
    sdnn: extra?.sdnn ?? null,
    contactDetected: extra?.contactDetected ?? null,
    at: new Date().toISOString(),
  });
}

async function escreverPacote(ch: any, pacote: Uint8Array) {
  if (typeof ch.writeValueWithoutResponse === "function") {
    try {
      await ch.writeValueWithoutResponse(pacote);
      return;
    } catch { /* algumas pilhas só aceitam escrita com resposta */ }
  }
  await ch.writeValue(pacote);
}

/**
 * Heart Rate padrão (0x180D). Devolve a função de parar, ou null se o
 * aparelho não tem esse serviço — o caso do H59 que só fala Colmi.
 */
async function ligarFrequenciaPadrao(server: BleServer, opts: ConectarOpts): Promise<(() => Promise<void>) | null> {
  let hrChar: any;
  try {
    const hrService = await server.getPrimaryService(GATT.heartRateService);
    hrChar = await hrService.getCharacteristic(GATT.heartRateMeasurement);
    await hrChar.startNotifications();
  } catch {
    return null;
  }

  const rrBuffer: number[] = [];
  const janela = opts.hrvWindow ?? 60;
  hrChar.addEventListener("characteristicvaluechanged", (event: any) => {
    const value: DataView = event.target.value;
    let sample: HeartRateSample;
    try {
      sample = decodeHeartRateMeasurement(value);
    } catch {
      return;
    }
    rrBuffer.push(...sample.rrIntervals);
    while (rrBuffer.length > janela) rrBuffer.shift();
    emitirAmostra(opts, sample.bpm, {
      rmssd: calcularRmssd(rrBuffer),
      sdnn: calcularSdnn(rrBuffer),
      contactDetected: sample.contactDetected,
    });
  });

  return async () => {
    try { await hrChar.stopNotifications(); } catch { /* ignora */ }
  };
}

/**
 * Batimento ao vivo pelo canal Colmi/QC. A medição sob demanda acaba sozinha;
 * enquanto a tela estiver aberta, pedimos de novo. Sem batimento nenhum, para
 * de insistir para não deixar o LED piscando à toa.
 */
async function ligarFrequenciaColmi(server: BleServer, opts: ConectarOpts): Promise<(() => Promise<void>) | null> {
  let rx: any;
  let tx: any;
  try {
    const svc = await server.getPrimaryService(COLMI.service);
    rx = await svc.getCharacteristic(COLMI.rx);
    tx = await svc.getCharacteristic(COLMI.tx);
    await tx.startNotifications();
  } catch {
    return null;
  }

  let parado = false;
  let repetir: ReturnType<typeof setTimeout> | null = null;
  let semBatimento = 0;

  const iniciar = () => escreverPacote(rx, pacoteIniciarBatimento());

  tx.addEventListener("characteristicvaluechanged", (event: any) => {
    if (parado) return;
    const value: DataView = event.target.value;
    const bpm = lerBatimentoColmi(value);
    if (bpm != null) {
      semBatimento = 0;
      emitirAmostra(opts, bpm);
      return;
    }
    if (!medicaoColmiEncerrou(value)) return;
    if (semBatimento >= 2) return;
    semBatimento += 1;
    if (repetir) clearTimeout(repetir);
    repetir = setTimeout(() => { if (!parado) iniciar().catch(() => {}); }, 1500);
  });

  await iniciar();

  return async () => {
    parado = true;
    if (repetir) clearTimeout(repetir);
    try { await escreverPacote(rx, pacotePararBatimento()); } catch { /* ignora */ }
    try { await tx.stopNotifications(); } catch { /* ignora */ }
  };
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
    optionalServices: SERVICOS_OPCIONAIS,
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

  const pararPadrao = await ligarFrequenciaPadrao(server, opts);
  const parar = pararPadrao ?? await ligarFrequenciaColmi(server, opts);
  if (!parar) {
    if (device.gatt?.connected) device.gatt.disconnect();
    throw new Error("Este aparelho conectou, mas não envia batimentos por aqui. Use o arquivo exportado do aplicativo dele, logo abaixo.");
  }

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
      await parar();
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
  "6e400001": { nome: "Canal da pulseira (batimentos)", suportado: true },
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
    optionalServices: SERVICOS_OPCIONAIS,
  });

  const server: BleServer = await device.gatt.connect();
  const servicos: ServicoEncontrado[] = [];

  let encontrados: any[] = [];
  try {
    encontrados = await server.getPrimaryServices();
  } catch {
    // Alguns navegadores só entregam os serviços declarados em optionalServices.
    for (const uuid of [GATT.heartRateService, GATT.batteryService, GATT.deviceInfoService, COLMI.service]) {
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

  const temFrequenciaCardiaca = servicos.some(
    (s) => s.uuid.startsWith("0000180d") || s.uuid.startsWith("6e400001"),
  );
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
