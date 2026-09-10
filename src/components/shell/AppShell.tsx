import { useEffect, useState, type CSSProperties } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Siren, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PWAInstallPrompt } from "@/components/shell/PWAInstallPrompt";
import {
  BOTTOM_NAV, NAV_FOOTER, NAV_STRUCTURE,
  type BottomNavItem, type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
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
 * equipe · Mais — e o botão de emergência sempre na tela, nunca escondido
 * dentro de um menu.
 *
 * Dois destinos da barra não navegam: "Registrar" abre a folha de registro
 * rápido e "Mais" abre o menu lateral. Ambos são <button>, não link falso:
 * assim o teclado e o leitor de tela anunciam o que eles realmente fazem.
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
        "text-muted-foreground hover:text-cardio-dark hover:bg-cardio-50",
        ativo && "bg-cardio-50 text-cardio-dark font-semibold",
        item.tone === "danger" && "text-error hover:text-error hover:bg-error/10",
        item.tone === "danger" && ativo && "bg-error/10 text-error"
      )}
    >
      <item.icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
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

function Navegacao({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const naoLidas = useMensagensNaoLidas();

  return (
    <nav aria-label="Menu principal" className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
      {NAV_STRUCTURE.map((grupo) => (
        <div key={grupo.key} className="space-y-0.5">
          {/* Os títulos dos grupos são exatamente os rótulos da barra
              inferior. Repetir a mesma palavra nos dois lugares é o que faz
              o paciente entender que "Mais" não é outro app: é o mesmo mapa,
              aberto por inteiro. */}
          <div className="px-3 pt-1 pb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {grupo.label}
          </div>
          {grupo.items.map((item) => (
            <ItemNav
              key={item.id}
              item={item}
              ativo={location.pathname === item.path}
              onClick={onItemClick}
              badge={item.badge === "medico" ? naoLidas : undefined}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

function RodapeNav({ onItemClick }: { onItemClick?: () => void }) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="p-3 border-t border-border space-y-0.5">
      {NAV_FOOTER.map((item) => (
        <ItemNav key={item.id} item={item} ativo={location.pathname === item.path} onClick={onItemClick} />
      ))}
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 min-h-[48px] px-3 py-3 rounded-xl text-base font-medium text-muted-foreground hover:bg-secondary transition-colors"
      >
        <LogOut className="h-6 w-6" strokeWidth={1.75} /> Sair
      </button>
    </div>
  );
}

/** Faixa do modo demo — visível de propósito, para nunca confundir com dado real. */
function FaixaDemo() {
  const demo = getDevBypass();
  const navigate = useNavigate();
  if (!demo) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-warning/15 border-b border-warning/40 px-4 py-2 text-sm text-foreground">
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
        "fixed right-4 z-40 inline-flex items-center gap-2 min-h-[48px] rounded-full",
        "bg-error px-4 py-3 text-white shadow-lg shadow-error/30 hover:brightness-110 transition",
        // Underscore vira espaço no Tailwind — e calc() sem espaço em volta
        // do "+" é CSS inválido, então ele é obrigatório aqui.
        "bottom-[calc(var(--barra-inferior)_+_0.75rem)] lg:bottom-6"
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
 */
function BarraInferior({
  onRegistrar,
  onMais,
  registroAberto,
  onFecharRegistro,
}: {
  onRegistrar: () => void;
  onMais: () => void;
  registroAberto: boolean;
  onFecharRegistro: () => void;
}) {
  const location = useLocation();
  const naoLidas = useMensagensNaoLidas();

  return (
    <nav
      aria-label="Navegação principal"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {/* grid-cols-5 com min-w-0 em cada célula: em 360px os rótulos mais
          longos ("Minha equipe") encolhem em vez de estourar a largura. */}
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
      <RegistroRapido aberto={registroAberto} onFechar={onFecharRegistro} />
    </nav>
  );
}

/** Estilo comum das cinco células: 56px de alvo, rótulo de 12px que nunca some. */
const CELULA_BARRA =
  "relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-0 px-1 py-2 " +
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
      className={cn(CELULA_BARRA, ativo ? "text-primary" : "text-muted-foreground")}
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
 * O botão do meio registra — não navega. Registrar é o ato que o app existe
 * para tornar barato: cobrar uma troca de tela para isso é cobrar pedágio no
 * único comportamento que queremos que vire hábito.
 */
function BotaoRegistrar({ item, onClick }: { item: BottomNavItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.descricao ?? item.label}
      aria-haspopup="dialog"
      className={cn(CELULA_BARRA, "text-primary")}
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
        <item.icon className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span className="w-full text-center font-semibold leading-tight">{item.label}</span>
    </button>
  );
}

/**
 * Topo do app: a marca da clínica do paciente quando ela existe, a marca da
 * plataforma quando não. Quem cuida dele assina a tela — é isso que faz o
 * paciente sentir que o app é do consultório dele, e não de um fornecedor.
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
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <Logo />
        <Navegacao />
        <RodapeNav />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <FaixaDemo />

        {/* Cabeçalho — celular. O mesmo menu que o botão "Mais" abre. */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-card/95 backdrop-blur border-b border-border px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu com todas as telas"
            aria-haspopup="dialog"
            className="h-11 w-11"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-6 w-6" aria-hidden="true" />
          </Button>
          <MarcaNoTopo />
          {/* Espaçador da mesma largura do botão, para a marca ficar centrada. */}
          <div className="w-11 shrink-0" aria-hidden="true" />
        </header>

        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="leitura-paciente w-[300px] max-w-[88vw] p-0 flex flex-col">
            <Logo />
            <Navegacao onItemClick={() => setDrawerOpen(false)} />
            <RodapeNav onItemClick={() => setDrawerOpen(false)} />
          </SheetContent>
        </Sheet>

        {/*
          Espaço reservado embaixo (auditoria §6): no celular o conteúdo
          termina acima da barra inferior E do botão "Não estou bem", que
          flutua logo acima dela. 9.5rem = barra (4rem) + botão (3rem) +
          folga, mais a área segura do aparelho. No desktop não há barra:
          basta limpar o botão flutuante.
        */}
        <main
          className={cn(
            "flex-1 px-4 py-5 lg:px-8 lg:py-8 max-w-5xl w-full mx-auto",
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
        registroAberto={registroAberto}
        onFecharRegistro={() => setRegistroAberto(false)}
      />
      <PWAInstallPrompt />
    </div>
  );
}
