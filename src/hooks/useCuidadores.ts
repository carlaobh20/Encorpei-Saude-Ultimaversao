/**
 * MODO CUIDADOR — docs/ENGAJAMENTO-CARDIO.md §3.3 e §6.4
 *
 * Quem cuida da adesão do cardiopata de 68 anos, na prática, é a esposa ou a
 * filha. Dar a elas uma tela própria é a alavanca de retenção mais barata do
 * produto — e transforma o app em algo que a família pede para o pai usar.
 *
 * REGRAS QUE O CÓDIGO PRECISA MANTER:
 *  - Quem convida é o PACIENTE. Médico e clínica não cadastram cuidador.
 *  - O acesso é somente de leitura, e o paciente escolhe o que liberar.
 *  - É revogável pelo paciente a qualquer momento, sem pedir nada a ninguém.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { toastError } from "@/lib/errorHandler";
import { DEMO_CAREGIVERS } from "@/lib/demoData";
import type { CaregiverLink } from "@/types/cardio";

/* eslint-disable @typescript-eslint/no-explicit-any */

function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const PARENTESCOS = [
  "Esposa", "Marido", "Filha", "Filho", "Irmã", "Irmão",
  "Mãe", "Pai", "Cuidador(a)", "Outro",
] as const;

export interface PermissoesCuidador {
  ver_medidas: boolean;
  ver_remedios: boolean;
  ver_sintomas: boolean;
  ver_exames: boolean;
  receber_alertas: boolean;
}

export const PERMISSOES_ROTULO: Record<keyof PermissoesCuidador, { titulo: string; descricao: string }> = {
  ver_medidas: {
    titulo: "Ver minhas medidas",
    descricao: "Pressão, batimentos, peso, sono e atividade.",
  },
  ver_remedios: {
    titulo: "Ver meus remédios",
    descricao: "Quais remédios eu tomo e se marquei as doses do dia.",
  },
  ver_sintomas: {
    titulo: "Ver o que eu senti",
    descricao: "Sintomas que eu registrei, como falta de ar ou tontura.",
  },
  ver_exames: {
    titulo: "Ver meus exames",
    descricao: "Resultados de laboratório e exames do coração.",
  },
  receber_alertas: {
    titulo: "Receber avisos",
    descricao: "Ser avisado quando algo sair do meu padrão.",
  },
};

/** Lado do PACIENTE: quem cuida de mim. */
export function useMeusCuidadores() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();

  const query = useQuery({
    queryKey: ["cuidadores", user?.id ?? "demo"],
    enabled: !!user || demo,
    staleTime: 60_000,
    queryFn: async (): Promise<CaregiverLink[]> => {
      if (demo) return DEMO_CAREGIVERS;
      const { data, error } = await (supabase as any)
        .from("caregiver_links")
        .select("*")
        .eq("patient_user_id", user!.id)
        .neq("status", "revoked")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CaregiverLink[];
    },
  });

  const convidar = useMutation({
    mutationFn: async (input: { nome: string; parentesco?: string; email?: string } & Partial<PermissoesCuidador>) => {
      if (demo) { toast.info("Modo demo: o convite não é criado."); return gerarCodigo(); }
      const codigo = gerarCodigo();
      const { error } = await (supabase as any).from("caregiver_links").insert({
        patient_user_id: user!.id,
        caregiver_nome: input.nome,
        parentesco: input.parentesco ?? null,
        caregiver_email: input.email ?? null,
        invite_code: codigo,
        status: "pending",
        ver_medidas: input.ver_medidas ?? true,
        ver_remedios: input.ver_remedios ?? true,
        ver_sintomas: input.ver_sintomas ?? false,
        ver_exames: input.ver_exames ?? false,
        receber_alertas: input.receber_alertas ?? true,
      });
      if (error) throw error;
      return codigo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuidadores"] });
    },
    onError: (e: unknown) => toastError(e, "Não consegui criar o convite."),
  });

  const atualizarPermissoes = useMutation({
    mutationFn: async ({ id, ...permissoes }: { id: string } & Partial<PermissoesCuidador>) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any).from("caregiver_links").update(permissoes).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuidadores"] });
      toast.success("Permissões atualizadas.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui atualizar."),
  });

  const revogar = useMutation({
    mutationFn: async (id: string) => {
      if (demo) { toast.info("Modo demo: nada é salvo."); return; }
      const { error } = await (supabase as any)
        .from("caregiver_links")
        .update({ status: "revoked", revogado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cuidadores"] });
      toast.success("Acesso encerrado.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui encerrar o acesso."),
  });

  const lista = query.data ?? [];
  return {
    cuidadores: lista,
    ativos: lista.filter((c) => c.status === "active"),
    pendentes: lista.filter((c) => c.status === "pending"),
    isLoading: query.isLoading,
    convidar,
    atualizarPermissoes,
    revogar,
  };
}

/** Lado do CUIDADOR: de quem eu cuido. */
export function useDeQuemCuido() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = !!getDevBypass();

  const query = useQuery({
    queryKey: ["souCuidador", user?.id ?? "demo"],
    enabled: !!user && !demo,
    staleTime: 60_000,
    queryFn: async (): Promise<CaregiverLink[]> => {
      const { data, error } = await (supabase as any)
        .from("caregiver_links")
        .select("*")
        .eq("caregiver_user_id", user!.id)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as CaregiverLink[];
    },
  });

  const aceitarConvite = useMutation({
    mutationFn: async (codigo: string) => {
      if (demo) { toast.info("Modo demo: o convite não é aceito."); return; }
      const { data, error } = await (supabase as any)
        .from("caregiver_links")
        .update({
          caregiver_user_id: user!.id,
          status: "active",
          aceito_em: new Date().toISOString(),
        })
        .eq("invite_code", codigo.trim().toUpperCase())
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Código não encontrado ou já usado.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["souCuidador"] });
      toast.success("Pronto. Agora você acompanha essa pessoa.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui usar esse código."),
  });

  return { vinculos: query.data ?? [], isLoading: query.isLoading, aceitarConvite };
}
