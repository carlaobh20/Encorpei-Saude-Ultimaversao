import { Navigate, Outlet } from "react-router-dom";
import { ShieldAlert, FlaskConical } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { getDevBypass, clearDevBypass } from "@/contexts/DevBypass";
import { Button } from "@/components/ui/button";

/**
 * Gate do painel administrativo. Não usa dev bypass (modo demo nunca é
 * admin) e não desloga quem não é admin — a mesma sessão pode ser de uma
 * paciente ou médico legítimo em outra aba, então só bloqueamos a rota,
 * sem mexer no login dela.
 *
 * Erro comum: quem estava testando o app em Modo Demonstração (faixa
 * amarela) chega aqui com um usuário fake — que nunca é admin. Sem esse
 * aviso específico, isso parecia "Acesso negado" genérico e confundia.
 */
export function AdminProtectedRoute() {
  const { user, loading } = useAuth();
  const { isAdmin, isLoading } = useIsAdmin();
  const bypass = getDevBypass();

  if (loading || (user && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-lg bg-foreground/20 animate-pulse" />
      </div>
    );
  }

  if (bypass) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-amber-100 grid place-items-center">
          <FlaskConical className="h-6 w-6 text-amber-700" />
        </div>
        <div className="space-y-1 max-w-[320px]">
          <p className="text-sm font-semibold text-foreground">Você está em Modo Demonstração.</p>
          <p className="text-xs text-muted-foreground">O painel administrativo não funciona em modo demo. Saia do modo demo e entre com seu e-mail e senha de verdade.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { clearDevBypass(); window.location.href = "/admin/auth"; }}
        >
          Sair do modo demo
        </Button>
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/auth" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1 max-w-[280px]">
          <p className="text-sm font-semibold text-foreground">Acesso negado.</p>
          <p className="text-xs text-muted-foreground">Esta conta não tem acesso ao painel administrativo.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => (window.location.href = "/admin/auth")}>
          Voltar
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
