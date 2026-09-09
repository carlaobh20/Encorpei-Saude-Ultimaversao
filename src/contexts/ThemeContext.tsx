import { createContext, useContext, useEffect, type ReactNode } from "react";

/**
 * ThemeContext — neutralizado em maio/2026.
 * Bloom redesign descontinuou o dark mode.
 * Mantém a API para retrocompatibilidade dos imports existentes,
 * mas força sempre o modo light.
 */

type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ theme: "light", toggleTheme: () => {} });

/** Valor estável: Bloom é light-only, não há estado para variar. */
const THEME_VALUE: ThemeContextType = { theme: "light", toggleTheme: () => { /* no-op: Bloom is light-only */ } };

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    // Remove qualquer preferência salva — Bloom é light-only.
    try { localStorage.removeItem("encorpei-theme"); } catch { /* noop */ }
  }, []);

  return (
    <ThemeContext.Provider value={THEME_VALUE}>
      {children}
    </ThemeContext.Provider>
  );
}
