/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export interface ProfessionalMetrics {
  professional_id: string;
  invites_generated: number;
  invites_used: number;
  active_patients: number;
}

/**
 * Métricas de convite/vínculo por médico, todas de uma vez (uma linha por
 * médico) — via a função admin_professional_metrics (a própria função
 * confere que quem chamou é admin; ver
 * docs/migrations/20260825_admin_medico_metricas.sql).
 *
 * "invites_generated" conta toda linha que já existiu em
 * professional_patient_links (convite pendente ou já usado) — convites
 * revogados pelo médico são excluídos de verdade da tabela e não entram
 * aqui, então o percentual reflete os convites que ainda existem.
 */
export function useAdminProfessionalMetrics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.professionalMetrics,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_professional_metrics" as any);
      if (error) throw error;
      const rows = (data ?? []) as ProfessionalMetrics[];
      const byProfessional = new Map<string, ProfessionalMetrics>();
      for (const row of rows) byProfessional.set(row.professional_id, row);
      return byProfessional;
    },
  });
}

export interface AdminProfessionalPatient {
  patient_user_id: string;
  full_name: string;
  status: string;
  started_at: string | null;
  created_at: string;
}

/**
 * Lista de pacientes já vinculadas a um médico específico (nome + status
 * do vínculo, sem nenhum dado clínico) — via admin_professional_patients.
 * Buscada sob demanda (enabled) quando o admin abre "Ver pacientes" no
 * card do médico, não para todo mundo de uma vez.
 */
export function useAdminProfessionalPatients(professionalId: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.professionalPatients(professionalId),
    enabled: !!user && enabled && !!professionalId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_professional_patients" as any, {
        p_professional_id: professionalId,
      });
      if (error) throw error;
      return (data ?? []) as AdminProfessionalPatient[];
    },
  });
}
