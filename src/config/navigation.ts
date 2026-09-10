import {
  Home, HeartPulse, Activity, Moon, Pill, CalendarDays, FlaskConical,
  MessageCircle, User, MessageSquarePlus, Watch, Target, Siren, Heart,
  Footprints, Salad, GraduationCap, FileText, Users, Stethoscope, Scale,
  type LucideIcon,
} from "lucide-react";

/**
 * Navegação do app do PACIENTE.
 *
 * Agrupada em três blocos que respondem a três perguntas diferentes
 * (docs/ENGAJAMENTO-CARDIO.md):
 *   "Como estou?"      → o que ele quer saber quando abre o app
 *   "O que eu anoto"   → os registros do dia a dia
 *   "O meu cuidado"    → o que sustenta o tratamento
 *
 * A lista é longa de propósito — mas a home resolve o dia inteiro sozinha, e
 * a barra inferior do celular tem só quatro destinos. Menu grande não é
 * problema; home confusa é.
 */

export const NAV_GROUP_KEYS = ["coracao", "registros", "cuidado"] as const;
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

/** Muda sempre que a estrutura mudar — invalida a ordem salva pelo usuário. */
export const NAV_STRUCTURE_VERSION = 2;

export const NAV_STRUCTURE: NavGroup[] = [
  {
    key: "coracao",
    label: "Como estou",
    items: [
      { id: "nav-hoje",        label: "Hoje",              path: "/hoje",         icon: Home },
      { id: "nav-meu-coracao", label: "Meu Coração",       path: "/meu-coracao",  icon: Heart },
      { id: "nav-como-estou",  label: "Como estou agora",  path: "/como-estou",   icon: Stethoscope },
      { id: "nav-meu-mes",     label: "Meu Mês",           path: "/meu-mes",      icon: FileText },
    ],
  },
  {
    key: "registros",
    label: "Meus registros",
    items: [
      { id: "nav-pressao",     label: "Pressão & Coração", path: "/pressao",      icon: HeartPulse },
      { id: "nav-peso",        label: "Peso",              path: "/peso",         icon: Scale },
      { id: "nav-remedios",    label: "Meus Remédios",     path: "/remedios",     icon: Pill },
      { id: "nav-atividade",   label: "Atividade",         path: "/atividade",    icon: Activity },
      { id: "nav-sono",        label: "Sono",              path: "/sono",         icon: Moon },
      { id: "nav-alimentacao", label: "Alimentação",       path: "/alimentacao",  icon: Salad },
      { id: "nav-exames",      label: "Exames",            path: "/exames",       icon: FlaskConical },
    ],
  },
  {
    key: "cuidado",
    label: "Meu cuidado",
    items: [
      { id: "nav-caminhada",   label: "Caminhada & Testes", path: "/caminhada",   icon: Footprints },
      { id: "nav-metas",       label: "Minhas Metas",       path: "/metas",       icon: Target },
      { id: "nav-agenda",      label: "Consultas",          path: "/agenda",      icon: CalendarDays },
      { id: "nav-aprender",    label: "Aprender",           path: "/aprender",    icon: GraduationCap },
      { id: "nav-pulseira",    label: "Minha Pulseira",     path: "/pulseira",    icon: Watch },
      { id: "nav-cuidadores",  label: "Quem cuida de mim",  path: "/cuidadores",  icon: Users },
      { id: "nav-medico",      label: "Meu Cardiologista",  path: "/medico",      icon: MessageCircle, badge: "medico" },
      { id: "nav-emergencia",  label: "Emergência",         path: "/emergencia",  icon: Siren, tone: "danger" },
    ],
  },
];

/** Todos os itens em uma lista só — para busca e para telas que precisam do mapa. */
export const NAV_ITEMS: NavItem[] = NAV_STRUCTURE.flatMap((g) => g.items);

/** Barra inferior no celular — 4 itens + logo central (leva a /hoje). */
export const BOTTOM_NAV: NavItem[] = [
  { id: "bn-pressao",  label: "Pressão",  path: "/pressao",     icon: HeartPulse },
  { id: "bn-remedios", label: "Remédios", path: "/remedios",    icon: Pill },
  { id: "bn-coracao",  label: "Coração",  path: "/meu-coracao", icon: Heart },
  { id: "bn-medico",   label: "Médico",   path: "/medico",      icon: MessageCircle, badge: "medico" },
];

export const NAV_FOOTER: NavItem[] = [
  { id: "foot-conta",    label: "Minha Conta", path: "/conta",    icon: User },
  { id: "foot-feedback", label: "Feedback",    path: "/feedback", icon: MessageSquarePlus },
];
