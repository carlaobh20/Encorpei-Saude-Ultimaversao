import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { clearDevBypass, getDevBypass, setDevBypass } from "./DevBypass";

/**
 * Modo demonstração. O conteúdo vem de `@/lib/demoData` (fixo e determinístico);
 * este contexto só liga e desliga, e existe para que qualquer tela possa
 * perguntar "estou em demo?" sem ler localStorage na mão.
 */
interface DemoContextType {
  isDemoMode: boolean;
  role: "paciente" | "medico" | null;
  enableDemo: (role: "paciente" | "medico") => void;
  disableDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  role: null,
  enableDemo: () => {},
  disableDemo: () => {},
});

export function DemoProvider({ children }: { children: ReactNode }) {
  const inicial = getDevBypass();
  const [role, setRole] = useState<"paciente" | "medico" | null>(inicial?.role ?? null);

  const enableDemo = useCallback((r: "paciente" | "medico") => {
    setDevBypass(r);
    setRole(r);
  }, []);

  const disableDemo = useCallback(() => {
    clearDevBypass();
    setRole(null);
  }, []);

  const value = useMemo(
    () => ({ isDemoMode: role !== null, role, enableDemo, disableDemo }),
    [role, enableDemo, disableDemo],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export const useDemo = () => useContext(DemoContext);
