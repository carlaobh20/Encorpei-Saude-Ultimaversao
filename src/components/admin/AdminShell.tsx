import { Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, MessageSquareWarning, Stethoscope, Settings, LogOut, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Médicos", path: "/admin/medicos", icon: Stethoscope, exact: false },
  { label: "Usuários", path: "/admin/usuarios", icon: Users, exact: false },
  { label: "Feedbacks", path: "/admin/feedbacks", icon: MessageSquareWarning, exact: false },
  { label: "Configurações", path: "/admin/config", icon: Settings, exact: false },
];

function AdminNav({ mobile }: { mobile?: boolean }) {
  const location = useLocation();

  return (
    <nav className={mobile ? "lg:hidden flex border-b border-white/10 px-2 overflow-x-auto" : "flex-1 overflow-y-auto px-3 py-2 space-y-0.5"}>
      {ADMIN_NAV.map((item) => {
        const isActive = item.exact
          ? location.pathname === item.path
          : location.pathname.startsWith(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={
              mobile
                ? cn(
                    "px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 border-transparent text-white/50",
                    isActive && "border-white text-white",
                  )
                : cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors",
                    "text-white/60 hover:text-white hover:bg-white/5",
                    isActive && "bg-white/10 text-white font-semibold",
                  )
            }
          >
            {!mobile && <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />}
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function AdminShell() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen w-full bg-[#151316] text-white">
      <aside className="hidden lg:flex lg:flex-col lg:w-60 border-r border-white/10 shrink-0 sticky top-0 h-screen">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center shrink-0">
            <ShieldCheck className="h-[18px] w-[18px]" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-[15px] tracking-tight">Encorpei</span>
            <span className="text-[12px] text-white/50 -mt-0.5">Admin</span>
          </div>
        </div>

        <AdminNav />

        <div className="p-3 border-t border-white/10 space-y-1">
          <p className="px-3 py-1.5 text-[11px] text-white/40 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-white/60 hover:bg-white/5 transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#151316]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-semibold text-sm">Admin</span>
        </div>
        <button onClick={signOut} className="text-white/60 text-xs">Sair</button>
      </header>

      <div className="flex-1 min-w-0 pt-14 lg:pt-0">
        <AdminNav mobile />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
