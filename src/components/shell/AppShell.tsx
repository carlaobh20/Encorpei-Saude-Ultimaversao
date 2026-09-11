import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronRight, LogOut, MessageCircle, Plus, Siren, X,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { NavLink } from "@/components/NavLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PWAInstallPrompt } from "@/components/shell/PWAInstallPrompt";
import {
  BOTTOM_NAV, NAV_CONTA, NAV_EMERGENCIA, NAV_FOOTER, NAV_STRUCTURE,
  type BottomNavItem, type NavGroupKey, type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { usePatientMessages } from "@/hooks/useProfessional";
import { getDevBypass, clearDevBypass } from "@/contexts/DevBypass";
import { APP_NAME } from "@/lib/config";
import { RegistroRapido } from "@/components/registro/RegistroRapido";
import { useMarcaClinica } from "@/hooks/useMarcaClinica";

/**
 * Casca do app do PACIENTE.
 *
 * Desenho pensado para quem tem 60–75 anos: alvos de toque de 48px, texto de
 * 16–18px (a classe `leitura-paciente` em index.css impõe o piso), barra
 * inferior com CINCO destinos — Hoje · Minha saúde · Registrar · Minha
 * equipe · Mais — e o acesso de socorro sempre na tela, nunca escondido
 * dentro de um menu.
 *
 * Dois destinos da barra não navegam: "Registrar" abre a folha de registro
 * rápido e "Mais" abre o menu lateral. Ambos são <button>, não link falso:
 * assim o teclado e o leitor de tela anunciam o que eles realmente fazem.
 *
 * ── Menu lateral (setembro/2026) ──────────────────────────────────────
 *
 * Antes o menu era uma lista corrida de 19 linhas com quatro títulos de
 * seção decorativos. Para o Antônio, isso é uma parede: ele rola, não acha,
 * e volta para a tela inicial. Agora a lateral tem uma hierarquia explícita
 * de quatro alturas, e cada altura responde a uma pergunta diferente:
 *
 *   1. "Hoje"            → onde eu sempre volto (item solto, no topo)
 *   2. "Registrar"       → o que eu vim fazer (botão azul cheio, não navega)
 *   3. três grupos       → o mapa, guardado até eu pedir (recolhíveis)
 *   4. "Não estou bem"   → o socorro, fora de tudo, sempre visível
 *
 * Os grupos nascem FECHADOS, menos o que contém a rota atual: abrir todos
 * seria reconstruir a parede que acabamos de derrubar, e fechar todos faria
 * o paciente perder de vista onde ele está.
 */

function Logo({ compact }: { compact?: boolean }) {
  const { marca, temMarca } = useMarcaClinica();

  // Com marca da clínica: a assinatura de quem cuida do paciente fica em cima,
  // e a plataforma vira a linha de baixo, discreta. Sem marca: só a plataforma.
  if (temMarca) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <img
          src={marca.logoUrl ?? "/logo-symbol.png"}
          alt={marca.clinica ?? marca.medico}
          className="h-10 w-10 rounded-lg object-contain shrink-0"
        />
        {!compact && (
          <div className="min-w-0">
            <div className="font-display text-base font-semibold tracking-tight text-foreground leading-tight truncate">
              {marca.clinica ?? marca.medico}
            </div>
            {marca.subtitulo && (
              <div className="text-sm text-muted-foreground leading-tight truncate">{marca.subtitulo}</div>
            )}
            {/* 13px é o piso do que o paciente PRECISA ler; esta linha é
                assinatura de plataforma, então fica no menor tamanho legível
                que ainda passa no teste de 360px sem quebrar a caixa. */}
            <div className="text-xs text-muted-foreground/80 leading-none mt-1">com Encorpei Cardio</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
      <img
        src="/logo-symbol.png"
        alt={APP_NAME}
        width={38}
        height={38}
        className="object-contain shrink-0"
        style={{ width: 38, height: 38 }}
      />
      {!compact && (
        <div>
          <div className="font-display text-lg font-semibold tracking-tight text-foreground leading-none">
            Encorpei
          </div>
          <div className="font-script text-base text-primary leading-none mt-1">Cardio</div>
        </div>
      )}
    </div>
  );
}

function useMensagensNaoLidas(): number {
  const { user } = useAuth();
  const { naoLidas } = usePatientMessages(user?.id, "patient", user?.id);
  return naoLidas;
}

function ItemNav({
  item,
  ativo,
  onClick,
  badge,
}: {
  item: NavItem;
  ativo: boolean;
  onClick?: () => void;
  badge?: number;
}) {
  return (
    <NavLink
      to={item.path}
      end
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        // min-h-[48px] e texto de 16px: meta de produto para alvo de toque e
        // legibilidade. Linha de menu curta demais é o erro clássico de
        // acessibilidade em app para idoso — erra o toque, volta, desiste.
        "flex items-center gap-3 min-h-[48px] px-3 py-3 rounded-xl text-base font-medium transition-colors",
        "text-foreground-soft hover:text-cardio-dark hover:bg-cardio-50",
        // Seleção evidente: fundo azul claro + texto no azul escuro da marca
        // + peso. Três sinais, porque só um (cor) some para quem não enxerga
        // cor e só dois (cor + peso) somem no reflexo do sol na tela.
        ativo && "bg-cardio-50 text-cardio-dark font-semibold",
        item.tone === "danger" && "text-error hover:text-error hover:bg-error/10",
        item.tone === "danger" && ativo && "bg-error/10 text-error"
      )}
    >
      <item.icon className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="flex-1">{item.label}</span>
      {badge && badge > 0 ? (
        <span
          className="shrink-0 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded-full min-w-[24px] text-center leading-tight"
          aria-label={`${badge} mensagem${badge > 1 ? "s" : ""} não lida${badge > 1 ? "s" : ""}`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </NavLink>
  );
}

/** O item "Hoje" mora sozinho no topo — é a casa, não um grupo de um item só. */
const ITEM_HOJE: NavItem =
  NAV_STRUCTURE.find((g) => g.key === "hoje")?.items[0] ??
  NAV_STRUCTURE[0].items[0];

/** Os grupos que viram seções recolhíveis: tudo menos "Hoje". */
const GRUPOS_RECOLHIVEIS = NAV_STRUCTURE.filter((g) => g.key !== "hoje");

/** Qual grupo contém a rota atual — é ele que nasce aberto. */
function grupoDaRota(pathname: string): NavGroupKey | null {
  const grupo = GRUPOS_RECOLHIVEIS.find((g) => g.items.some((i) => i.path === pathname));
  return grupo?.key ?? null;
}

/**
 * Seção recolhível do menu.
 *
 * `<button aria-expanded>` + região com `id` (e não um `<div>` clicável com
 * `onClick`): é o único par que o leitor de tela anuncia como "botão,
 * recolhido/expandido" e que o teclado aciona sem `tabIndex` manual. A seta
 * gira em vez de trocar de ícone porque a rotação diz "a mesma coisa mudou
 * de estado"; trocar de desenho diz "outra coisa apareceu".
 */
function GrupoRecolhivel({
  id,
  titulo,
  aberto,
  onAlternar,
  children,
}: {
  id: string;
  titulo: string;
  aberto: boolean;
  onAlternar: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        aria-controls={id}
        className={cn(
          "w-full flex items-center gap-2 min-h-[48px] px-3 py-2.5 rounded-xl",
          "text-base font-semibold text-foreground transition-colors hover:bg-cardio-50 hover:text-cardio-dark"
        )}
      >
        <span className="flex-1 text-left">{titulo}</span>
        <ChevronDown
          className={cn(
            // motion-reduce: quem pediu menos movimento no sistema recebe a
            // seta já na posição final, sem giro.
            "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            aberto && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {/* A região existe sempre no DOM e só troca de visibilidade: assim o
          `aria-controls` do botão nunca aponta para um id inexistente. */}
      <div id={id} hidden={!aberto} className="space-y-0.5 pb-1">
        {children}
      </div>
    </div>
  );
}

/**
 * Botão "Registrar" do menu lateral — azul cheio, largura total.
 *
 * Ele NÃO navega: abre a mesma folha de registro rápido do botão central da
 * barra do celular. Registrar é o ato que o app existe para tornar barato;
 * cobrar uma troca de tela para isso é cobrar pedágio no único comportamento
 * que queremos que vire hábito.
 */
function BotaoRegistrarMenu({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        "w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl",
        "bg-primary px-4 text-base font-semibold text-primary-foreground",
        "shadow-sm transition hover:brightness-110 motion-reduce:transition-none"
      )}
    >
      <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      Registrar
    </button>
  );
}

/**
 * O acesso de socorro do menu — bloco com borda e texto vermelhos, fora de
 * qualquer grupo recolhível e fora da área que rola. Vermelho no app inteiro
 * é reservado a isto e a erro; se ele aparecesse em mais um lugar, deixaria
 * de significar "agora".
 */
function BlocoNaoEstouBem({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const ativo = location.pathname === NAV_EMERGENCIA.path;

  return (
    <div className="px-3 pb-2 pt-1">
      <NavLink
        to={NAV_EMERGENCIA.path}
        onClick={onItemClick}
        aria-current={ativo ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 min-h-[52px] rounded-2xl border border-error/40 bg-error/5 px-3 py-3",
          "text-base font-semibold text-error transition-colors hover:bg-error/10",
          ativo && "bg-error/10"
        )}
      >
        <NAV_EMERGENCIA.icon className="h-6 w-6 shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="flex-1">{NAV_EMERGENCIA.label}</span>
      </NavLink>
    </div>
  );
}

/** "A. R." — duas letras no máximo, para caber no círculo em qualquer nome. */
function iniciaisDe(nome: string): string {
  // Só pedaços que COMEÇAM com letra: sem o filtro, "Antônio Ribeiro (Demo)"
  // virava "A(" no círculo da lateral — o parêntese do sufixo entrava como se
  // fosse inicial de sobrenome.
  const partes = nome.trim().split(/\s+/).filter((p) => /^\p{L}/u.test(p));
  if (partes.length === 0) return "?";
  const primeira = partes[0][0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? "" : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * Rodapé fixo do menu: "Preferências" e o bloco de conta.
 *
 * O nome é o de quem está logado de verdade (perfil > e-mail), nunca um nome
 * de exemplo: um app de saúde que mostra o nome errado na lateral é um app em
 * que o paciente para de confiar nos números da tela do lado.
 */
function RodapeMenu({ onItemClick }: { onItemClick?: () => void }) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();

  const nome = profile?.full_name?.trim() || user?.email || "Minha conta";
  const iniciais = iniciaisDe(profile?.full_name?.trim() || user?.email || "");

  return (
    <div className="border-t border-border p-3 space-y-1">
      {NAV_FOOTER.map((item) => (
        <ItemNav key={item.id} item={item} ativo={location.pathname === item.path} onClick={onItemClick} />
      ))}

      <NavLink
        to={NAV_CONTA.path}
        onClick={onItemClick}
        aria-current={location.pathname === NAV_CONTA.path ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 min-h-[56px] rounded-2xl px-2 py-2 transition-colors hover:bg-cardio-50",
          location.pathname === NAV_CONTA.path && "bg-cardio-50"
        )}
      >
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cardio-100 text-cardio-dark text-base font-semibold"
          aria-hidden="true"
        >
          {iniciais}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-foreground">{nome}</span>
          <span className="block text-xs text-muted-foreground leading-tight">{NAV_CONTA.label}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </NavLink>

      {/* "Sair" continua no menu de propósito: existe também dentro de
          /conta, mas tirar o caminho curto obrigaria a duas telas de
          distância para uma ação que o paciente às vezes precisa fazer no
          aparelho de outra pessoa. Fica discreto — não compete com nada. */}
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 min-h-[48px] px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Sair
      </button>
    </div>
  );
}

/**
 * O menu lateral inteiro — usado tanto na coluna fixa do desktop quanto no
 * painel que o botão "Mais" abre no celular. É o MESMO componente: repetir a
 * mesma ordem e os mesmos nomes nos dois lugares é o que faz o paciente
 * entender que "Mais" não é outro app, é o mesmo mapa aberto por inteiro.
 */
function MenuLateral({
  onItemClick,
  onRegistrar,
}: {
  onItemClick?: () => void;
  onRegistrar: () => void;
}) {
  const location = useLocation();
  const naoLidas = useMensagensNaoLidas();

  // Nasce aberto só o grupo da rota atual. Depois disso, quem manda é o
  // paciente: o que ele abriu continua aberto enquanto ele navega.
  const [abertos, setAbertos] = useState<NavGroupKey[]>(() => {
    const atual = grupoDaRota(location.pathname);
    return atual ? [atual] : [];
  });

  useEffect(() => {
    const atual = grupoDaRota(location.pathname);
    if (!atual) return;
    setAbertos((prev) => (prev.includes(atual) ? prev : [...prev, atual]));
  }, [location.pathname]);

  const alternar = (key: NavGroupKey) =>
    setAbertos((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <>
      <Logo />

      {/* min-h-0 é o que faz o overflow funcionar dentro de um flex column:
          sem ele o filho cresce para além da coluna e os últimos itens do
          menu ficam inalcançáveis embaixo do rodapé. */}
      <nav aria-label="Menu principal" className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        <ItemNav
          item={ITEM_HOJE}
          ativo={location.pathname === ITEM_HOJE.path}
          onClick={onItemClick}
        />

        <BotaoRegistrarMenu
          onClick={() => {
            onItemClick?.();
            onRegistrar();
          }}
        />

        <div className="pt-1 space-y-0.5">
          {GRUPOS_RECOLHIVEIS.map((grupo) => {
            const aberto = abertos.includes(grupo.key);
            return (
              <GrupoRecolhivel
                key={grupo.key}
                id={`grupo-nav-${grupo.key}`}
                titulo={grupo.label}
                aberto={aberto}
                onAlternar={() => alternar(grupo.key)}
              >
                {grupo.items.map((item) => (
                  <ItemNav
                    key={item.id}
                    item={item}
                    ativo={location.pathname === item.path}
                    onClick={onItemClick}
                    badge={item.badge === "medico" ? naoLidas : undefined}
                  />
                ))}
              </GrupoRecolhivel>
            );
          })}
        </div>
      </nav>

      <BlocoNaoEstouBem onItemClick={onItemClick} />
      <RodapeMenu onItemClick={onItemClick} />
    </>
  );
}

/** Faixa do modo demo — visível de propósito, para nunca confundir com dado real. */
function FaixaDemo() {
  const demo = getDevBypass();
  const navigate = useNavigate();
  if (!demo) return null;

  return (
    // Não é `sticky`: o cabeçalho do celular logo abaixo já gruda em `top-0`, e
    // duas faixas grudadas no mesmo ponto se sobrepõem — a faixa (translúcida)
    // ficava por cima do nome do médico e, no desktop, por cima do conteúdo que
    // passava por baixo dela. A faixa rola com a página e continua sendo a
    // primeira coisa que se vê ao abrir e ao voltar ao topo.
    <div className="relative z-50 flex items-center justify-between gap-3 bg-warning/15 border-b border-warning/40 px-4 py-2 text-sm text-foreground">
      <span className="font-medium">
        Modo demonstração — dados fictícios, nada é salvo.
      </span>
      <button
        onClick={() => {
          clearDevBypass();
          navigate("/landing");
          window.location.reload();
        }}
        className="shrink-0 inline-flex items-center gap-1 min-h-[44px] font-semibold text-warning-forte hover:underline"
      >
        <X className="h-4 w-4" /> Sair do demo
      </button>
    </div>
  );
}

/**
 * Cabeçalho da área de conteúdo (desktop).
 *
 * Faixa discreta, não um segundo cabeçalho de aplicativo: a data por extenso
 * à esquerda (em maiúsculas pequenas, porque é referência e não título) e um
 * único atalho à direita, o de falar com a equipe — que é o que o paciente
 * procura quando a tela não responde a pergunta dele.
 *
 * Sem sino de notificação: não existe central de notificações no app do
 * paciente (nenhuma rota, nenhum hook). Ícone de sino sem nada atrás é
 * promessa falsa — o paciente clica, não acontece nada, e passa a ignorar
 * também os avisos que importam.
 */
function CabecalhoConteudo() {
  const naoLidas = useMensagensNaoLidas();

  const data = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()),
    []
  );

  return (
    <header className="hidden lg:flex items-center justify-between gap-4 border-b border-border bg-card px-8 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{data}</p>

      <NavLink
        to="/medico"
        className={cn(
          "inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-border bg-card px-4 py-2",
          "text-base font-medium text-cardio-dark transition-colors hover:bg-cardio-50"
        )}
      >
        <MessageCircle className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        Falar com minha equipe
        {naoLidas > 0 ? (
          <span
            className="ml-1 inline-flex min-w-[24px] justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground"
            aria-label={`${naoLidas} mensagem${naoLidas > 1 ? "s" : ""} não lida${naoLidas > 1 ? "s" : ""}`}
          >
            {naoLidas > 99 ? "99+" : naoLidas}
          </span>
        ) : null}
      </NavLink>
    </header>
  );
}

/**
 * Botão de emergência — fixo, alcançável de qualquer tela.
 *
 * Leva à triagem (`/como-estou`), e não direto ao 192, porque a tela de
 * triagem já abre com o botão de ligar no topo e com a lista de sinais de
 * alarme — atende tanto quem está com medo quanto quem está passando mal,
 * sem transformar susto em ligação desnecessária nem atrasar quem precisa
 * de socorro. Ver docs/ENGAJAMENTO-CARDIO.md §3.2.
 *
 * POSIÇÃO (auditoria §6): antes ficava em `bottom-24`, encostado na barra
 * inferior, e cobria o último item de qualquer lista. Agora ele fica ACIMA
 * da barra por cálculo explícito (altura da barra + área segura do aparelho)
 * e o `<main>` reserva embaixo exatamente o espaço que a barra e o botão
 * ocupam — nada mais fica escondido debaixo dele em nenhuma tela.
 */
function BotaoEmergencia() {
  const location = useLocation();
  // Não repete onde a própria tela já é sobre isso — inclusive em /hoje, que
  // deixou de ter o botão duplicado no fim da página.
  if (location.pathname === "/emergencia" || location.pathname === "/como-estou") return null;

  return (
    <NavLink
      to="/como-estou"
      aria-label="Não estou bem — abrir triagem de sintomas"
      className={cn(
        // `lg:hidden`: no desktop o mesmo acesso já está SEMPRE na lateral
        // (BlocoNaoEstouBem, fora da área que rola). O botão flutuante era uma
        // segunda cópia do mesmo destino e, por ficar preso ao canto inferior
        // direito, cobria o que estivesse ali — no /hoje, os botões
        // "Mensagens" e "Exames" da coluna de apoio. No celular ele continua:
        // lá não existe lateral aberta.
        "lg:hidden",
        "fixed right-4 z-40 inline-flex items-center gap-2 min-h-[48px] rounded-full",
        "bg-error px-4 py-3 text-white shadow-lg shadow-error/30 hover:brightness-110 transition",
        // Underscore vira espaço no Tailwind — e calc() sem espaço em volta
        // do "+" é CSS inválido, então ele é obrigatório aqui.
        "bottom-[calc(var(--barra-inferior)_+_0.75rem)]"
      )}
    >
      <Siren className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      <span className="text-base font-semibold">Não estou bem</span>
    </NavLink>
  );
}

/**
 * Barra inferior — cinco destinos, na ordem da auditoria.
 *
 * Tudo aqui é elemento focável nativo (link ou botão) em ordem de DOM igual
 * à ordem visual, então Tab percorre a barra da esquerda para a direita e
 * Enter/Espaço aciona. Sem `tabIndex` manual e sem div clicável.
 *
 * A altura da barra é FIXA em 4rem (h-16 em cada célula), e não "o que der":
 * é o mesmo número que `--barra-inferior` reserva embaixo do `<main>`. Se a
 * barra crescer sem o número crescer junto, o último cartão de cada página
 * volta a ficar debaixo dela.
 */
function BarraInferior({
  onRegistrar,
  onMais,
}: {
  onRegistrar: () => void;
  onMais: () => void;
}) {
  const location = useLocation();
  const naoLidas = useMensagensNaoLidas();

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {/* grid-cols-5 com min-w-0 em cada célula: em 360px os rótulos mais
          longos ("Minha equipe") quebram em duas linhas em vez de estourar
          a largura. */}
      <div className="grid grid-cols-5 items-stretch">
        {BOTTOM_NAV.map((item) =>
          item.acao === "registrar" ? (
            <BotaoRegistrar key={item.id} item={item} onClick={onRegistrar} />
          ) : item.acao === "mais" ? (
            <BotaoBarraAcao key={item.id} item={item} onClick={onMais} />
          ) : (
            <BotaoBarra
              key={item.id}
              item={item}
              ativo={location.pathname === item.path}
              badge={item.badge === "medico" ? naoLidas : undefined}
            />
          )
        )}
      </div>
    </nav>
  );
}

/** Estilo comum das cinco células: 64px de alvo, rótulo de 12px que nunca some. */
const CELULA_BARRA =
  "relative flex flex-col items-center justify-center gap-0.5 h-16 min-w-0 px-1 " +
  "text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px]";

function BotaoBarra({ item, ativo, badge }: { item: BottomNavItem; ativo: boolean; badge?: number }) {
  // Item de barra sem `path` é ação, e ação é renderizada pelos outros dois
  // componentes. A checagem existe para o tipo — e para o caso de alguém
  // acrescentar um item novo no config e esquecer o destino.
  if (!item.path) return null;

  return (
    <NavLink
      to={item.path}
      aria-label={item.descricao ?? item.label}
      aria-current={ativo ? "page" : undefined}
      className={cn(CELULA_BARRA, ativo ? "text-primary font-semibold" : "text-muted-foreground")}
    >
      <item.icon className="h-6 w-6 shrink-0" strokeWidth={ativo ? 2 : 1.75} aria-hidden="true" />
      <span className="w-full text-center leading-tight break-words hyphens-none">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="absolute top-1.5 right-[24%] h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
      ) : null}
    </NavLink>
  );
}

function BotaoBarraAcao({ item, onClick }: { item: BottomNavItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.descricao ?? item.label}
      aria-haspopup="dialog"
      className={cn(CELULA_BARRA, "text-muted-foreground")}
    >
      <item.icon className="h-6 w-6 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      <span className="w-full text-center leading-tight break-words hyphens-none">{item.label}</span>
    </button>
  );
}

/**
 * O botão do meio registra — não navega, e é o único elemento elevado da
 * barra. Ele sobe por `position: absolute` a partir da própria célula: assim
 * o círculo pode passar por cima da borda da barra SEM aumentar a altura
 * dela, que é o número reservado em `--barra-inferior`. O anel da cor do
 * fundo recorta o círculo contra a barra branca.
 */
function BotaoRegistrar({ item, onClick }: { item: BottomNavItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.descricao ?? item.label}
      aria-haspopup="dialog"
      className={cn(CELULA_BARRA, "justify-end pb-1.5 text-primary")}
    >
      <span
        className={cn(
          "absolute -top-6 left-1/2 -translate-x-1/2 inline-flex h-14 w-14 items-center justify-center",
          "rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background"
        )}
        aria-hidden="true"
      >
        <item.icon className="h-7 w-7" strokeWidth={2.5} />
      </span>
      <span className="w-full text-center font-semibold leading-tight">{item.label}</span>
    </button>
  );
}

/**
 * Topo do app no celular: a marca da clínica do paciente quando ela existe, a
 * marca da plataforma quando não. Quem cuida dele assina a tela — é isso que
 * faz o paciente sentir que o app é do consultório dele, e não de um
 * fornecedor.
 */
function MarcaNoTopo() {
  const { marca, temMarca } = useMarcaClinica();

  if (!temMarca) {
    return <img src="/logo-symbol.png" alt={APP_NAME} width={30} height={30} className="object-contain" style={{ width: 30, height: 30 }} />;
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      {marca.logoUrl ? (
        <img src={marca.logoUrl} alt={marca.clinica ?? marca.medico} className="h-8 w-8 rounded-md object-contain" />
      ) : null}
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold truncate">{marca.clinica ?? marca.medico}</p>
        {marca.subtitulo ? (
          <p className="text-xs text-muted-foreground truncate">{marca.subtitulo}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Altura reservada embaixo no celular: barra inferior (4rem) + a área segura
 * do aparelho (o "queixo" do iPhone). Fica em variável CSS para que o botão
 * flutuante e o `<main>` calculem o mesmo espaço a partir de um número só.
 */
const ESTILO_SHELL = { "--barra-inferior": "calc(4rem + env(safe-area-inset-bottom, 0px))" } as CSSProperties;

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [registroAberto, setRegistroAberto] = useState(false);
  const location = useLocation();

  // Toda troca de tela volta ao topo — sem isso, quem vem de uma lista longa
  // abre a próxima página no meio dela.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    // `leitura-paciente` (index.css) sobe a escala de texto e o piso de
    // tamanho dentro do app do paciente — sem mexer nas telas do médico, que
    // são densas de propósito (docs/CONTRATO-DE-CODIGO.md, "Tom de escrita").
    // `--barra-inferior` é a altura reservada embaixo: barra + área segura.
    <div className="leitura-paciente flex min-h-screen w-full bg-background" style={ESTILO_SHELL}>
      {/* Menu lateral — desktop. Branco sobre o fundo cinza-azulado da página,
          com uma borda fina de 1px em vez de sombra: a lateral é chão, não
          cartão, e sombra aqui faria ela competir com o conteúdo. */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[252px] shrink-0 sticky top-0 h-screen border-r border-border bg-card">
        <MenuLateral onRegistrar={() => setRegistroAberto(true)} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <FaixaDemo />

        {/* Cabeçalho — celular. Só a marca: a navegação inteira está na barra
            de baixo, ao alcance do polegar, e repetir um menu aqui em cima
            criaria dois caminhos para a mesma coisa em telas onde o topo é
            justamente a parte mais difícil de alcançar. */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center bg-card/95 backdrop-blur border-b border-border px-4 py-2.5">
          <MarcaNoTopo />
        </header>

        <CabecalhoConteudo />

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="leitura-paciente w-[300px] max-w-[88vw] p-0 flex flex-col">
            <MenuLateral
              onItemClick={() => setDrawerOpen(false)}
              onRegistrar={() => setRegistroAberto(true)}
            />
          </SheetContent>
        </Sheet>

        {/*
          Espaço reservado embaixo (auditoria §6): no celular o conteúdo
          termina acima da barra inferior E do botão "Não estou bem", que
          flutua logo acima dela. 9.5rem = barra (4rem) + botão (3rem) +
          folga, mais a área segura do aparelho. No desktop não há barra:
          basta limpar o botão flutuante.

          A largura máxima NÃO é decidida aqui: cada página escolhe a sua
          (os primitivos já param em 1440px). Um teto estreito na casca
          transformaria o monitor de 27" numa tira de celular esticada.
        */}
        <main
          className={cn(
            "flex-1 w-full px-4 py-5 lg:px-8 lg:py-8",
            "pb-[calc(9.5rem_+_env(safe-area-inset-bottom,0px))] lg:pb-28"
          )}
        >
          <ErrorBoundary scope="App">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <BotaoEmergencia />
      <BarraInferior
        onRegistrar={() => setRegistroAberto(true)}
        onMais={() => setDrawerOpen(true)}
      />
      {/* A folha de registro mora na raiz da casca, e não dentro da barra do
          celular: o botão "Registrar" do menu lateral (desktop) precisa abrir
          exatamente a mesma folha, e a barra é `lg:hidden`. */}
      <RegistroRapido aberto={registroAberto} onFechar={() => setRegistroAberto(false)} />
      <PWAInstallPrompt />
    </div>
  );
}
