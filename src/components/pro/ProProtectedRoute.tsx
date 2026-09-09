import { Navigate, Outlet } from "react-router-dom";
import { AlertTriangle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalProfile } from "@/hooks/useProfessional";
import { useHasPatientProfile, perfilDosMetadados } from "@/hooks/useAccountRoleCheck";
import { getDevBypass } from "@/contexts/DevBypass";
import { classifyError } from "@/lib/errorHandler";
import { Button } from "@/components/ui/button";
import { ProPendingApprovalScreen } from "@/components/pro/ProPendingApprovalScreen";
import { WrongPortalBlock } from "@/components/WrongPortalBlock";

export function ProProtectedRoute() {
  const { user, loading, isDevMode, signOut } = useAuth();
  const bypass = getDevBypass();
  const { profile, isLoading, isFetching, isError, error, refetch } = useProfessionalProfile();

  // Auditoria 26/08/2026 — defesa em profundidade: o bloqueio principal fica
  // na tela de login (ProAuthPage.tsx), mas uma sessão de paciente já
  // autenticada ANTES dessa correção pode ainda estar salva no navegador de
  // alguém. Sem isso, "sem cadastro de médico" cairia direto no onboarding
  // do médico (linha `if (!profile)` abaixo) e deixaria a conta de mamãe
  // terminar o onboarding errado. Só dispara quando realmente vamos precisar
  // da resposta.
  const shouldCheckCrossPortal = !!user && !isDevMode && !isLoading && !isFetching && !isError && !profile;
  const { data: patientFound, isLoading: crossCheckLoading } = useHasPatientProfile(user?.id, shouldCheckCrossPortal);

  // Dev bypass para médico
  if (isDevMode && bypass?.role === "medico") return <Outlet />;

  if (loading || isLoading || (!profile && isFetching) || (shouldCheckCrossPortal && crossCheckLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-lg gradient-brand animate-pulse" />
      </div>
    );
  }

  if (!user) return <Navigate to="/pro/auth" replace />;

  // Bug corrigido (25/08): uma falha passageira ao buscar o perfil (rede
  // instável logo após um refresh forçado, sessão renovando, etc.) fazia
  // `profile` ficar vazio do mesmo jeito que "perfil nunca criado" — e o
  // médico, que já tinha cadastro, era jogado de volta para o assistente
  // de "Configurar perfil" como se tivesse que cadastrar tudo de novo.
  // Agora distinguimos "deu erro ao buscar" de "realmente não existe":
  // erro mostra tela de tentar de novo, nunca manda para o onboarding.
  if (isError) {
    const classified = classifyError(error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1 max-w-[280px]">
          <p className="text-sm font-semibold text-foreground">Não foi possível carregar seu perfil.</p>
          <p className="text-xs text-muted-foreground">{classified.userMessage}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs font-semibold text-primary hover:underline px-3 py-1.5"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!profile && (patientFound || perfilDosMetadados(user) === "paciente")) {
    return (
      <WrongPortalBlock
        message="Este e-mail está cadastrado como paciente. Entre pelo portal do paciente para acessar sua conta."
        correctPortalLabel="o portal do paciente"
        correctPortalHref="/auth"
        onSignOut={signOut}
      />
    );
  }

  if (!profile) return <Navigate to="/pro/onboarding" replace />;

  // Cadastro existe, mas ainda não foi aprovado por um admin (ou foi
  // recusado) — sem acesso ao painel até isso mudar. Redesenho de 26/08/2026
  // (referência visual enviada pelo usuário) — ver ProPendingApprovalScreen.
  if (profile.approval_status === "pending") {
    return (
      <ProPendingApprovalScreen
        onSignOut={signOut}
        onLogoClick={async (e) => {
          e.preventDefault();
          try { await signOut(); } catch { /* mesmo se falhar, garante o reload abaixo */ }
          window.location.href = "/landing";
        }}
      />
    );
  }

  if (profile.approval_status === "rejected") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
          <XCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="space-y-1 max-w-[300px]">
          <p className="text-sm font-semibold text-foreground">Cadastro não aprovado.</p>
          <p className="text-xs text-muted-foreground">
            {profile.rejection_reason || "Sua conta não foi aprovada para acessar o painel."}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
      </div>
    );
  }

  return <Outlet />;
}
