import {
  Home, HeartPulse, Activity, Moon, Pill, CalendarDays, FlaskConical,
  MessageCircle, User, MessageSquarePlus, Watch, Target, Siren, Heart,
  Footprints, Salad, GraduationCap, FileText, Users, Stethoscope, Scale,
  Plus, Menu, SlidersHorizontal, Droplet,
  type LucideIcon,
} from "lucide-react";

/**
 * Navegação do app do PACIENTE.
 *
 * ── Por que esta estrutura mudou (auditoria de setembro/2026) ──────────
 *
 * A versão anterior tinha 19 destinos no menu e 4 + botão central na barra
 * inferior. Para o Antônio, 68 anos, isso não é "app completo": é uma parede
 * de escolhas. Cada destino a mais na tela é uma decisão a mais antes de ele
 * conseguir fazer a única coisa que interessa hoje — registrar o que foi
 * combinado e ver se está melhorando (docs/ENGAJAMENTO-CARDIO.md §1).
 *
 * A regra que passamos a seguir: **cinco destinos competem na tela, e só
 * cinco** — Hoje · Minha saúde · Registrar · Minha equipe · Mais.
 * Nenhum destino sumiu do app: todos continuam no menu lateral, agrupados
 * exatamente pelos mesmos quatro títulos da barra. O que mudou é quem
 * disputa a atenção na primeira olhada.
 *
 * Trade-off assumido: quem já sabia onde ficava "Alimentação" vai precisar
 * de um toque a mais (Mais → ... ou Minha saúde → Alimentação). Aceitamos:
 * o custo recai sobre o usuário experiente, que consegue pagá-lo, e não
 * sobre quem abriu o app pela terceira vez e desistiu.
 *
 * Os quatro grupos respondem quatro perguntas distintas:
 *   "Hoje"        → o que preciso fazer agora
 *   "Minha saúde" → meus números e minha evolução
 *   "Minha equipe"→ quem cuida de mim e quando eu os vejo
 *   "Mais"        → o resto (aparelho, aprender, conta, ajuda, emergência)
 */

export const NAV_GROUP_KEYS = ["hoje", "saude", "equipe", "mais"] as const;
export type NavGroupKey = (typeof NAV_GROUP_KEYS)[number];

export interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  isAction?: boolean;
  badge?: "medico";
  tone?: "danger";
}

export interface NavGroup {
  key: NavGroupKey;
  label: string;
  items: NavItem[];
}

/**
 * Muda sempre que a estrutura mudar — invalida a ordem salva pelo usuário.
 * v3 = reestruturação para os quatro grupos da barra de cinco destinos.
 * v4 = Glicemia entra em "Minha saúde" (a tela existia e a rota /glicemia
 *      estava registrada, mas nenhum menu chegava até ela — auditoria de
 *      setembro/2026) e "Configurações" vira "Preferências", para não
 *      concorrer com "Minha conta" como se fossem a mesma coisa.
 */
export const NAV_STRUCTURE_VERSION = 4;

export const NAV_STRUCTURE: NavGroup[] = [
  {
    key: "hoje",
    label: "Hoje",
    items: [
      { id: "nav-hoje", label: "Hoje", path: "/hoje", icon: Home },
    ],
  },
  {
    // "Minha saúde" reúne tudo que é número do paciente: a evolução
    // (Meu coração) na frente, e os registros por domínio logo abaixo.
    // A barra inferior aponta para /meu-coracao porque é a página que
    // responde "estou melhorando?" — a pergunta, não a planilha.
    key: "saude",
    label: "Minha saúde",
    items: [
      { id: "nav-meu-coracao", label: "Minha evolução",      path: "/meu-coracao", icon: Heart },
      { id: "nav-pressao",     label: "Pressão & Coração",   path: "/pressao",     icon: HeartPulse },
      { id: "nav-peso",        label: "Peso",                path: "/peso",        icon: Scale },
      // Glicemia ficou órfã até setembro/2026: a tela e a rota existiam, mas
      // não havia porta de entrada. Mora aqui porque, para o paciente, açúcar
      // no sangue é mais um número do corpo dele — do mesmo tipo de pressão e
      // peso — e não um assunto à parte.
      { id: "nav-glicemia",    label: "Glicemia",            path: "/glicemia",    icon: Droplet },
      { id: "nav-remedios",    label: "Meus Remédios",       path: "/remedios",    icon: Pill },
      { id: "nav-atividade",   label: "Atividade",           path: "/atividade",   icon: Activity },
      { id: "nav-sono",        label: "Sono",                path: "/sono",        icon: Moon },
      { id: "nav-alimentacao", label: "Alimentação",         path: "/alimentacao", icon: Salad },
      { id: "nav-exames",      label: "Exames",              path: "/exames",      icon: FlaskConical },
      { id: "nav-caminhada",   label: "Caminhada & Testes",  path: "/caminhada",   icon: Footprints },
      { id: "nav-metas",       label: "Minhas Metas",        path: "/metas",       icon: Target },
    ],
  },
  {
    // Tudo que envolve outra pessoa cuidando dele. "Meu Mês" mora aqui de
    // propósito: é o documento que ele leva (ou manda) para a consulta.
    key: "equipe",
    label: "Minha equipe",
    items: [
      { id: "nav-medico",     label: "Meu Cardiologista",  path: "/medico",     icon: MessageCircle, badge: "medico" },
      { id: "nav-agenda",     label: "Consultas",          path: "/agenda",     icon: CalendarDays },
      { id: "nav-cuidadores", label: "Quem cuida de mim",  path: "/cuidadores", icon: Users },
      { id: "nav-meu-mes",    label: "Meu Mês",            path: "/meu-mes",    icon: FileText },
    ],
  },
  {
    // O grupo "Mais" é o destino do quinto botão da barra: ele abre este
    // menu. Emergência fica no fim, em vermelho — mas nunca é o único
    // caminho: o botão flutuante "Não estou bem" está em todas as telas.
    key: "mais",
    label: "Mais",
    items: [
      { id: "nav-como-estou",    label: "Como estou agora", path: "/como-estou",    icon: Stethoscope },
      { id: "nav-pulseira",      label: "Minha Pulseira",   path: "/pulseira",      icon: Watch },
      { id: "nav-aprender",      label: "Aprender",         path: "/aprender",      icon: GraduationCap },
      // "Preferências" e não "Configurações": o par Conta/Configurações fazia o
      // paciente procurar seus dados cadastrais nos dois lugares. Agora cada
      // um tem um nome que diz o que faz — "Minha conta" (quem sou eu, meus
      // dados) e "Preferências" (como o app se comporta comigo).
      { id: "nav-preferencias",  label: "Preferências",     path: "/configuracoes", icon: SlidersHorizontal },
      { id: "nav-emergencia",    label: "Emergência",       path: "/emergencia",    icon: Siren, tone: "danger" },
    ],
  },
];

/** Todos os itens em uma lista só — para busca e para telas que precisam do mapa. */
export const NAV_ITEMS: NavItem[] = NAV_STRUCTURE.flatMap((g) => g.items);

/**
 * Barra inferior no celular — CINCO destinos, nesta ordem exata.
 *
 * Dois deles não navegam:
 *   "Registrar" abre a folha do RegistroRapido (o ato que o app existe
 *   para tornar barato — não faz sentido custar uma troca de tela);
 *   "Mais" abre o menu lateral, que é onde os outros 15 destinos moram.
 *
 * Por isso o tipo aqui é diferente do NavItem do menu: item de barra pode
 * ser link OU ação. Deixar `path` opcional evita o truque de rota falsa
 * (`path: "#"`), que quebraria teclado e leitor de tela.
 */
export type NavAcao = "registrar" | "mais";

export interface BottomNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Destino, quando o item navega. */
  path?: string;
  /** Ação na própria tela, quando o item não navega. */
  acao?: NavAcao;
  badge?: "medico";
  /** Descrição para leitor de tela quando o rótulo curto não basta. */
  descricao?: string;
}

export const BOTTOM_NAV: BottomNavItem[] = [
  { id: "bn-hoje",      label: "Hoje",        path: "/hoje",        icon: Home,       descricao: "Hoje — o que fazer agora" },
  { id: "bn-saude",     label: "Minha saúde", path: "/meu-coracao", icon: Heart,      descricao: "Minha saúde — meus números e minha evolução" },
  { id: "bn-registrar", label: "Registrar",   acao: "registrar",    icon: Plus,       descricao: "Registrar uma medida agora" },
  { id: "bn-equipe",    label: "Minha equipe", path: "/medico",     icon: Stethoscope, badge: "medico", descricao: "Minha equipe — médico, consultas e quem cuida de mim" },
  { id: "bn-mais",      label: "Mais",        acao: "mais",         icon: Menu,       descricao: "Mais — abrir o menu com todas as telas" },
];

/**
 * Rodapé do menu lateral. Conta e Feedback ficam fora dos quatro grupos
 * porque não são "onde eu vejo minha saúde": são manutenção do próprio app.
 */
export const NAV_FOOTER: NavItem[] = [
  { id: "foot-conta",    label: "Minha conta", path: "/conta",    icon: User },
  { id: "foot-feedback", label: "Feedback",    path: "/feedback", icon: MessageSquarePlus },
];
