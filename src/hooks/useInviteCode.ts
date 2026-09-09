import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { useProfessionalProfile } from "./useProfessional";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export interface PendingInvite {
  id: string;
  invite_code: string | null;
  created_at: string;
}

export function useInviteCode() {
  const { profile } = useProfessionalProfile();
  const qc = useQueryClient();

  // Convites em branco (pending, sem paciente) já gerados por este médico.
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["pendingInvites", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("professional_patient_links")
        .select("id, invite_code, created_at")
        .eq("professional_id", profile!.id)
        .eq("status", "pending" as any)
        .is("patient_user_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingInvite[];
    },
  });

  // Gera um convite EM BRANCO: pending, sem patient_user_id.
  // O paciente reivindica depois digitando o código.
  const generateInvite = useMutation({
    mutationFn: async () => {
      if (getDevBypass()) { toast.info("Modo demo: dados não são salvos"); return null as any; }
      if (!profile?.id) {
        toast.error("Perfil profissional não encontrado. Complete o onboarding em /pro/onboarding.");
        throw new Error("missing_professional_profile");
      }
      const code = generateCode();
      const { data, error } = await supabase
        .from("professional_patient_links")
        .insert({
          professional_id: profile!.id,
          patient_user_id: null,
          status: "pending" as any,
          invite_code: code,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as { invite_code: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingInvites", profile?.id] });
      qc.invalidateQueries({ queryKey: queryKeys.professional.patients });
    },
  });

  const revokeInvite = useMutation({
    mutationFn: async (id: string) => {
      if (getDevBypass()) { toast.info("Modo demo: dados não são salvos"); return null as any; }
      const { error } = await supabase.from("professional_patient_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pendingInvites", profile?.id] }),
  });

  return { pendingInvites, generateInvite, revokeInvite };
}
