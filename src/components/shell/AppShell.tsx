import {
  useCallback, useEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode,
} from "react";
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
 *
 * ── A altura da lateral (auditoria de desktop, setembro/2026) ──────────
 *
 * O problema medido: em 1440×900, com "Minha saúde" aberto, a área que rola
 * tinha `clientHeight 558` para `scrollHeight 872`. Faltavam 314px — e como
 * a área de rolagem encosta direto no bloco vermelho "Não estou bem", o item
 * que calhava na fronteira aparecia CORTADO AO MEIO atrás dele. Pior: não
 * havia nenhum sinal de que existia mais coisa embaixo, então o paciente não
 * descobria Exames, Metas, Consultas nem o canal com o médico. Metade do app
 * era invisível num notebook comum.
 *
 * Quatro correções, nesta ordem de importância — e nenhuma delas é "mais um
 * `overflow`", que era exatamente o que já existia e não bastava:
 *
 *  1. ACORDEÃO EXCLUSIVO. Só UM grupo fica aberto por vez. Dois grupos
 *     abertos somavam 15 linhas de menu e não cabiam em altura nenhuma;
 *     com um só, o pior caso cai para o grupo de 11 itens. É também o
 *     modelo mental mais simples: "abri este, fechou o outro".
 *
 *  2. O RODAPÉ ENCOLHEU. "Preferências" e "Sair" eram duas linhas de 48px
 *     empilhadas; viraram uma linha de dois botões. O rodapé saiu de ~185px
 *     para ~120px, e cada pixel devolvido ao rodapé é um pixel de menu.
 *
 *  3. SINAL DE QUE HÁ MAIS. A borda de baixo da área que rola ganhou um
 *     esmaecimento e, quando ainda há conteúdo abaixo, um botão "mais
 *     opções" que rola a lista. Item cortado atrás de bloco fixo lê-se como
 *     defeito; item que esmaece sob um degradê lê-se como "continua".
 *
 *  4. O GRUPO ABERTO SE APRESENTA. Ao abrir um grupo, o cabeçalho dele rola
 *     para dentro da vista — sem isso, abrir "Mais recursos" lá embaixo não
 *     mostrava nada do que foi aberto.
 *
 * O que NÃO fizemos: encolher a linha de menu abaixo de 48px. Alvo de toque
 * é meta de produto para 60–75 anos; ganhar 60px de altura fazendo o
 * paciente errar o clique é trocar um defeito por outro.
 */

function Logo({ compact }: { compact?: boolean }) {
  const { marca, temMarca } = useMarcaClinica();

  // Com marca da clínica: a assinatura de quem cuida do paciente fica em cima,
  // e a plataforma vira a linha de baixo, discreta. Sem marca: só a plataforma.
  if (temMarca) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
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
    <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-border">
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
  refCabecalho,
  children,
}: {
  id: string;
  titulo: string;
  aberto: boolean;
  onAlternar: () => void;
  /** Só o grupo recém-aberto recebe a ref — é ele que precisa rolar para a vista. */
  refCabecalho?: (el: HTMLButtonElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        ref={refCabecalho}
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
 * Rodapé fixo do menu: o bloco de conta e, numa linha só, "Preferências" e
 * "Sair".
 *
 * O nome é o de quem está logado de verdade (perfil > e-mail), nunca um nome
 * de exemplo: um app de saúde que mostra o nome errado na lateral é um app em
 * que o paciente para de confiar nos números da tela do lado.
 *
 * ── Por que as duas últimas linhas viraram uma ────────────────────────
 * Eram três blocos empilhados de 48–56px: Preferências, conta, Sair. Somados
 * com o respiro, 185px de uma lateral de 900px — mais de um quinto da altura
 * gasto no que o paciente usa uma vez por mês, enquanto o menu propriamente
 * dito ficava sem 314px e escondia Exames e Consultas (ver o comentário de
 * altura no topo do arquivo). Agora "Preferências" e "Sair" dividem uma
 * linha de 44px, lado a lado: continuam sendo alvo de toque legítimo, com
 * ícone E texto, e devolvem ~65px ao menu. O bloco de conta continua com a
 * altura que tinha — ele é o único dos três que o paciente procura.
 */
function RodapeMenu({ onItemClick }: { onItemClick?: () => void }) {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();

  const nome = profile?.full_name?.trim() || user?.email || "Minha conta";
  const iniciais = iniciaisDe(profile?.full_name?.trim() || user?.email || "");

  return (
    <div className="border-t border-border p-2.5 space-y-1">
      <NavLink
        to={NAV_CONTA.path}
        onClick={onItemClick}
        aria-current={location.pathname === NAV_CONTA.path ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 min-h-[52px] rounded-2xl px-2 py-1.5 transition-colors hover:bg-cardio-50",
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
          aparelho de outra pessoa. Fica discreto — não compete com nada.
          Divide a linha com "Preferências": os dois são manutenção do app,
          não saúde, e juntos ocupam a altura que um deles ocupava. */}
      {/* `1fr auto` e não `grid-cols-2`: em duas colunas iguais sobravam 68px
          para "Preferências", que virava "Prefer…" — e rótulo truncado num
          menu é um rótulo que não cumpre a função de rótulo. "Sair" tem
          quatro letras e não precisa de metade da linha. */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
        {NAV_FOOTER.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            end
            onClick={onItemClick}
            aria-current={location.pathname === item.path ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 min-h-[44px] px-2.5 rounded-xl text-sm font-medium",
              "text-muted-foreground transition-colors hover:bg-cardio-50 hover:text-cardio-dark",
              location.pathname === item.path && "bg-cardio-50 text-cardio-dark font-semibold"
            )}
          >
            {/* Sem ícone nesta linha, de propósito: com ícone sobravam ~95px
                para "Preferências" e a palavra virava "Preferênci…". Entre o
                desenho e a palavra inteira, num menu, ganha a palavra. */}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          onClick={signOut}
          className="flex items-center gap-2 min-h-[44px] px-2.5 rounded-xl text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden="true" /> Sair
        </button>
      </div>
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

  /**
   * UM grupo aberto por vez (acordeão exclusivo).
   *
   * Antes o estado era uma LISTA de abertos e nada nunca fechava sozinho:
   * duas seções abertas somavam 15 linhas e estouravam qualquer altura de
   * notebook. Com um só, o pior caso é o grupo de 11 itens — e o paciente
   * ganha a regra mais simples que existe: abriu um, fechou o outro.
   */
  const [aberto, setAberto] = useState<NavGroupKey | null>(() => grupoDaRota(location.pathname));

  useEffect(() => {
    const atual = grupoDaRota(location.pathname);
    if (atual) setAberto(atual);
  }, [location.pathname]);

  const areaRef = useRef<HTMLElement | null>(null);
  const cabecalhoAbertoRef = useRef<HTMLButtonElement | null>(null);
  const [temMaisAbaixo, setTemMaisAbaixo] = useState(false);
  const [rolou, setRolou] = useState(false);

  /**
   * Mede se sobra conteúdo fora da vista. É isso que liga o degradê e o botão
   * "mais opções" — sem a medida, o sinal ou mentiria (aparecendo com a lista
   * inteira visível) ou sumiria justamente quando é necessário.
   */
  const medirRolagem = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const fim = el.scrollHeight - el.clientHeight - el.scrollTop;
    setTemMaisAbaixo(fim > 8);
    setRolou(el.scrollTop > 8);
  }, []);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    medirRolagem();
    // ResizeObserver e não só o `scroll`: abrir ou fechar um grupo muda a
    // altura do conteúdo sem rolar nada, e sem observar o tamanho o degradê
    // ficaria preso no estado anterior.
    const ro = new ResizeObserver(medirRolagem);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [medirRolagem]);

  // Abrir um grupo que está no fim da lista não mostrava nada do que foi
  // aberto: o conteúdo nascia abaixo da dobra da lateral.
  useEffect(() => {
    if (!aberto) return;
    cabecalhoAbertoRef.current?.scrollIntoView({ block: "nearest" });
    medirRolagem();
  }, [aberto, medirRolagem]);

  const alternar = (key: NavGroupKey) => setAberto((prev) => (prev === key ? null : key));

  return (
    <>
      <Logo />

      {/* `relative` para ancorar o degradê e o botão de "mais opções", que são
          irmãos da área que rola — dentro dela eles rolariam junto e sumiriam
          exatamente quando são necessários. */}
      <div className="relative flex-1 min-h-0">
        {/* min-h-0 é o que faz o overflow funcionar dentro de um flex column:
            sem ele o filho cresce para além da coluna e os últimos itens do
            menu ficam inalcançáveis embaixo do rodapé.

            `scrollbar-gutter: stable` reserva a calha da barra de rolagem: sem
            ela, abrir um grupo grande estreitava a lista inteira em 15px e
            todos os rótulos davam um pulinho para a esquerda. */}
        <nav
          ref={areaRef}
          onScroll={medirRolagem}
          aria-label="Menu principal"
          className="h-full overflow-y-auto overscroll-contain px-3 py-3 space-y-2 [scrollbar-gutter:stable]"
        >
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
              const estaAberto = aberto === grupo.key;
              return (
                <GrupoRecolhivel
                  key={grupo.key}
                  id={`grupo-nav-${grupo.key}`}
                  titulo={grupo.label}
                  aberto={estaAberto}
                  onAlternar={() => alternar(grupo.key)}
                  refCabecalho={estaAberto ? (el) => { cabecalhoAbertoRef.current = el; } : undefined}
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

          {/* Folga no fim da lista: sem ela o último item encostava no degradê
              e continuava parecendo cortado — que era o defeito original.
              Incondicional de propósito: se ela aparecesse só quando há mais
              abaixo, chegar ao fim removeria a folga, o conteúdo encolheria e
              a medida de rolagem oscilaria entre dois estados. */}
          <div className="h-7" aria-hidden />
        </nav>

        {/* Degradê de topo: diz "você rolou, há coisa acima". Pequeno de
            propósito — em cima o sinal é confirmação, embaixo é convite. */}
        {rolou ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-gradient-to-b from-card to-transparent" aria-hidden />
        ) : null}

        {/* Degradê: faz o item esmaecer na borda da lista em vez de aparecer
            fatiado atrás do bloco vermelho, que era o defeito medido.
            `pointer-events-none` — ele é pintura, não obstáculo. */}
        {temMaisAbaixo ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card via-card/85 to-transparent" aria-hidden />
        ) : null}
      </div>

      {/*
        A faixa "mais opções" — o sinal explícito de que a lista continua.

        Ela mora NO FLUXO, abaixo da área que rola, e não flutuando por cima
        dela. A primeira versão era uma pílula absoluta e reintroduzia em
        miniatura o problema que o degradê acabara de resolver: no ponto
        central do último item visível, `elementFromPoint` devolvia a pílula,
        não o link. Sobreposta a um alvo de toque, qualquer affordance é um
        ladrão de clique.

        A ALTURA É FIXA e existe mesmo quando não há nada a anunciar. Se a
        faixa aparecesse e sumisse, a área que rola mudaria de tamanho, o
        cálculo de "há mais abaixo" mudaria junto, e os dois ficariam se
        ligando e desligando um ao outro.

        `aria-hidden`: para quem usa leitor de tela isto não é destino nenhum
        — a lista inteira já é percorrida por Tab, rolando sozinha.
      */}
      <div className="h-8 shrink-0 px-3" aria-hidden>
        {temMaisAbaixo ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => areaRef.current?.scrollBy({ top: 220, behavior: "smooth" })}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 rounded-lg py-1",
              "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
              "transition-colors hover:bg-cardio-50 hover:text-cardio-dark"
            )}
          >
            mais opções
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>

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
