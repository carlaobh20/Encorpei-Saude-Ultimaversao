/**
 * Ligação fixa da pulseira — só o que o repositório já sabe pedir.
 *
 * Sono, oxigenação, passos e pressão estimada continuam no arquivo
 * importado. Esta camada não inventa comando, UUID de serviço nem pacote.
 * iPhone não fala Bluetooth pelo navegador: o caminho é o arquivo.
 */

export const MEDIDAS_NA_LIGACAO = ["heart_rate"] as const;

export const MEDIDAS_SO_NO_ARQUIVO = ["spo2", "steps", "sleep", "blood_pressure"] as const;

export const AVISO_IPHONE =
  "O iPhone não permite Bluetooth pelo navegador. Os dados entram pelo arquivo exportado do aplicativo do aparelho.";

export const MAX_RETOMADAS = 3;

const CHAVE_FILA = "encorpei.hr.outbox";

export function medidaEntraNaLigacao(medida: string): boolean {
  return (MEDIDAS_NA_LIGACAO as readonly string[]).includes(medida);
}

export interface AmbienteBluetooth {
  userAgent: string;
  temBluetooth: boolean;
  seguro: boolean;
  temGetDevices: boolean;
}

export function ambienteDaqui(nav: {
  userAgent: string;
  bluetooth?: { getDevices?: unknown } | null;
  secure: boolean;
}): AmbienteBluetooth {
  return {
    userAgent: nav.userAgent,
    temBluetooth: !!nav.bluetooth,
    seguro: nav.secure,
    temGetDevices: typeof nav.bluetooth?.getDevices === "function",
  };
}

export function ehIphone(userAgent: string): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent);
}

/**
 * null = o app pode tentar o aparelho já autorizado, sem seletor e sem arquivo.
 * Qualquer outra frase é um bloqueio. Nunca afirma que o iPhone conecta.
 */
export function bloqueioDeRetomada(a: AmbienteBluetooth): string | null {
  if (ehIphone(a.userAgent)) return AVISO_IPHONE;
  if (!a.temBluetooth || !a.seguro) {
    return "Este navegador não retoma a pulseira sozinho. Conecte no Chrome ou no Edge, ou importe o arquivo.";
  }
  if (!a.temGetDevices) {
    return "Este navegador não lembra o aparelho. Toque em conectar, ou importe o arquivo.";
  }
  return null;
}

export function escolherPermitido<T extends { id: string }>(
  lista: T[],
  externalId: string | null | undefined,
): T | null {
  if (!externalId) return null;
  return lista.find((d) => d.id === externalId) ?? null;
}

export type EfeitoLigacao =
  | { tipo: "manter" }
  | { tipo: "retomar" }
  | { tipo: "enfileirar" }
  | { tipo: "arquivo" }
  | { tipo: "desconectar" };

export function efeitoDaLigacao(
  evento: "saiu-da-pagina" | "queda-radio" | "falha-rede" | "encerrar" | "iphone",
): EfeitoLigacao {
  switch (evento) {
    case "saiu-da-pagina":
      return { tipo: "manter" };
    case "queda-radio":
      return { tipo: "retomar" };
    case "falha-rede":
      return { tipo: "enfileirar" };
    case "encerrar":
      return { tipo: "desconectar" };
    case "iphone":
      return { tipo: "arquivo" };
  }
}

export function deveRetomarAposQueda(jaTentou: number): boolean {
  return jaTentou < MAX_RETOMADAS;
}

export interface BatimentoPendente {
  at: string;
  bpm: number;
  deviceName: string;
  deviceId: string | null;
}

export function acrescentarPendente(fila: BatimentoPendente[], item: BatimentoPendente): BatimentoPendente[] {
  if (fila.some((p) => p.at === item.at && p.bpm === item.bpm)) return fila;
  return [...fila, item];
}

export function filaAposFlush(fila: BatimentoPendente[], gravou: boolean[]): BatimentoPendente[] {
  return fila.filter((_, i) => !gravou[i]);
}

export function algumGravou(gravou: boolean[]): boolean {
  return gravou.some(Boolean);
}

type Memoria = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};

export function lerFila(storage: Pick<Memoria, "getItem">): BatimentoPendente[] {
  try {
    const raw = storage.getItem(CHAVE_FILA);
    if (!raw) return [];
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is BatimentoPendente => {
      if (!x || typeof x !== "object") return false;
      const item = x as BatimentoPendente;
      return typeof item.at === "string" && typeof item.bpm === "number" && typeof item.deviceName === "string";
    });
  } catch {
    return [];
  }
}

export function salvarFila(storage: Pick<Memoria, "setItem" | "removeItem">, fila: BatimentoPendente[]) {
  if (fila.length === 0) storage.removeItem(CHAVE_FILA);
  else storage.setItem(CHAVE_FILA, JSON.stringify(fila));
}

export function guardarPendente(item: BatimentoPendente, storage: Memoria = localStorage) {
  salvarFila(storage, acrescentarPendente(lerFila(storage), item));
}

export function descartarPendente(item: { at: string; bpm: number }, storage: Memoria = localStorage) {
  salvarFila(
    storage,
    lerFila(storage).filter((p) => p.at !== item.at || p.bpm !== item.bpm),
  );
}
