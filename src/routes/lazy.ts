import { lazy } from "react";

// Público
export const LandingPage      = lazy(() => import("@/pages/LandingPage"));
export const AuthPage         = lazy(() => import("@/pages/AuthPage"));
export const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
export const StatusPage       = lazy(() => import("@/pages/StatusPage"));
export const NotFound         = lazy(() => import("@/pages/NotFound"));
export const TermsPage        = lazy(() => import("@/pages/TermsPage"));
export const PrivacyPage      = lazy(() => import("@/pages/PrivacyPage"));
export const PlansPage        = lazy(() => import("@/pages/PlansPage"));

// App do paciente
export const HojePage         = lazy(() => import("@/pages/HojePage"));
export const PressaoPage      = lazy(() => import("@/pages/PressaoPage"));
export const AtividadePage    = lazy(() => import("@/pages/AtividadePage"));
export const SonoPage         = lazy(() => import("@/pages/SonoPage"));
export const RemediosPage     = lazy(() => import("@/pages/RemediosPage"));
export const ExamesPage       = lazy(() => import("@/pages/ExamesPage"));
export const AgendaPage       = lazy(() => import("@/pages/AgendaPage"));
export const MetasPage        = lazy(() => import("@/pages/MetasPage"));
export const PulseiraPage     = lazy(() => import("@/pages/PulseiraPage"));
export const SintomasPage     = lazy(() => import("@/pages/SintomasPage"));
export const EmergenciaPage   = lazy(() => import("@/pages/EmergenciaPage"));
export const MedicoChatPage   = lazy(() => import("@/pages/MedicoChatPage"));
export const ContaPage        = lazy(() => import("@/pages/ContaPage"));
export const ConfiguracoesPage = lazy(() => import("@/pages/ConfiguracoesPage"));
export const FeedbackPage     = lazy(() => import("@/pages/FeedbackPage"));
export const OnboardingPage   = lazy(() => import("@/pages/OnboardingPage"));

// Camada de engajamento (docs/ENGAJAMENTO-CARDIO.md)
export const MeuCoracaoPage   = lazy(() => import("@/pages/MeuCoracaoPage"));
export const ComoEstouPage    = lazy(() => import("@/pages/ComoEstouPage"));
export const CaminhadaPage    = lazy(() => import("@/pages/CaminhadaPage"));
export const AlimentacaoPage  = lazy(() => import("@/pages/AlimentacaoPage"));
export const AprenderPage     = lazy(() => import("@/pages/AprenderPage"));
export const MeuMesPage       = lazy(() => import("@/pages/MeuMesPage"));
export const CuidadoresPage   = lazy(() => import("@/pages/CuidadoresPage"));
export const CuidadorHomePage = lazy(() => import("@/pages/cuidador/CuidadorHomePage"));

// Painel do médico
export const ProAuthPage         = lazy(() => import("@/pages/pro/ProAuthPage"));
export const ProOnboardingPage   = lazy(() => import("@/pages/pro/ProOnboardingPage"));
export const ProDashboardPage    = lazy(() => import("@/pages/pro/ProDashboardPage"));
export const ProPatientsPage     = lazy(() => import("@/pages/pro/ProPatientsPage"));
export const ProPatientDetailPage = lazy(() => import("@/pages/pro/ProPatientDetailPage"));
export const ProAlertsPage       = lazy(() => import("@/pages/pro/ProAlertsPage"));
export const ProAgendaPage       = lazy(() => import("@/pages/pro/ProAgendaPage"));
export const ProMensagensPage    = lazy(() => import("@/pages/pro/ProMensagensPage"));
export const ProExamesPage       = lazy(() => import("@/pages/pro/ProExamesPage"));
export const ProRelatoriosPage   = lazy(() => import("@/pages/pro/ProRelatoriosPage"));
export const ProAccountPage      = lazy(() => import("@/pages/pro/ProAccountPage"));
export const ProFeedbackPage     = lazy(() => import("@/pages/pro/ProFeedbackPage"));
