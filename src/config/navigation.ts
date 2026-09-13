import {
  Home, HeartPulse, Activity, Moon, Pill, CalendarDays, FlaskConical,
  MessageCircle, User, MessageSquarePlus, Watch, Target, Siren, Heart,
  Footprints, Salad, GraduationCap, FileText, Users, Scale,
  Plus, SlidersHorizontal, Droplet, AlertTriangle, LayoutGrid,
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
 * v5 = o menu lateral passou a ter grupos RECOLHÍVEIS, e três itens saíram
 *      das listas recolhíveis para lugares onde estão sempre à vista:
 *      "Como estou agora" virou o bloco vermelho "Não estou bem" (fora de
 *      qualquer grupo — é o acesso que não pode depender de o paciente
 *      lembrar de abrir uma seção), "Preferências" desceu para o rodapé
 *      fixo e "Minha conta" virou o bloco de conta do rodapé. Nenhum
 *      destino saiu do app: todos continuam alcançáveis, só mudaram de
 *      altura na tela. "Feedback" desceu para "Mais recursos", porque
 *      rodapé com quatro linhas voltava a ser uma lista.
 */
export const NAV_STRUCTURE_VERSION = 5;

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
    // menu. O título ganhou "recursos" porque, como cabeçalho de seção
    // recolhível, "Mais" sozinho parecia o comando de abrir e não o nome
    // do que está guardado dentro.
    //
    // Emergência fica no fim, em vermelho — mas nunca é o único caminho:
    // o bloco "Não estou bem" (abaixo) e o botão flutuante de mesmo nome
    // estão fora de qualquer grupo, em todas as telas.
    key: "mais",
    label: "Mais recursos",
    items: [
      { id: "nav-pulseira",      label: "Minha Pulseira",   path: "/pulseira",      icon: Watch },
      { id: "nav-aprender",      label: "Aprender",         path: "/aprender",      icon: GraduationCap },
      { id: "nav-feedback",      label: "Feedback",         path: "/feedback",      icon: MessageSquarePlus },
      { id: "nav-emergencia",    label: "Emergência",       path: "/emergencia",    icon: Siren, tone: "danger" },
    ],
  },
];

/**
 * Acesso de socorro do menu lateral — fora dos grupos, de propósito.
 *
 * Leva à triagem (`/como-estou`) e não ao 192: a tela de triagem já abre com
 * o botão de ligar no topo e com a lista de sinais de alarme, então atende
 * tanto quem está com medo quanto quem está passando mal. Quem está mal não
 * vai abrir uma seção recolhida para achar isto — por isso ele mora colado
 * no rodapé do menu, sempre visível, e nunca dentro de "Mais recursos".
 */
export const NAV_EMERGENCIA: NavItem = {
  id: "nav-como-estou",
  label: "Não estou bem",
  path: "/como-estou",
  icon: AlertTriangle,
  tone: "danger",
};

/**
 * Bloco de conta do rodapé do menu. É um item de navegação como os outros —
 * o que muda é o desenho (iniciais + nome real de quem está logado), não o
 * destino.
 */
export const NAV_CONTA: NavItem = {
  id: "foot-conta",
  label: "Minha conta",
  path: "/conta",
  icon: User,
};

/** Todos os destinos em uma lista só — para busca e para telas que precisam do mapa. */
export const NAV_ITEMS: NavItem[] = [
  ...NAV_STRUCTURE.flatMap((g) => g.items),
  NAV_EMERGENCIA,
  NAV_CONTA,
];

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
  { id: "bn-equipe",    label: "Minha equipe", path: "/medico",     icon: Users, badge: "medico", descricao: "Minha equipe — médico, consultas e quem cuida de mim" },
  { id: "bn-mais",      label: "Mais",        acao: "mais",         icon: LayoutGrid, descricao: "Mais — abrir o menu com todas as telas" },
];

/**
 * Rodapé fixo do menu lateral — o que não é "minha saúde", é manutenção do
 * próprio app. Só uma linha aqui: o bloco de conta (NAV_CONTA) é desenhado
 * à parte, com as iniciais de quem está logado, e "Preferências" é o único
 * item que continua sendo uma linha comum.
 *
 * "Preferências" e não "Configurações": o par Conta/Configurações fazia o
 * paciente procurar seus dados cadastrais nos dois lugares. Agora cada um
 * tem um nome que diz o que faz — "Minha conta" (quem sou eu, meus dados)
 * e "Preferências" (como o app se comporta comigo).
 */
export const NAV_FOOTER: NavItem[] = [
  { id: "nav-preferencias", label: "Preferências", path: "/configuracoes", icon: SlidersHorizontal },
];
