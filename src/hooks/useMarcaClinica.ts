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

/**
 * O médico da DEMONSTRAÇÃO — e há um só.
 *
 * ── Por que isto virou fonte única (auditoria de setembro/2026) ────────
 * Na mesma sessão de demonstração o app afirmava as duas coisas: a barra
 * lateral estampava "Marcelo Puzzi · Cardiologista Intervencionista",
 * /caminhada dizia "faixa definida pelo seu médico" e /pulseira "seu médico
 * consegue ver — enquanto /conta e /hoje ofereciam "conecte-se ao seu
 * médico". O paciente ficava sem responder a pergunta mais básica do
 * produto: **alguém está olhando isto?**
 *
 * A causa era o demo ter médico em alguns lugares e não em outros: os dados
 * clínicos vinham de `demoData.ts`, a marca daqui, e o VÍNCULO
 * (`useMyProfessionals`) não existia no modo demonstração — ele consulta o
 * banco, e o demo não consulta banco. Quem perguntava "tenho médico?" pelo
 * vínculo ouvia "não".
 *
 * Agora o nome mora aqui, uma vez, e `useMedicoVinculado` é a única resposta
 * para "tenho médico?" — em demonstração e fora dela.
 */
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

// ══════════════════════════════════════════════════════════════════════
// "Alguém está olhando isto?" — uma pergunta, uma resposta
// ══════════════════════════════════════════════════════════════════════

/** O mínimo que uma tela precisa saber sobre o médico para falar dele. */
export interface MedicoVinculado {
  professionalId: string;
  nome: string;
  clinica: string | null;
  verificado: boolean;
}

/**
 * O médico que acompanha este paciente — ou `null` quando não há nenhum.
 *
 * Toda tela que escrever "seu médico" deve perguntar AQUI antes. A frase
 * "seu médico consegue ver" é uma afirmação sobre o mundo: se não há vínculo,
 * ela é falsa, e o paciente age com base nela (deixa de ligar, espera um
 * retorno que não vem). Dizer "nenhum médico vinculado" quando há médico é o
 * erro simétrico e igualmente caro.
 *
 * Em demonstração devolve o MESMO médico da marca — nunca um segundo nome.
 */
export function useMedicoVinculado(): { medico: MedicoVinculado | null; isLoading: boolean } {
  const demo = !!getDevBypass();
  const { professionals, isLoading } = useMyProfessionals();

  if (demo) {
    return {
      medico: {
        professionalId: MARCA_DEMO.professionalId,
        nome: MARCA_DEMO.medico,
        clinica: MARCA_DEMO.subtitulo ?? MARCA_DEMO.clinica,
        verificado: true,
      },
      isLoading: false,
    };
  }

  const ativo = (professionals as any[]).find((p) => p?.status === "active") ?? null;
  return {
    medico: ativo
      ? {
          professionalId: ativo.professional_id,
          nome: ativo.display_name || "Seu médico",
          clinica: ativo.clinic_name ?? null,
          verificado: !!ativo.is_verified,
        }
      : null,
    isLoading,
  };
}
