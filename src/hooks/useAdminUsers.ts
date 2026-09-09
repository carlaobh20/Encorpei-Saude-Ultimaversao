/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/contexts/AuthContext";

export interface AdminUser {
  user_id: string;
  email: string;
  full_name: string;
  is_patient: boolean;
  is_professional: boolean;
  professional_id: string | null;
  professional_approval_status: string | null;
  registration_number: string | null;
  patient_due_date: string | null;
  created_at: string;
}

/**
 * Lista unificada de usuários (pacientes + médicos) pro painel admin, via
 * admin_list_users (a própria função confere que quem chamou é admin —
 * ver docs/migrations/20260825_admin_usuarios_excluir.sql).
 */
export function useAdminUsers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.admin.users,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_users" as any);
      if (error) throw error;
      return (data ?? []) as AdminUser[];
    },
  });
}

export interface AdminDeleteUserResult {
  ok: boolean;
  email: string;
  era_paciente: boolean;
  era_medico: boolean;
  linhas_apagadas: Record<string, number>;
}

/**
 * Exclusão DEFINITIVA de um usuário — login (auth.users) e todo o
 * histórico. Irreversível; a tela que chama isso exige a pessoa digitar o
 * e-mail do usuário antes de confirmar (ver AdminUsersPage.tsx).
 */
export function useAdminDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await (supabase as any).rpc("admin_delete_user" as any, { p_user_id: userId });
      if (error) throw error;
      return data as unknown as AdminDeleteUserResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
  });
}
