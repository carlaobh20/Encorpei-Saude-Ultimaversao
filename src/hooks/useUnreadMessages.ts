import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Total de mensagens não lidas do médico, somando todas as threads ativas.
 * Uma consulta só — com 60 pacientes, uma por thread derrubaria o painel.
 */
export function useUnreadMessages(patientUserIds: string[]): number {
  const demo = !!getDevBypass();

  const { data } = useQuery({
    queryKey: [...queryKeys.messages.meta, patientUserIds.length],
    enabled: patientUserIds.length > 0 && !demo,
    staleTime: 30_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await (supabase as any)
        .from("patient_messages")
        .select("id")
        .in("patient_user_id", patientUserIds)
        .eq("sender", "patient")
        .is("read_at", null);
      if (error) throw error;
      return (data ?? []).length;
    },
  });

  if (demo) return 1;
  return data ?? 0;
}
