import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { monitor } from "@/lib/monitor";
import type { User, Session } from "@supabase/supabase-js";
import { getDevBypass, clearDevBypass } from "./DevBypass";
import { clearLocalClinicalData } from "@/lib/security";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isDevMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
  isDevMode: false,
});

/** Cria um objeto User fake para dev bypass */
function makeFakeUser(userId: string, name: string): User {
  return {
    id: userId,
    email: `dev+${userId}@encorpei.test`,
    app_metadata: {},
    user_metadata: { full_name: name },
    aud: "authenticated",
    created_at: new Date().toISOString(),
  } as unknown as User;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypass = getDevBypass();

  const [user, setUser] = useState<User | null>(
    bypass ? makeFakeUser(bypass.userId, bypass.name) : null
  );
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!bypass); // se bypass ativo, não precisa esperar
  const [isDevMode] = useState(!!bypass);
  const signUpRef = useRef(new Set<string>());

  useEffect(() => {
    // Se dev bypass ativo, não conectar ao Supabase auth
    if (bypass) return;

    const signUpHandled = signUpRef.current;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        monitor.setUser(session?.user?.id ?? null);

        // Conquista "Primeira Pegada" (herança do Encorpei Saúde) removida:
        // inseria uma linha em `conquistas` a cada login, sem uso no Mamãe.
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    if (isDevMode) {
      clearDevBypass();
      clearLocalClinicalData();
      window.location.href = "/landing";
      return;
    }
    await supabase.auth.signOut();
    // Dispositivo pode ser compartilhado: nenhum dado clínico ou de sessão
    // pode sobreviver ao logout (cache de queries, filas offline, buffers).
    clearLocalClinicalData();
  }, [isDevMode]);

  const value = useMemo(
    () => ({ user, session, loading, signOut, isDevMode }),
    [user, session, loading, signOut, isDevMode],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
