import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Bell, LogOut, Menu, Calendar, MessageSquare, FileText, ClipboardCheck, BarChart3, Settings, Palette, Stethoscope, MessageSquarePlus, MessageCircleHeart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalProfile, useProfessionalAlerts, useProfessionalPatients, usePatientMessages } from "@/hooks/useProfessional";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const SPECIALTY_LABELS: Record<string, string> = {
  cardiologist: "Cardiologista",
  clinician: "Clínico geral",
  nurse: "Enfermagem",
  nutritionist: "Nutricionista",
};

const PRO_NAV = [
  { label: "Painel",        path: "/pro/dashboard",  icon: LayoutDashboard, exact: true },
  { label: "Pacientes",     path: "/pro/pacientes",  icon: Users },
  { label: "Alertas",       path: "/pro/alertas",    icon: Bell, badge: "alerts" as const },
  { label: "Mensagens",     path: "/pro/mensagens",  icon: MessageSquare, badge: "messages" as const },
  { label: "Agenda",        path: "/pro/agenda",     icon: Calendar },
  { label: "Exames",        path: "/pro/exames",     icon: FileText },
  { label: "Relatórios",    path: "/pro/relatorios", icon: BarChart3 },
  { label: "Feedback",      path: "/pro/feedback",   icon: MessageSquarePlus },
  { label: "Marca da clínica", path: "/pro/marca", icon: Palette },
  { label: "Configurações", path: "/pro/conta",      icon: Settings },
];

function ProLogo() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <img src="/logo-symbol.png" alt="Encorpei" width={40} height={40} className="object-contain shrink-0" style={{ width: 40, height: 40 }} />
      <div className="flex flex-col leading-tight">
        <span className="font-display font-medium text-[17px] tracking-tight text-foreground">Encorpei</span>
        <span className="font-script text-[14px] text-primary -mt-0.5">Cardio · Painel do médico</span>
      </div>
    </div>
  );
}

function ProSidebarNav({ onItemClick }: { onItemClick?: () => void }) {
  const location = useLocation();
  const { alerts } = useProfessionalAlerts();
  const unreadAlerts = alerts.filter((a) => !a.is_read).length;

  // Badge de mensagens: soma o não lido de cada thread ativa.
  const { patients } = useProfessionalPatients();
  const activePatientIds = useMemo(
    () => patients.filter((p) => p.status === "active" && !!p.patient_user_id).map((p) => p.patient_user_id),
    [patients],
  );
  const unreadMessages = useUnreadMessages(activePatientIds);

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
      {PRO_NAV.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors",
              "text-muted-foreground hover:text-cardio-dark hover:bg-cardio-50",
              isActive && "bg-cardio-50 text-cardio-dark font-semibold",
            )}
            onClick={onItemClick}
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{item.label}</span>
            {item.badge === "alerts" && unreadAlerts > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                {unreadAlerts}
              </span>
            )}
            {item.badge === "messages" && unreadMessages > 0 && (
              <span className="bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-tight">
                {unreadMessages > 99 ? "99+" : unreadMessages}
              </span>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function ProSidebarFooter({ onItemClick }: { onItemClick?: () => void }) {
  const { signOut } = useAuth();
  const { profile } = useProfessionalProfile();

  return (
    <div className="p-3 border-t border-border space-y-1">
      {profile && (
        <NavLink
          to="/pro/conta"
          className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-secondary transition-colors"
          onClick={onItemClick}
        >
          <div className="h-9 w-9 rounded-full grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-cardio to-cardio-dark">
            {(profile.display_name ?? "Dr").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate leading-tight">{profile.display_name}</div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {SPECIALTY_LABELS[profile.specialty] ?? profile.specialty}
            </div>
          </div>
        </NavLink>
      )}
      <button
        onClick={signOut}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-muted-foreground hover:bg-secondary transition-colors"
      >
        <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sair
      </button>
    </div>
  );
}

export function ProShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <ProLogo />
        <ProSidebarNav />
        <ProSidebarFooter />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile TopBar */}
        <header
          className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 pb-2 border-b border-border bg-card/90 backdrop-blur-md"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)", minHeight: "calc(env(safe-area-inset-top, 0px) + 60px)" }}
        >
          <ProLogo />
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="touch-target">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 bg-card flex flex-col">
              <div className="border-b border-border">
                <ProLogo />
              </div>
              <ProSidebarNav onItemClick={() => setDrawerOpen(false)} />
              <ProSidebarFooter onItemClick={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
