import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, Plus, Siren, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { NavLink } from "@/components/NavLink";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PWAInstallPrompt } from "@/components/shell/PWAInstallPrompt";
import { BOTTOM_NAV, NAV_FOOTER, NAV_STRUCTURE, type NavItem } from "@/config/navigation";
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
 * Desenho pensado para quem tem 60–75 anos: alvos de toque grandes, uma
 * barra inferior com 4 destinos no celular, e o botão de emergência sempre
 * na tela — nunca escondido dentro de um menu.
 */

function Logo({ compact }: { compact?: boolean }) {
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
          <div className="font-display text-base font-semibold tracking-tight text-foreground leading-none">
            Encorpei
          </div>
          <div className="font-script text-[13px] text-primary leading-none mt-1">Cardio</div>
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
      className={cn(
        "flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-colors",
        "text-muted-foreground hover:text-cardio-dark hover:bg-cardio-50",
        ativo && "bg-cardio-50 text-cardio-dark font-semibold",
        item.tone === "danger" && "text-error hover:text-error hover:bg-error/10",
        item.tone === "danger" && ativo && "bg-error/10 text-error"
      )}
    >
      <item.icon className="h-[20px] w-[20px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {badge && badge > 0 ? (
        <span className="shrink-0 bg-primary text-primary-foreground text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-tight">
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
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
      {NAV_STRUCTURE.map((grupo) => (
        <div key={grupo.key} className="space-y-0.5">
          <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
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
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
      >
        <LogOut className="h-5 w-5" strokeWidth={1.75} /> Sair
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
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 bg-warning/15 border-b border-warning/40 px-4 py-2 text-[13px] text-foreground">
      <span className="font-medium">
        Modo demonstração — dados fictícios, nada é salvo.
      </span>
      <button
        onClick={() => {
          clearDevBypass();
          navigate("/landing");
          window.location.reload();
        }}
        className="shrink-0 inline-flex items-center gap-1 font-semibold text-warning-foreground hover:underline"
      >
        <X className="h-3.5 w-3.5" /> Sair do demo
      </button>
    </div>
  );
}

/** Botão de emergência — fixo, alcançável de qualquer tela. */
/**
 * Botão sempre visível. Leva à triagem (`/como-estou`), e não direto ao 192,
 * porque a tela de triagem já abre com o botão de ligar no topo e com a lista
 * de sinais de alarme — atende tanto quem está com medo quanto quem está
 * passando mal, sem transformar susto em ligação desnecessária nem atrasar
 * quem precisa de socorro. Ver docs/ENGAJAMENTO-CARDIO.md §3.2.
 */
function BotaoEmergencia() {
  const location = useLocation();
  if (location.pathname === "/emergencia" || location.pathname === "/como-estou") return null;

  return (
    <NavLink
      to="/como-estou"
      className="fixed right-4 bottom-24 lg:bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-error px-4 py-3 text-white shadow-lg shadow-error/30 hover:brightness-110 transition"
    >
      <Siren className="h-5 w-5" strokeWidth={2} />
      <span className="text-sm font-semibold">Não estou bem</span>
    </NavLink>
  );
}

function BarraInferior() {
  const location = useLocation();
  const naoLidas = useMensagensNaoLidas();
  const [registroAberto, setRegistroAberto] = useState(false);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-center">
        {BOTTOM_NAV.slice(0, 2).map((item) => (
          <BotaoBarra key={item.id} item={item} ativo={location.pathname === item.path} badge={item.badge === "medico" ? naoLidas : undefined} />
        ))}
        {/* O botão do meio registra — não navega. Registrar é o ato que o app
            existe para tornar barato; a tela inicial fica a um toque do ícone. */}
        <button
          type="button"
          onClick={() => setRegistroAberto(true)}
          aria-label="Registrar"
          className="flex flex-col items-center justify-center py-1.5"
        >
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </span>
          <span className="text-[10px] font-semibold text-primary mt-0.5">Registrar</span>
        </button>
        {BOTTOM_NAV.slice(2).map((item) => (
          <BotaoBarra key={item.id} item={item} ativo={location.pathname === item.path} badge={item.badge === "medico" ? naoLidas : undefined} />
        ))}
      </div>
      <RegistroRapido aberto={registroAberto} onFechar={() => setRegistroAberto(false)} />
    </nav>
  );
}

function BotaoBarra({ item, ativo, badge }: { item: NavItem; ativo: boolean; badge?: number }) {
  return (
    <NavLink
      to={item.path}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium",
        ativo ? "text-primary" : "text-muted-foreground"
      )}
    >
      <item.icon className="h-[22px] w-[22px]" strokeWidth={ativo ? 2 : 1.75} />
      {item.label}
      {badge && badge > 0 ? (
        <span className="absolute top-1 right-[22%] h-2 w-2 rounded-full bg-primary" />
      ) : null}
    </NavLink>
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
        <p className="text-[13px] font-semibold truncate">{marca.clinica ?? marca.medico}</p>
        {marca.subtitulo ? (
          <p className="text-[10px] text-muted-foreground truncate">{marca.subtitulo}</p>
        ) : null}
      </div>
    </div>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Toda troca de tela volta ao topo — sem isso, quem vem de uma lista longa
  // abre a próxima página no meio dela.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <Logo />
        <Navegacao />
        <RodapeNav />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <FaixaDemo />

        {/* Cabeçalho — celular */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-card/95 backdrop-blur border-b border-border px-3 py-2">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
              <Logo />
              <Navegacao onItemClick={() => setDrawerOpen(false)} />
              <RodapeNav onItemClick={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <MarcaNoTopo />
          <div className="w-10" />
        </header>

        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-8 pb-28 lg:pb-10 max-w-5xl w-full mx-auto">
          <ErrorBoundary scope="App">
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <BotaoEmergencia />
      <BarraInferior />
      <PWAInstallPrompt />
    </div>
  );
}
