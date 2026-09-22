/**
 * ══════════════════════════════════════════════════════════════════════
 * PULSEIRA — protocolo e limites honestos
 * ══════════════════════════════════════════════════════════════════════
 *
 * ⚠ HIPÓTESE NÃO CONFIRMADA. A ficha abaixo veio do ANÚNCIO do fornecedor
 * (set/2026) — não de manual, não de datasheet, não de documento de protocolo.
 * Nada aqui foi verificado no aparelho. Trate como palpite informado:
 * o nome do modelo, o chip, o app companheiro e os UUIDs proprietários podem
 * estar errados, e mudam de lote para lote nesse tipo de ODM.
 *
 * Consequência prática, e ela é regra: **nenhuma tela afirma ao paciente o
 * modelo do aparelho nem o nome do app do fabricante.** A interface diz "o
 * aparelho que você conectou" e mostra o nome que o próprio aparelho anunciou
 * por Bluetooth. Quem responde o que este hardware faz é `diagnosticarPulseira()`.
 *
 * Ficha do anúncio (não confirmada):
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
 * - Se o firmware expuser o Heart Rate padrão (0x180D), lê por ali.
 * - O H59 que chegou na mão NÃO expõe 0x180D. O batimento ao vivo sai pelo
 *   canal Nordic UART do protocolo Colmi/QC (o mesmo do app QWatch PRO):
 *   comando 105, tipo 1, batimento no byte 3. Pacote de 16 bytes com
 *   checksum no último. Conferido no cliente público OpenH59, contra o
 *   aparelho — não é palpite de UUID.
 *
 * O QUE ELE NÃO FAZ (e por quê)
 * - Histórico de sono, SpO₂ e passos usam outros comandos do mesmo canal,
 *   e a pressão desse aparelho continua sendo estimativa de PPG. Não entram
 *   aqui: o que esta conexão grava é batimento.
 *
 * REGRA DE OURO
 * A "pressão arterial" desta pulseira é estimada por PPG, sem manguito e sem
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
  0xffe0,
  0xff00,
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
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

/**
 * Canal que o H59 usa no lugar do Heart Rate padrão.
 *
 * O serviço NÃO é o Nordic UART de catálogo (6e400001). Neste firmware é
 * 6e40fff0, com as mesmas características de escrita e notificação. Pedir o
 * UUID errado faz o navegador dizer que o serviço não existe.
 */
export const COLMI = {
  service: "6e40fff0-b5a3-f393-e0a9-e50e24dcca9e",
  serviceAlternativo: "6e400001-b5a3-f393-e0a9-e50e24dcca9e",
  /** Mesmo UART, último byte 9f — lote que não responde ao 9e. */
  serviceVariante: "6e400001-b5a3-f393-e0a9-e50e24dcca9f",
  rx: "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
  tx: "6e400003-b5a3-f393-e0a9-e50e24dcca9e",
} as const;

/** Serviços em que o canal de batimento pode aparecer. O Chrome só deixa ler o que foi pedido aqui. */
export const COLMI_SERVICOS = [COLMI.service, COLMI.serviceAlternativo, COLMI.serviceVariante] as const;

export const COLMI_CMD_HISTORICO_FC = 21;

export interface PontoBatimento {
  at: string;
  bpm: number;
}

const COLMI_REALTIME = 105;
const COLMI_REALTIME_PARAR = 106;
const COLMI_TIPO_BATIMENTO = 1;

/** Pacote de 16 bytes: comando, argumentos, checksum (soma dos 15 primeiros) no fim. */
export function pacoteColmi(cmd: number, args: number[] = []): Uint8Array {
  const p = new Uint8Array(16);
  p[0] = cmd & 0xff;
  args.forEach((b, i) => {
    if (i < 14) p[i + 1] = b & 0xff;
  });
  let soma = 0;
  for (let i = 0; i < 15; i++) soma = (soma + p[i]) & 0xff;
  p[15] = soma;
  return p;
}

export function pacoteIniciarBatimento(): Uint8Array {
  return pacoteColmi(COLMI_REALTIME, [COLMI_TIPO_BATIMENTO, 1]);
}

export function pacotePararBatimento(): Uint8Array {
  return pacoteColmi(COLMI_REALTIME_PARAR, [COLMI_TIPO_BATIMENTO, 0, 0]);
}

/**
 * Meia-noite local daquele dia, escrita como se fosse UTC.
 * É assim que a pulseira indexa o histórico: o relógio dela é local.
 */
export function instanteHistorico(diasAtras: number, agora = new Date()): { bandTs: number; inicioLocal: Date } {
  const inicioLocal = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - diasAtras);
  const bandTs = Math.floor(Date.UTC(inicioLocal.getFullYear(), inicioLocal.getMonth(), inicioLocal.getDate()) / 1000);
  return { bandTs, inicioLocal };
}

export function pacoteHistoricoBatimento(bandTs: number): Uint8Array {
  return pacoteColmi(COLMI_CMD_HISTORICO_FC, [
    bandTs & 0xff,
    (bandTs >> 8) & 0xff,
    (bandTs >> 16) & 0xff,
    (bandTs >>> 24) & 0xff,
  ]);
}

/**
 * Junta os pacotes do comando 21 numa curva de 5 em 5 minutos.
 * Byte 0 no slot significa "não mediu". 0xFF no índice encerra sem dados.
 */
export function lerHistoricoBatimento(pacotes: Uint8Array[], inicioLocal: Date): PontoBatimento[] {
  let tamanho = 0;
  let bruto: number[] = [];
  let cursor = 0;
  let temCabecalho = false;

  for (const p of pacotes) {
    if (p.length < 2 || p[0] !== COLMI_CMD_HISTORICO_FC) continue;
    const indice = p[1];
    if (indice === 0xff) return [];
    if (indice === 0) {
      tamanho = p[2] ?? 0;
      bruto = new Array(tamanho * 13).fill(0);
      temCabecalho = true;
      continue;
    }
    if (indice === 1) {
      for (let i = 0; i < 9 && 6 + i < p.length; i++) bruto[i] = p[6 + i];
      cursor = 9;
      continue;
    }
    for (let i = 0; i < 13 && cursor + i < bruto.length && 2 + i < p.length; i++) bruto[cursor + i] = p[2 + i];
    cursor += 13;
  }

  if (!temCabecalho) return [];

  const pontos: PontoBatimento[] = [];
  const limite = Math.min(288, bruto.length);
  for (let i = 0; i < limite; i++) {
    const bpm = bruto[i];
    if (!fcPlausivel(bpm)) continue;
    pontos.push({
      bpm,
      at: new Date(inicioLocal.getTime() + i * 5 * 60 * 1000).toISOString(),
    });
  }
  return pontos;
}

/**
 * Batimento de uma notificação do canal, ou null se o pacote for outra coisa
 * (bateria, fim de medição, lixo).
 */
export function lerBatimentoColmi(data: DataView): number | null {
  if (data.byteLength < 4) return null;
  if (data.getUint8(0) !== COLMI_REALTIME) return null;
  if (data.getUint8(1) !== COLMI_TIPO_BATIMENTO) return null;
  if (data.getUint8(2) !== 0) return null;
  const bpm = data.getUint8(3);
  return bpm > 0 ? bpm : null;
}

/** O aparelho encerrou a medição sob demanda (o LED apaga). */
export function medicaoColmiEncerrou(data: DataView): boolean {
  return data.byteLength >= 3
    && data.getUint8(0) === COLMI_REALTIME
    && data.getUint8(1) === COLMI_TIPO_BATIMENTO
    && data.getUint8(2) !== 0;
}

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
