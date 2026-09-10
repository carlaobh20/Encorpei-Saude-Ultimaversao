/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * WHITE LABEL — a clínica do médico dentro do app do paciente
 * ══════════════════════════════════════════════════════════════════════
 *
 * O que muda com a marca do médico:
 *   - cabeçalho do app do paciente (logo + nome da clínica)
 *   - tela de login quando o paciente entra por um convite daquele médico
 *   - cabeçalho dos relatórios em PDF
 *   - cor de destaque (um token só: --brand)
 *
 * O que NÃO muda, de propósito:
 *   - o ícone do app instalado (PWA) e o nome na loja continuam Encorpei
 *     Cardio. Um PWA tem um manifesto por origem: um ícone por clínica
 *     exigiria um domínio e um build por clínica. Além disso, o produto que
 *     o paciente instala é a plataforma; a clínica é quem assina o cuidado
 *     dentro dela.
 *   - os textos clínicos. Marca é aparência. Regra clínica é regra clínica,
 *     e nenhuma clínica reescreve o que o app diz sobre sintoma de alarme.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";

export interface MarcaClinica {
  professionalId: string;
  medico: string;
  clinica: string | null;
  subtitulo: string | null;
  logoUrl: string | null;
  corMarca: string | null;
  telefone: string | null;
  endereco: string | null;
  site: string | null;
  crm: string | null;
}

/** Marca da casa — quando não há médico vinculado ou ele não personalizou. */
export const MARCA_PADRAO: MarcaClinica = {
  professionalId: "",
  medico: "",
  clinica: null,
  subtitulo: null,
  logoUrl: null,
  corMarca: null,
  telefone: null,
  endereco: null,
  site: null,
  crm: null,
};

const MARCA_DEMO: MarcaClinica = {
  professionalId: "demo-pro-001",
  medico: "Dr. Marcelo Puzzi",
  clinica: "Marcelo Puzzi",
  subtitulo: "Cardiologista Intervencionista",
  logoUrl: "/clinica-puzzi.png",
  corMarca: "#C8102E",
  telefone: null,
  endereco: null,
  site: null,
  crm: null,
};

/**
 * Busca a marca do médico do paciente logado.
 * Lê da view `clinic_branding`, que expõe só os campos de marca — o paciente
 * não enxerga o resto do perfil profissional.
 */
export function useMarcaClinica(): { marca: MarcaClinica; temMarca: boolean; isLoading: boolean } {
  const demo = !!getDevBypass();
  const { professionals } = useMyProfessionals();
  const proId = (professionals?.[0] as any)?.professional_id ?? null;

  const { data, isLoading } = useQuery({
    queryKey: ["clinic_branding", proId],
    queryFn: async (): Promise<MarcaClinica | null> => {
      if (!proId) return null;
      const { data, error } = await (supabase as any)
        .from("clinic_branding")
        .select("*")
        .eq("id", proId)
        .maybeSingle();
      if (error || !data) return null;
      return {
        professionalId: data.id,
        medico: data.display_name,
        clinica: data.clinic_name,
        subtitulo: data.clinic_subtitle,
        logoUrl: data.clinic_logo_url,
        corMarca: data.clinic_brand_color,
        telefone: data.clinic_phone,
        endereco: data.clinic_address,
        site: data.clinic_site,
        crm: data.registration_number
          ? `CRM ${data.registration_number}${data.registration_state ? "/" + data.registration_state : ""}`
          : null,
      };
    },
    enabled: !!proId && !demo,
    staleTime: 30 * 60 * 1000,
  });

  const marca = demo ? MARCA_DEMO : data ?? MARCA_PADRAO;
  const temMarca = Boolean(marca.logoUrl || marca.clinica);

  // A cor da clínica vira uma variável CSS — nenhum componente precisa saber
  // que existe white label; quem usa `var(--brand)` já herda.
  useEffect(() => {
    const raiz = document.documentElement;
    if (marca.corMarca) raiz.style.setProperty("--brand", marca.corMarca);
    else raiz.style.removeProperty("--brand");
  }, [marca.corMarca]);

  return { marca, temMarca, isLoading: isLoading && !demo };
}
