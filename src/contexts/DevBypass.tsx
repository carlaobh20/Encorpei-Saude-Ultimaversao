/**
 * MODO DEMO — exploração pública do app, sem cadastro.
 *
 * Herdado do app de obstetrícia que originou este projeto e mantido pelo
 * mesmo motivo: é o que permite
 * mostrar o produto a um cardiologista em 30 segundos, no celular dele,
 * sem criar conta. Regras:
 *  - funciona em produção, de propósito;
 *  - é visível (faixa no topo) e reversível (botão "Sair do demo");
 *  - NUNCA grava no Supabase;
 *  - nomes marcados "(Demo)" para não se confundir com paciente real.
 */

export const DEV_BYPASS_KEY = "encorpei_cardio_demo";

export type DevBypassRole = "paciente" | "medico";

export interface DevBypassData {
  role: DevBypassRole;
  userId: string;
  name: string;
  /**
   * E-mail que a demonstração MOSTRA.
   *
   * O objeto `User` falso do AuthContext usa `dev+<id>@encorpei.test`, que é
   * um endereço de infraestrutura e serve para depurar. A tela /conta estampa
   * esse campo — e /conta é justamente a tela que o cardiologista olha quando
   * alguém demonstra o produto no celular. Endereço de teste ali não é
   * detalhe: é o app se apresentando como rascunho.
   */
  email: string;
}

export const DEV_MOCK: Record<DevBypassRole, DevBypassData> = {
  paciente: {
    role: "paciente",
    userId: "demo-user-paciente-001",
    name: "Antônio (Demo)",
    email: "antonio.ribeiro@exemplo.com",
  },
  medico: {
    // UM médico no demo inteiro, e é o mesmo da marca da clínica
    // (MARCA_DEMO, em useMarcaClinica.ts). Antes eram dois: a barra lateral
    // dizia "Marcelo Puzzi" e a conversa vinha de uma "Dra. Helena Prado" —
    // o paciente não conseguia responder quem estava olhando os dados dele.
    role: "medico",
    userId: "demo-user-medico-001",
    name: "Dr. Marcelo Puzzi (Demo)",
    email: "consultorio@exemplo.com",
  },
};

/**
 * Paciente-âncora do demo.
 *
 * Escolhido de propósito como PREVENÇÃO PRIMÁRIA (hipertenso, dislipidêmico,
 * ex-fumante, com apneia do sono) e não como cardiopata estabelecido: é o perfil em que
 * a Idade do Coração se aplica, e é ela que mostra a espinha do produto em 10
 * segundos. Casos de insuficiência cardíaca e fibrilação atrial aparecem na
 * fila do médico (DEMO_PRO_PATIENTS), onde interessam mais.
 */
export const DEV_PATIENT = {
  id: "demo-patient-001",
  user_id: "demo-user-paciente-001",
  professional_id: "demo-pro-001",
  full_name: "Antônio Ribeiro (Demo)",
  phone: null,
  birth_date: "1958-04-12",
  sex: "male" as const,
  height_cm: 172,
  smoking_status: "former" as const,
  pack_years: 15,
  alcohol_units_week: 3,
  comorbidities: { hypertension: true, dyslipidemia: true, diabetes: false, sleep_apnea: true, egfr: 68 },
  history: { heart_failure: false, previous_mi: false, pci: false, atrial_fibrillation: false, family_early_cad: true },
  allergies: "IECA — tosse",
  intake: { goals: ["saude", "cardiovascular"], sleep_hours_usual: 7, physically_active: true, activity_note: "Caminhada" },
  risk_category: "high" as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEV_PROFILE = {
  id: "demo-profile-001",
  user_id: "demo-user-paciente-001",
  full_name: "Antônio Ribeiro (Demo)",
  phone: null,
  avatar_url: null,
  birth_date: "1958-04-12",
  sex: "male" as const,
  height_cm: 172,
  onboarding_completed: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const DEV_PRO_PROFILE = {
  id: "demo-pro-001",
  user_id: "demo-user-medico-001",
  display_name: "Dr. Marcelo Puzzi (Demo)",
  registration_number: "00000",
  registration_state: "PR",
  specialty: "cardiologist",
  clinic_name: "Clínica Marcelo Puzzi (Demo)",
  bio: null,
  avatar_url: null,
  plan_type: "clinica" as const,
  max_patients: 999,
  approval_status: "approved" as const,
  rejection_reason: null,
  is_verified: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export function getDevBypass(): DevBypassData | null {
  try {
    const raw = localStorage.getItem(DEV_BYPASS_KEY);
    return raw ? (JSON.parse(raw) as DevBypassData) : null;
  } catch {
    return null;
  }
}

export function setDevBypass(role: DevBypassRole): void {
  try {
    localStorage.setItem(DEV_BYPASS_KEY, JSON.stringify(DEV_MOCK[role]));
  } catch {
    /* modo privado sem storage — o demo simplesmente não inicia */
  }
}

export function clearDevBypass(): void {
  try {
    localStorage.removeItem(DEV_BYPASS_KEY);
  } catch {
    /* ignora */
  }
}

export function isDemoAtivo(): boolean {
  return getDevBypass() !== null;
}
