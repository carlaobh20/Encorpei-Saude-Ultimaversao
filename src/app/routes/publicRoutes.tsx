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
    {/* Área do cuidador: precisa de conta, mas não de cadastro de paciente. */}
    <Route path="/cuidador"       element={<CuidadorHomePage />} />
  </>
);

export const notFoundRoute = <Route path="*" element={<NotFound />} />;
