import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { useHasProfessionalProfile } from "@/hooks/useAccountRoleCheck";
import { getDevBypass } from "@/contexts/DevBypass";
import { WrongPortalBlock } from "@/components/WrongPortalBlock";

export function ProtectedRoute() {
  const { user, loading, isDevMode, signOut } = useAuth();
  const bypass = getDevBypass();

  // Hooks SEMPRE no topo, antes de qualquer return condicional (regras dos Hooks)
  const { profile, loading: profileLoading, isFetching: profileFetching } = useProfile();
  const { data: patient, isLoading: patientLoading, isFetching: patientFetching } = useCardioPatient();

  // Auditoria 26/08/2026 — defesa em profundidade: o bloqueio principal fica
  // na tela de login (AuthPage.tsx), mas uma sessão de médico já autenticada
  // ANTES dessa correção pode ainda estar salva no navegador de alguém. Sem
  // isso, "sem cadastro de paciente" cairia no app do paciente e deixaria a
  // conta de médico terminar o cadastro errado. Só dispara quando realmente
  // vamos precisar da resposta — não pesa a navegação de quem já é paciente.
  const shouldCheckCrossPortal = !!user && !isDevMode && patient === null;
  const { data: proProfileFound, isLoading: crossCheckLoading } = useHasProfessionalProfile(user?.id, shouldCheckCrossPortal);

  // Dev bypass ativo — vai direto para app
  if (isDevMode && bypass) {
    // Médico → pro dashboard, paciente → minha semana
    if (bypass.role === "medico") return <Outlet />;
    return <Outlet />;
  }

  // null em cache (login recém-feito) NÃO é "sem perfil": pode ser refetch
  // em andamento. Sem esperar isFetching, o guard mandava o recém-chegado
  // de volta ao onboarding com o cache velho.
  //
  // Cadastro incompleto NÃO bloqueia o app: o Hoje mostra um cartão suave.
  // Só esperamos o fetch acabar para não tratar "ainda carregando" como
  // "não tem perfil".
  const waitingGate =
    !!user &&
    (profileLoading ||
      patientLoading ||
      ((profile == null || patient == null) &&
        (profileFetching || patientFetching)) ||
      (shouldCheckCrossPortal && crossCheckLoading));

  if (loading || waitingGate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cardio-500 animate-pulse flex items-center justify-center text-white text-xl">
            ❤️
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/landing" replace />;

  if (patient === null && proProfileFound) {
    return (
      <WrongPortalBlock
        message="Este e-mail está cadastrado como médico. Entre pelo portal do médico para acessar sua conta."
        correctPortalLabel="o portal do médico"
        correctPortalHref="/pro/auth"
        onSignOut={signOut}
      />
    );
  }

  if (!profile) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}
