import { Route, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LandingPage, AuthPage, StatusPage, NotFound, TermsPage, PrivacyPage,
  ResetPasswordPage, PlansPage, OnboardingPage, CuidadorHomePage,
} from "@/routes/lazy";

/** `/` leva à landing para visitante e ao app para quem já entrou. */
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Navigate to={user ? "/hoje" : "/landing"} replace />;
}

export const publicRoutes = (
  <>
    <Route path="/"               element={<RootRedirect />} />
    <Route path="/landing"        element={<LandingPage />} />
    <Route path="/auth"           element={<AuthPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/status"         element={<StatusPage />} />
    <Route path="/onboarding"     element={<OnboardingPage />} />
    <Route path="/termos"         element={<TermsPage />} />
    <Route path="/privacidade"    element={<PrivacyPage />} />
    <Route path="/planos"         element={<PlansPage />} />
    {/*
      Área do cuidador: precisa de conta, mas não de cadastro de paciente.

      ── Entrada do convidado (auditoria de setembro/2026) ────────────────
      `/cuidador` era uma rota sem NENHUM link no produto inteiro: o recurso
      existia — tela, permissões, aceite de código — e era inalcançável para
      quem recebia o convite. Pior, o texto do convite mandava "tocar em Sou
      cuidador", um botão que nunca existiu.

      O convite passou a mandar o endereço exato (CuidadoresPage), e
      `/sou-cuidador` existe como apelido porque é o nome que a pessoa já ouviu
      do parente e o que ela vai tentar digitar. Apelido redireciona, não
      duplica: uma tela, um endereço canônico.

      Falta ainda o link na tela de entrada (landing/login) — é lá que o
      convidado chega quando baixa o app sem o endereço em mãos.
    */}
    <Route path="/cuidador"       element={<CuidadorHomePage />} />
    <Route path="/sou-cuidador"   element={<Navigate to="/cuidador" replace />} />
  </>
);

export const notFoundRoute = <Route path="*" element={<NotFound />} />;
