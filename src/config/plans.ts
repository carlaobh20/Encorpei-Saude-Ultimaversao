export type PlanType = "free" | "consultorio" | "clinica" | "rede";

export interface PlanFeature {
  label: string;
  included: boolean;
}

export interface PlanConfig {
  key: PlanType;
  name: string;
  /** BRL/mês — 0 = grátis, -1 = sob consulta */
  price: number;
  priceLabel?: string;
  description: string;
  highlighted?: boolean;
  badge?: string;
  features: PlanFeature[];
}

/**
 * Quem paga é o cardiologista; o paciente usa de graça.
 * No crônico esse modelo se sustenta melhor do que no acompanhamento de
 * ciclo curto: o médico paga por anos de acompanhamento, não por meses
 * contados (docs §5).
 */
export const PLANS: PlanConfig[] = [
  {
    key: "consultorio",
    name: "Consultório",
    price: 247,
    description: "Para o cardiologista que atende sozinho ou com equipe enxuta.",
    features: [
      { label: "Até 60 pacientes ativos", included: true },
      { label: "Fila de risco: quem precisa de você hoje", included: true },
      { label: "Alertas de pressão, peso, ritmo e adesão", included: true },
      { label: "Metas e titulação de dose com histórico", included: true },
      { label: "Resumo entre consultas em 1 tela", included: true },
      { label: "Relatório PDF por consulta", included: true },
      { label: "Integração com pulseira e importação de dados", included: true },
      { label: "App gratuito para seus pacientes", included: true },
      { label: "Relatório com a marca da clínica", included: false },
      { label: "Vários médicos no mesmo painel", included: false },
    ],
  },
  {
    key: "clinica",
    name: "Clínica",
    price: 597,
    description: "Para clínicas com mais de um cardiologista e volume alto.",
    highlighted: true,
    badge: "Mais escolhido",
    features: [
      { label: "Pacientes ilimitados", included: true },
      { label: "Até 5 médicos no mesmo painel", included: true },
      { label: "Tudo do Consultório incluso", included: true },
      { label: "Relatórios com a marca da clínica", included: true },
      { label: "Painel administrativo com indicadores", included: true },
      { label: "Equipe multidisciplinar (enfermagem, nutrição)", included: true },
      { label: "Alertas por push + SMS", included: true },
      { label: "Suporte prioritário no WhatsApp", included: true },
      { label: "Programa de pulseiras com a marca da clínica", included: true },
      { label: "API e integrações", included: false },
    ],
  },
  {
    key: "rede",
    name: "Rede",
    price: -1,
    priceLabel: "Sob consulta",
    description: "Para redes, hospitais e operadoras com várias unidades.",
    features: [
      { label: "Tudo do Clínica incluso", included: true },
      { label: "Multiunidade com painel centralizado", included: true },
      { label: "Médicos ilimitados", included: true },
      { label: "API aberta + integração com PEP/HIS", included: true },
      { label: "Indicadores populacionais (controle de PA, LDL, adesão)", included: true },
      { label: "Gerente de conta dedicado", included: true },
      { label: "SLA de suporte com tempo de resposta", included: true },
      { label: "Treinamento da equipe", included: true },
      { label: "Customização de protocolos", included: true },
      { label: "Contrato anual com desconto", included: true },
    ],
  },
];

export type FeatureKey =
  | "risk_queue"
  | "auto_alerts"
  | "titration"
  | "pdf_reports"
  | "wearable_sync"
  | "multi_doctor"
  | "clinic_branding";

export const PRO_FEATURES: Record<FeatureKey, { label: string; description: string; minPlan: PlanType }> = {
  risk_queue: {
    label: "Fila de risco",
    description: "Seus pacientes ordenados por quem precisa de atenção — não em ordem alfabética.",
    minPlan: "consultorio",
  },
  auto_alerts: {
    label: "Alertas automáticos",
    description: "Pressão em crise, ganho de peso na IC, ritmo irregular, adesão em queda.",
    minPlan: "consultorio",
  },
  titration: {
    label: "Titulação com histórico",
    description: "Mudou a dose, o paciente é notificado e fica registrado por que a dose parou de subir.",
    minPlan: "consultorio",
  },
  pdf_reports: {
    label: "Relatórios PDF",
    description: "Resumo do período com a origem de cada número, pronto para o prontuário.",
    minPlan: "consultorio",
  },
  wearable_sync: {
    label: "Pulseira e dispositivos",
    description: "Frequência cardíaca, sono, oxigenação e atividade entram sozinhos no acompanhamento.",
    minPlan: "consultorio",
  },
  multi_doctor: {
    label: "Vários médicos",
    description: "Até 5 cardiologistas com visão compartilhada dos pacientes.",
    minPlan: "clinica",
  },
  clinic_branding: {
    label: "Marca da clínica",
    description: "Logo e identidade da clínica nos relatórios e na comunicação com o paciente.",
    minPlan: "clinica",
  },
};
