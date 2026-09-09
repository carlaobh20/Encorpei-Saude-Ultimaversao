/**
 * ─────────────────────────────────────────────────────────────
 * TOKENS · fundação compartilhada do Design System
 * Encorpei Mamãe · Sprint 1.5 · 04/08/2026
 * ─────────────────────────────────────────────────────────────
 *
 * O QUE ESTE ARQUIVO É
 * Um espelho em TypeScript dos design tokens que HOJE já vivem em
 * `src/index.css` (variáveis CSS) e em `tailwind.config.ts`. Cada valor aqui
 * foi copiado do que está em produção — este arquivo NÃO introduz nenhum valor
 * novo e NÃO muda nada visualmente.
 *
 * POR QUE ELE EXISTE
 * `components/bloom/` (paciente) e `components/shell/` (médico) são duas
 * superfícies deliberadamente diferentes. Elas não devem ser fundidas, mas
 * precisam compartilhar a MESMA fundação: mesma cor, mesma escala tipográfica,
 * mesmo raio, mesma sombra, mesma curva de animação. Sem uma fonte única,
 * cada tela nova reinventa esses valores e a inconsistência cresce sozinha.
 *
 * COMO USAR
 * 1. Preferência nº 1 — classe Tailwind (`rounded-xl`, `shadow-card`,
 *    `text-muted-foreground`). Continua sendo o caminho normal.
 * 2. Use estes tokens quando precisar do valor em JavaScript: props de
 *    componente, cálculo, animação em Framer Motion, style inline, gráfico
 *    do Recharts.
 *
 * REGRA
 * Ao mudar um valor visual, mude em `src/index.css` E aqui, juntos. Este
 * arquivo é espelho, não fonte paralela de verdade.
 */

// ─────────────────────────────────────────────────────────────
// COR
// Os valores vivem como variáveis CSS em HSL. Referenciar via `hsl(var(--x))`
// mantém tema e contraste corretos. Para hex direto (Recharts, canvas, SVG),
// use `@/theme/colors`, que já existe e continua sendo a fonte de hex.
// ─────────────────────────────────────────────────────────────

export const color = {
  // Marca
  primary: "hsl(var(--primary))",
  primaryForeground: "hsl(var(--primary-foreground))",
  secondary: "hsl(var(--secondary))",
  secondaryForeground: "hsl(var(--secondary-foreground))",
  accent: "hsl(var(--accent))",

  // Superfícies
  background: "hsl(var(--background))",
  surfaceWarm: "hsl(var(--surface-warm))",
  surface1: "hsl(var(--surface-1))",
  surface2: "hsl(var(--surface-2))",
  surface3: "hsl(var(--surface-3))",
  surface4: "hsl(var(--surface-4))",
  card: "hsl(var(--card))",
  popover: "hsl(var(--popover))",

  // Texto
  foreground: "hsl(var(--foreground))",
  foregroundSoft: "hsl(var(--foreground-soft))",
  muted: "hsl(var(--muted))",
  mutedForeground: "hsl(var(--muted-foreground))",

  // Linhas
  border: "hsl(var(--border))",
  borderStrong: "hsl(var(--border-strong))",
  borderSoft: "hsl(var(--border-soft))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",

  // Estado clínico
  success: "hsl(var(--status-success))",
  warning: "hsl(var(--status-warning))",
  danger: "hsl(var(--status-danger))",
  info: "hsl(var(--status-info))",
  successBg: "hsl(var(--status-success-bg))",
  warningBg: "hsl(var(--status-warning-bg))",
  dangerBg: "hsl(var(--status-danger-bg))",
  infoBg: "hsl(var(--status-info-bg))",
  destructive: "hsl(var(--destructive))",
} as const;

// ─────────────────────────────────────────────────────────────
// TIPOGRAFIA
// ─────────────────────────────────────────────────────────────

export const font = {
  display: "var(--font-display)", // Fraunces — títulos
  script: "var(--font-script)",   // Instrument Serif — decorativo
  sans: "var(--font-sans)",       // Inter — corpo
} as const;

/** Escala de tamanho. Espelha --text-* do index.css. */
export const fontSize = {
  "2xs": "0.6875rem", // 11px — legendas de gráfico, metadados
  xs: "0.75rem",      // 12px — label, badge
  sm: "0.8125rem",    // 13px — caption, texto auxiliar
  base: "0.9375rem",  // 15px — corpo padrão
  md: "1rem",         // 16px — corpo enfatizado
  lg: "1.125rem",     // 18px — subtítulo
  xl: "1.375rem",     // 22px — título de seção
  "2xl": "1.75rem",   // 28px — título de página
  "3xl": "2.25rem",   // 36px — display
  "4xl": "3rem",      // 48px — hero
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/**
 * Papéis tipográficos. Nomeia o que cada nível SIGNIFICA, para que bloom e
 * shell escolham pelo papel e não pelo tamanho. Os valores são os que já
 * estão em uso — nenhuma tela muda por existir este mapa.
 */
export const typeRole = {
  display: { size: fontSize["3xl"], weight: fontWeight.medium, family: font.display, tracking: "-0.025em" },
  heading: { size: fontSize["2xl"], weight: fontWeight.medium, family: font.display, tracking: "-0.025em" },
  title:   { size: fontSize.xl,     weight: fontWeight.semibold, family: font.sans, tracking: "-0.01em" },
  subtitle:{ size: fontSize.lg,     weight: fontWeight.medium,   family: font.sans, tracking: "0" },
  body:    { size: fontSize.base,   weight: fontWeight.regular,  family: font.sans, tracking: "0" },
  caption: { size: fontSize.sm,     weight: fontWeight.regular,  family: font.sans, tracking: "0" },
  label:   { size: fontSize.xs,     weight: fontWeight.medium,   family: font.sans, tracking: "0.01em" },
} as const;

export type TypeRole = keyof typeof typeRole;

// ─────────────────────────────────────────────────────────────
// ESPAÇAMENTO — grid de 4px
// ─────────────────────────────────────────────────────────────

export const space = {
  0: "0",
  1: "0.25rem",  // 4px
  2: "0.5rem",   // 8px
  3: "0.75rem",  // 12px
  4: "1rem",     // 16px
  5: "1.25rem",  // 20px
  6: "1.5rem",   // 24px
  8: "2rem",     // 32px
  10: "2.5rem",  // 40px
  12: "3rem",    // 48px
  16: "4rem",    // 64px
} as const;

/** Espaçamentos semânticos — espelham --space-* do index.css. */
export const layout = {
  pageX: "1.25rem",   // 20px — respiro lateral no mobile
  pageY: "1.5rem",    // 24px
  section: "2.5rem",  // 40px — entre seções principais
  card: "1.25rem",    // 20px — padding padrão de card
  cardLg: "1.5rem",   // 24px
} as const;

// ─────────────────────────────────────────────────────────────
// RAIO
// ─────────────────────────────────────────────────────────────

export const radius = {
  sm: "0.625rem",  // 10px — pills pequenas
  md: "0.875rem",  // 14px — botões
  lg: "1rem",      // 16px — inputs, badges
  xl: "1.25rem",   // 20px — cards (padrão)
  "2xl": "1.5rem", // 24px — hero cards
  "3xl": "1.75rem",// 28px — destaque
  full: "9999px",
} as const;

// ─────────────────────────────────────────────────────────────
// ELEVAÇÃO — 5 níveis. A sombra é quente (--shadow-color), nunca cinza.
// ─────────────────────────────────────────────────────────────

export const elevation = {
  /** 0 — plano: só borda, sem sombra */
  flat: "var(--shadow-flat)",
  /** 1 — card em repouso (padrão) */
  card: "var(--shadow-card)",
  /** 2 — hover / elevado */
  raised: "var(--shadow-raised)",
  /** 3 — flutuante: popover, FAB */
  floating: "var(--shadow-floating)",
  /** 4 — modal / bottom sheet */
  modal: "var(--shadow-modal)",
  /** botão primário — sombra colorida da marca */
  brand: "var(--shadow-brand)",
  brandLg: "var(--shadow-brand-lg)",
  /** barra inferior — sombra para cima */
  up: "var(--shadow-up)",
} as const;

export type ElevationLevel = keyof typeof elevation;

// ─────────────────────────────────────────────────────────────
// MOVIMENTO
// ─────────────────────────────────────────────────────────────

export const easing = {
  outSoft: "cubic-bezier(0.32, 0.72, 0.4, 1)",
  outSpring: "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
  outQuart: "cubic-bezier(0.25, 1, 0.5, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const duration = {
  fast: 140,    // feedback de toque, hover
  normal: 220,  // transição padrão
  soft: 320,    // entrada de card, expansão
  slow: 480,    // transição de página
} as const;

/** Mesmas curvas em array, no formato que o Framer Motion espera. */
export const motionEase = {
  outSoft: [0.32, 0.72, 0.4, 1],
  outSpring: [0.18, 0.89, 0.32, 1.28],
  outQuart: [0.25, 1, 0.5, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** Presets prontos de Framer Motion — evita cada tela inventar o seu. */
export const motionPreset = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: duration.soft / 1000, ease: motionEase.outSoft },
  },
  slideUp: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duration.soft / 1000, ease: motionEase.outSoft },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: duration.normal / 1000, ease: motionEase.outSoft },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// CAMADAS (z-index)
// Antes desta sprint não havia escala: as telas usavam z-10/30/40/50/[100]
// soltos. Os números abaixo são exatamente os que já estão em uso — nomeá-los
// é o que impede a próxima tela de inventar um z-[9999].
// ─────────────────────────────────────────────────────────────

export const zIndex = {
  /** conteúdo elevado dentro da página (badge sobre imagem, overlay de card) */
  raised: 10,
  /** cabeçalho de abas grudado no topo (HubTabs) */
  stickyTabs: 30,
  /** barra de navegação, FAB, barra de ação fixa, header do shell */
  navigation: 40,
  /** diálogo, drawer, bottom sheet e seu overlay */
  overlay: 50,
  /** toast — sempre acima de tudo, inclusive de modal */
  toast: 100,
} as const;

export type ZLayer = keyof typeof zIndex;

// ─────────────────────────────────────────────────────────────
// BREAKPOINTS — os mesmos do Tailwind, com o container 2xl do projeto.
// Valores em px para uso em matchMedia / lógica de JS.
// ─────────────────────────────────────────────────────────────

export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,  // fronteira mobile ↔ desktop do app (lg:hidden é o padrão usado)
  xl: 1280,
  "2xl": 1400,
} as const;

export const mediaQuery = {
  sm: `(min-width: ${breakpoint.sm}px)`,
  md: `(min-width: ${breakpoint.md}px)`,
  lg: `(min-width: ${breakpoint.lg}px)`,
  xl: `(min-width: ${breakpoint.xl}px)`,
  "2xl": `(min-width: ${breakpoint["2xl"]}px)`,
  /** o app trata < lg como mobile */
  mobile: `(max-width: ${breakpoint.lg - 1}px)`,
  /** respeita quem desligou animação no sistema */
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

// ─────────────────────────────────────────────────────────────
// ALVOS DE TOQUE — mínimo acessível, já praticado no app
// ─────────────────────────────────────────────────────────────

export const touchTarget = {
  /** mínimo absoluto para qualquer elemento clicável (WCAG 2.1 AA) */
  min: 44,
  /** altura padrão de botão */
  button: 44,
  /** chip / pill de seleção (ex.: chips de sintoma) */
  chip: 36,
} as const;

// ─────────────────────────────────────────────────────────────

export const tokens = {
  color,
  font,
  fontSize,
  fontWeight,
  typeRole,
  space,
  layout,
  radius,
  elevation,
  easing,
  duration,
  motionEase,
  motionPreset,
  zIndex,
  breakpoint,
  mediaQuery,
  touchTarget,
} as const;

export default tokens;
