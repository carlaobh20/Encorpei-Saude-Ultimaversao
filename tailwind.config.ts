import type { Config } from "tailwindcss";
import tailwindAnimate from "tailwindcss-animate";

/**
 * Encorpei Cardio — Tailwind config
 *
 * Light-only. Tokens são definidos em src/index.css.
 * Dark mode descontinuado em maio/2026.
 */
export default {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans:    ["Inter", "system-ui", "-apple-system", "sans-serif"],
        display: ["Sora", "Inter", "system-ui", "sans-serif"],
        script:  ["Sora", "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "var(--text-2xs)",
      },
      colors: {
        border:          "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        "border-soft":   "hsl(var(--border-soft))",
        input:           "hsl(var(--input))",
        ring:            "hsl(var(--ring))",
        background:      "hsl(var(--background))",
        foreground:      "hsl(var(--foreground))",
        "foreground-soft": "hsl(var(--foreground-soft))",
        primary: {
          DEFAULT:     "hsl(var(--primary))",
          foreground:  "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:     "hsl(var(--secondary))",
          foreground:  "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:     "hsl(var(--destructive))",
          foreground:  "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:     "hsl(var(--muted))",
          foreground:  "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:     "hsl(var(--accent))",
          foreground:  "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:     "hsl(var(--popover))",
          foreground:  "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:     "hsl(var(--card))",
          foreground:  "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT:               "hsl(var(--sidebar-background))",
          foreground:            "hsl(var(--sidebar-foreground))",
          primary:               "hsl(var(--sidebar-primary))",
          "primary-foreground":  "hsl(var(--sidebar-primary-foreground))",
          accent:                "hsl(var(--sidebar-accent))",
          "accent-foreground":   "hsl(var(--sidebar-accent-foreground))",
          border:                "hsl(var(--sidebar-border))",
          ring:                  "hsl(var(--sidebar-ring))",
        },
        // ── Bloom brand ──
        cardio: {
          DEFAULT: "hsl(var(--brand-cardio))",
          dark:    "hsl(var(--brand-cardio-dark))",
          light:   "hsl(var(--brand-cardio-light))",
          50:      "hsl(var(--brand-cardio-50))",
          100:     "hsl(var(--brand-cardio-100))",
        },
        rose:  { DEFAULT: "hsl(var(--brand-rose))" },
        sepia: { DEFAULT: "hsl(var(--brand-sepia))", soft: "hsl(var(--brand-sepia-soft))" },
        peach: { DEFAULT: "hsl(var(--brand-peach))" },
        brand: {
          DEFAULT: "hsl(var(--brand-accent))",
          light:   "hsl(var(--brand-accent-light))",
          dark:    "hsl(var(--brand-accent-dark))",
          warm:    "hsl(var(--brand-warm))",
        },
        success: {
          DEFAULT: "hsl(var(--status-success))",
          bg:      "hsl(var(--status-success-bg))",
        },
        warning: {
          DEFAULT: "hsl(var(--status-warning))",
          bg:      "hsl(var(--status-warning-bg))",
        },
        error: {
          DEFAULT: "hsl(var(--status-danger))",
          bg:      "hsl(var(--status-danger-bg))",
        },
        info: {
          DEFAULT: "hsl(var(--status-info))",
          bg:      "hsl(var(--status-info-bg))",
        },
        accompany: {
          DEFAULT: "hsl(var(--status-accompany))",
          bg:      "hsl(var(--status-accompany-bg))",
        },
        domain: {
          body:      "hsl(var(--domain-body))",
          mind:      "hsl(var(--domain-mind))",
          spirit:    "hsl(var(--domain-spirit))",
          evolution: "hsl(var(--domain-evolution))",
        },
        surface: {
          1:    "hsl(var(--surface-1))",
          2:    "hsl(var(--surface-2))",
          3:    "hsl(var(--surface-3))",
          4:    "hsl(var(--surface-4))",
          warm: "hsl(var(--surface-warm))",
        },
      },
      borderRadius: {
        sm:    "var(--radius-sm)",
        md:    "var(--radius-md)",
        lg:    "var(--radius-lg)",
        xl:    "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
      },
      boxShadow: {
        flat:     "var(--shadow-flat)",
        card:     "var(--shadow-card)",
        raised:   "var(--shadow-raised)",
        floating: "var(--shadow-floating)",
        modal:    "var(--shadow-modal)",
        brand:    "var(--shadow-brand)",
        "brand-lg": "var(--shadow-brand-lg)",
        up:       "var(--shadow-up)",
        // legacy
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
      },
      transitionTimingFunction: {
        "out-soft":   "cubic-bezier(0.32, 0.72, 0.4, 1)",
        "out-spring": "cubic-bezier(0.18, 0.89, 0.32, 1.28)",
        "out-quart":  "cubic-bezier(0.25, 1, 0.5, 1)",
        "bloom":      "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        "fast":   "140ms",
        "soft":   "320ms",
        "slow":   "480ms",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.4s var(--ease-out-soft)",
        "scale-in":       "scale-in 0.25s var(--ease-out-soft)",
        "slide-up":       "slide-up 0.32s var(--ease-out-soft) both",
      },
    },
  },
  plugins: [tailwindAnimate],
} satisfies Config;
