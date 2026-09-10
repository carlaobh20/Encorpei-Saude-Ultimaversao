/**
 * ══════════════════════════════════════════════════════════════════════
 * DESIGN SYSTEM — Encorpei Cardio
 * ══════════════════════════════════════════════════════════════════════
 *
 * Fonte única de verdade para cores (hex) do Encorpei Cardio.
 * Paleta light healthtech · cardio · sépia · acolhedora.
 */

export const colors = {
  // Brand — azul clínico
  primary:       "#1F5FA9",     // azul clínico
  primaryDark:   "#16406F",
  primaryLight:  "#7FA9D9",
  primarySoft:   "#EEF4FB",

  // Secondary (sépia)
  secondary:     "#4E9CB8",
  secondarySoft: "#E4F1F6",
  secondaryBg:   "#EEF4FB",

  // Surfaces
  background:        "#F2F5F9",
  surface:           "#FFFFFF",
  surfaceElevated:   "#FFFFFF",
  surfaceWarm:       "#FAFCFE",

  // Aliases sem dark (compatibilidade)
  surfaceDark:         "#F2F5F9",
  surfaceDarkElevated: "#FFFFFF",

  // Texto
  textPrimary:    "#1F2937",
  textSecondary:  "#6B7280",
  textMuted:      "#9CA3AF",
  textOnDark:     "#1F2937",
  textOnDarkMuted:"#6B7280",
  textOnDarkFaint:"#9CA3AF",

  // Bordas
  border:       "#DDE4EE",
  borderLight:  "#EAF0F7",
  borderDark:   "#CDD7E4",
  borderStrong: "#CDD7E4",

  // Status (Bloom v2)
  success:      "#4CAF50",
  successLight: "#E8F4EA",
  successDark:  "#2E7D32",

  warning:      "#F59E0B",
  warningLight: "#FEF3E2",
  warningDark:  "#B45309",

  error:        "#DC2626",
  errorLight:   "#FCE9E9",
  errorDark:    "#991B1B",

  info:         "#4A6FA5",    // azul mais suave/elegante (v2)
  infoLight:    "#E6ECF5",
  infoDark:     "#2E4A78",

  // Domínios clínicos (usados em gráficos e ícones de hub)
  pressao:   "#1F5FA9",   // azul — pressão arterial
  coracao:   "#D64545",   // vermelho vital — FC, ritmo
  sono:      "#7C6BC4",   // roxo — sono
  atividade: "#3E9E5B",   // verde — atividade física
  metabolico:"#E08D2F",   // âmbar — glicemia, lipídios

  // Landing
  landing:     "#1F5FA9",
  landingDark: "#0E2A47",
  landingText: "#1F2937",

  // Demo mode
  demoGold: "#C9A84C",
} as const;

// ── Aliases semânticos ──────────────────────────────────────────────

export const brand = {
  accent:      colors.primary,
  accentDark:  colors.primaryDark,
  accentLight: colors.primaryLight,
  accentSoft:  colors.primarySoft,
} as const;

export const clinical = {
  green:    colors.success,
  greenBg:  colors.successLight,
  yellow:   colors.warning,
  yellowBg: colors.warningLight,
  red:      colors.error,
  redBg:    colors.errorLight,
} as const;


// ── Compatibility re-exports ────────────────────────────────────────

export const BRAND            = colors.primary;
export const BRAND_DARK       = colors.primaryDark;
export const BRAND_LIGHT      = colors.primarySoft;
export const PRO_BLUE         = colors.info;
export const PRO_BLUE_DARK    = colors.infoDark;
export const ALERT_RED        = colors.error;
export const LANDING_BLUE     = colors.landing;
export const LANDING_BLUE_LIGHT = colors.primaryLight;
export const DEMO_GOLD        = colors.demoGold;


/** Cores por domínio clínico — usadas nos gráficos do painel e do paciente. */
export const DOMAIN_COLORS = {
  pressao: colors.pressao,
  coracao: colors.coracao,
  sono: colors.sono,
  atividade: colors.atividade,
  metabolico: colors.metabolico,
} as const;
