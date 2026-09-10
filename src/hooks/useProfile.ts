/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDevBypass, DEV_PROFILE } from "@/contexts/DevBypass";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export function useProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile = null, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.profile.user,
    queryFn: async () => {
      // Dev bypass — retorna perfil mock
      if (getDevBypass()) return DEV_PROFILE as unknown as Profile;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      // maybeSingle() retorna null (sem erro) quando não há perfil ainda.
      if (error) throw error;
      return (data as unknown as Profile) ?? null;
    },
    enabled: !!user || !!getDevBypass(),
  });

  const updateProfile = useMutation({
    mutationFn: async (updates: Partial<Profile>) => {
      // upsert e não update: se por qualquer motivo a linha não existir
      // (conta criada antes do trigger, importação, replicação atrasada), o
      // UPDATE afetaria 0 linhas SEM erro — e o onboarding entrava em loop.
      const { error } = await (supabase as any)
        .from("profiles")
        .upsert({ ...(updates as any), user_id: user!.id }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.profile.all });
      toast.success("Salvo.");
    },
    onError: () => toast.error("Algo saiu diferente do esperado."),
  });

  return { profile, loading: isLoading, isFetching, updateProfile };
}
