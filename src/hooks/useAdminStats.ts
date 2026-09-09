/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminStats {
  total_patients: number;
  total_professionals: number;
  pending_professionals: number;
  active_links: number;
  feedback_new: number;
  feedback_total: number;
  messages_last_24h: number;
}

/**
 * Números reais do painel administrativo, via a função admin_dashboard_stats
 * (a própria função checa que quem chamou é admin — ver migration
 * docs/migrations/20260825_admin_feedback.sql).
 */
export function useAdminStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.stats,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_dashboard_stats" as any);
      if (error) throw error;
      return data as unknown as AdminStats;
    },
  });
}
