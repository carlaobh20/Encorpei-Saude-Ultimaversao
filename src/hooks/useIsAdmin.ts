/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { getDevBypass } from "@/contexts/DevBypass";

/**
 * Checa se o usuário logado tem o papel "admin" (tabela user_roles,
 * via a função has_role já existente no banco — evita reimplementar
 * a checagem client-side e evita recursão de RLS em user_roles).
 *
 * Modo demo nunca é admin: dev bypass não é uma conta real, então nem
 * chamamos o RPC (o id fake não é um uuid válido).
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const bypass = getDevBypass();

  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: [...queryKeys.admin.isAdmin, user?.id],
    enabled: !!user && !bypass,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (error) throw error;
      return !!data;
    },
  });

  if (bypass) return { isAdmin: false, isLoading: false };
  return { isAdmin, isLoading };
}
