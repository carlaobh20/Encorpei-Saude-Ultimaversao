import type { CardioComorbidities, CardioHistory } from "@/types/cardio";

type FlagComorbidade = Exclude<keyof CardioComorbidities, "egfr">;
type FlagHistoria = Exclude<keyof CardioHistory, "lvef" | "nyha_class" | "device_implant">;

/** Chips de comorbidade do passo "Sua saúde". */
export const COMORBIDADE_CHIPS: { key: FlagComorbidade; label: string; hint?: string }[] = [
  { key: "hypertension", label: "Pressão alta", hint: "hipertensão" },
  { key: "diabetes", label: "Diabetes" },
  { key: "dyslipidemia", label: "Colesterol alto", hint: "dislipidemia" },
  { key: "ckd", label: "Doença nos rins" },
  { key: "sleep_apnea", label: "Apneia do sono" },
  { key: "hypothyroidism", label: "Hipotireoidismo" },
  { key: "copd", label: "Asma ou DPOC" },
];

/** História cardio do mesmo passo — anamnese que o escore já lê. */
export const HISTORIA_CHIPS: { key: FlagHistoria; label: string; hint?: string }[] = [
  { key: "previous_mi", label: "Infarto", hint: "ataque do coração" },
  { key: "heart_failure", label: "Insuficiência cardíaca", hint: "coração fraco" },
  { key: "atrial_fibrillation", label: "Arritmia", hint: "fibrilação atrial" },
  { key: "pci", label: "Stent", hint: "angioplastia" },
  { key: "cabg", label: "Ponte de safena" },
  { key: "stroke_tia", label: "AVC", hint: "derrame" },
  { key: "family_early_cad", label: "Coração precoce na família" },
];

export const OBJETIVO_CHIPS: { k: string; l: string }[] = [
  { k: "saude", l: "Saúde geral" },
  { k: "cardiovascular", l: "Coração" },
  { k: "peso", l: "Peso" },
  { k: "outros", l: "Outros" },
];

export const OBJETIVO_ROTULO: Record<string, string> = Object.fromEntries(
  OBJETIVO_CHIPS.map((o) => [o.k, o.l]),
);

export const SEXO_LABEL: Record<string, string> = { male: "Masculino", female: "Feminino" };

export function rotulosComorbidades(c?: CardioComorbidities | null): string[] {
  if (!c) return [];
  return COMORBIDADE_CHIPS.filter((chip) => Boolean(c[chip.key])).map((chip) => chip.label);
}

export function rotulosHistoria(h?: CardioHistory | null): string[] {
  if (!h) return [];
  const chips = HISTORIA_CHIPS.filter((chip) => Boolean(h[chip.key])).map((chip) => chip.label);
  if (h.device_implant === "pacemaker") chips.push("Marcapasso");
  return chips;
}

export function alergiasEmLista(texto?: string | null): string[] {
  if (!texto?.trim()) return [];
  return texto.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

export function iniciais(nome?: string | null): string {
  if (!nome?.trim()) return "?";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function algumaComorbidadeChip(c?: CardioComorbidities | null): boolean {
  if (!c) return false;
  return COMORBIDADE_CHIPS.some((chip) => Boolean(c[chip.key]));
}

export function algumaHistoriaChip(h?: CardioHistory | null): boolean {
  if (!h) return false;
  return HISTORIA_CHIPS.some((chip) => Boolean(h[chip.key])) || h.device_implant === "pacemaker";
}

/** Zera só os chips — preserva campos que o médico pode ter preenchido (TFG, etc.). */
export function limparComorbidadesChip(c: CardioComorbidities): CardioComorbidities {
  const next = { ...c };
  for (const chip of COMORBIDADE_CHIPS) next[chip.key] = false;
  next.obesity = false;
  return next;
}

export function limparHistoriaChip(h: CardioHistory): CardioHistory {
  const next = { ...h };
  for (const chip of HISTORIA_CHIPS) next[chip.key] = false;
  next.device_implant = null;
  return next;
}
