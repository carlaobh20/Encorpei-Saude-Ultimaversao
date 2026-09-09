/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import type { ProfessionalProfile } from "@/hooks/useProfessional";

type ProfessionalApprovalStatus = "pending" | "approved" | "rejected";
type ProfessionalProfileFull = ProfessionalProfile & { phone?: string | null };

/**
 * Lista de médicos pro painel admin — aprovação de cadastro
 * (docs/migrations/20260826_medico_aprovacao.sql).
 */
export function useAdminProfessionals(statusFilter?: ProfessionalApprovalStatus | "all") {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.admin.professionals, statusFilter ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      // `any` no builder: a inferência profunda do supabase-js estourava
      // (TS2589 "excessively deep"). Não muda o comportamento em runtime.
      let query: any = supabase
        .from("professional_profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") query = query.eq("approval_status" as any, statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ProfessionalProfileFull[];
    },
  });
}

/** Aprova um médico — libera acesso ao painel pro. */
export function useApproveProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("professional_profiles")
        .update({ approval_status: "approved", is_verified: true, rejection_reason: null } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}

/** Recusa um médico, com motivo — o médico vê esse motivo na tela dele. */
export function useRejectProfessional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("professional_profiles")
        .update({ approval_status: "rejected", is_verified: false, rejection_reason: input.reason.trim() } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}
