/**
 * Fábrica hierárquica de query keys.
 *
 *   queryKeys.<domínio>.all        → invalida tudo do domínio
 *   queryKeys.<domínio>.de(uid)    → dados de um paciente específico
 */
export const queryKeys = {
  profile: {
    all: ["profile"] as const,
    user: ["profile", "user"] as const,
  },
  patient: {
    all: ["patient"] as const,
    self: ["patient", "self"] as const,
    de: (uid: string) => ["patient", "detail", uid] as const,
  },
  targets: {
    all: ["targets"] as const,
    de: (uid: string) => ["targets", uid] as const,
  },
  /**
   * Metas de COMPORTAMENTO do paciente (`patient_goals`).
   *
   * Domínio separado de `targets` de propósito, e não por organização: são
   * duas coisas com donos diferentes. `targets` é a prescrição do médico —
   * o paciente só lê (migração 20260912000000_seguranca.sql §3). `patientGoals`
   * é o combinado do paciente consigo mesmo — ele lê e escreve, o médico só lê.
   * Se dividissem prefixo, salvar o combinado do paciente invalidaria a
   * prescrição e vice-versa, misturando no cache duas fontes de autoridade
   * que o banco faz questão de manter separadas.
   */
  patientGoals: {
    all: ["patient_goals"] as const,
    de: (uid: string) => ["patient_goals", uid] as const,
  },
  bp: {
    all: ["bp"] as const,
    de: (uid: string) => ["bp", uid] as const,
  },
  hr: {
    all: ["hr"] as const,
    de: (uid: string) => ["hr", uid] as const,
  },
  spo2: {
    all: ["spo2"] as const,
    de: (uid: string) => ["spo2", uid] as const,
  },
  weight: {
    all: ["weight"] as const,
    de: (uid: string) => ["weight", uid] as const,
  },
  glucose: {
    all: ["glucose"] as const,
    de: (uid: string) => ["glucose", uid] as const,
  },
  sleep: {
    all: ["sleep"] as const,
    de: (uid: string) => ["sleep", uid] as const,
  },
  activity: {
    all: ["activity"] as const,
    de: (uid: string) => ["activity", uid] as const,
  },
  symptoms: {
    all: ["symptoms"] as const,
    de: (uid: string) => ["symptoms", uid] as const,
  },
  medications: {
    all: ["medications"] as const,
    de: (uid: string) => ["medications", uid] as const,
    intakes: (uid: string) => ["medications", "intakes", uid] as const,
  },
  labs: {
    all: ["labs"] as const,
    de: (uid: string) => ["labs", uid] as const,
  },
  exams: {
    all: ["exams"] as const,
    de: (uid: string) => ["exams", uid] as const,
  },
  alerts: {
    all: ["alerts"] as const,
    doPaciente: (uid: string) => ["alerts", "patient", uid] as const,
    doMedico: ["alerts", "professional"] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    de: (uid: string) => ["appointments", uid] as const,
  },
  messages: {
    all: ["messages"] as const,
    thread: (uid: string) => ["messages", uid] as const,
    meta: ["messages", "meta"] as const,
  },
  devices: {
    all: ["devices"] as const,
    de: (uid: string) => ["devices", uid] as const,
  },
  professional: {
    all: ["professional"] as const,
    profile: ["professional", "profile"] as const,
    patients: ["professional", "patients"] as const,
    fila: ["professional", "fila"] as const,
  },
  admin: {
    all: ["admin"] as const,
    stats: ["admin", "stats"] as const,
    doctors: ["admin", "doctors"] as const,
    users: ["admin", "users"] as const,
    feedback: ["admin", "feedback"] as const,
    isAdmin: ["admin", "isAdmin"] as const,
    professionals: ["admin", "professionals"] as const,
    professionalMetrics: ["admin", "professionalMetrics"] as const,
    professionalPatients: (id: string) => ["admin", "professionalPatients", id] as const,
  },
  /**
   * Plano de monitoramento.
   *
   * Duas telas leem a MESMA tabela com recortes DIFERENTES e por isso não
   * podem dividir a mesma chave:
   *   · `ativos` — o app do paciente, só `is_active = true` (o que é cobrado);
   *   · `todos`  — o editor do médico, ativos e inativos (o que é editável).
   *
   * Quando as duas usavam `["monitoring_plan", uid]`, quem montasse primeiro
   * preenchia o cache da outra. Na pior direção o app do paciente lia a lista
   * completa do editor e passava a COBRAR métrica que o médico havia
   * desligado. Os dois ficam sob o mesmo prefixo de propósito: invalidar
   * `all` continua atingindo os dois.
   */
  monitoringPlan: {
    all: ["monitoring_plan"] as const,
    ativos: (uid: string) => ["monitoring_plan", "ativos", uid] as const,
    todos: (uid: string) => ["monitoring_plan", "todos", uid] as const,
  },
  feedback: {
    all: ["feedback"] as const,
    mine: ["feedback", "mine"] as const,
    admin: ["feedback", "admin"] as const,
    replies: (id: string) => ["feedback", "replies", id] as const,
  },
} as const;
