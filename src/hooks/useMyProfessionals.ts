/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type LinkStatus = Database["public"]["Enums"]["link_status"];

export interface MyProfessional {
  link_id: string;
  professional_id: string;
  status: string;
  started_at: string | null;
  display_name: string;
  specialty: string;
  avatar_url: string | null;
  clinic_name: string | null;
  registration_number: string;
  is_verified: boolean;
  /** Telefone do consultório/médico (professional_profiles.phone) — usado no card de emergência (01/09/2026). */
  phone: string | null;
}

export function useMyProfessionals() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: professionals = [], isLoading } = useQuery({
    queryKey: ["myProfessionals", user?.id],
    enabled: !!user && !getDevBypass(),
    queryFn: async () => {
      const { data: links, error } = await supabase
        .from("professional_patient_links")
        .select("id, professional_id, status, started_at")
        .eq("patient_user_id", user!.id)
        .eq("status", "active" satisfies LinkStatus);
      if (error) throw error;
      if (!links.length) return [];

      const proIds = links.map((l) => l.professional_id);
      // `phone` existe no banco (verificado 01/09/2026) mas não nos types gerados.
      const { data: profiles } = await (supabase as any)
        .from("professional_profiles")
        .select("id, display_name, specialty, avatar_url, clinic_name, registration_number, is_verified, phone")
        .in("id", proIds) as { data: {
          id: string; display_name: string | null; specialty: string | null; avatar_url: string | null;
          clinic_name: string | null; registration_number: string | null; is_verified: boolean | null; phone: string | null;
        }[] | null };

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      return links.map((l): MyProfessional => {
        const p = profileMap.get(l.professional_id);
        return {
          link_id: l.id,
          professional_id: l.professional_id,
          status: l.status ?? "active",
          started_at: l.started_at,
          display_name: p?.display_name ?? "",
          specialty: p?.specialty ?? "",
          avatar_url: p?.avatar_url ?? null,
          clinic_name: p?.clinic_name ?? null,
          registration_number: p?.registration_number ?? "",
          is_verified: p?.is_verified ?? false,
          phone: p?.phone ?? null,
        };
      });
    },
  });

  const acceptInvite = useMutation({
    mutationFn: async (inviteCode: string) => {
      if (getDevBypass()) { toast.info("Modo demo: dados não são salvos"); return null as any; }
      // Reivindicação server-side: a função claim_invite valida o código e
      // faz o vínculo. O paciente NÃO lê a tabela de convites diretamente
      // (evita enumeração/sequestro de convites de terceiros).
      const { data, error } = await (supabase as any).rpc("claim_invite", {
        p_code: inviteCode.toUpperCase(),
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string; professional_id?: string } | null;
      if (!result?.ok) {
        throw new Error(
          result?.error === "not_authenticated"
            ? "Sua sessão expirou. Entre novamente."
            : "Código inválido ou já utilizado.",
        );
      }
      return { id: null, professional_id: result.professional_id };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myProfessionals"] }),
  });

  return { professionals, isLoading, acceptInvite };
}
