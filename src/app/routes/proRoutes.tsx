import { Route } from "react-router-dom";
import { ProProtectedRoute } from "@/components/pro/ProProtectedRoute";
import { ProShell } from "@/components/pro/ProShell";
import {
  ProAuthPage, ProOnboardingPage, ProDashboardPage, ProPatientsPage,
  ProPatientDetailPage, ProAlertsPage, ProAgendaPage, ProMensagensPage,
  ProExamesPage, ProRelatoriosPage, ProAccountPage, ProMarcaPage, ProFeedbackPage,
} from "@/routes/lazy";

export const proPublicRoutes = (
  <>
    <Route path="/pro"            element={<ProAuthPage />} />
    <Route path="/pro/auth"       element={<ProAuthPage />} />
    <Route path="/pro/onboarding" element={<ProOnboardingPage />} />
  </>
);

export const proProtectedRoutes = (
  <Route element={<ProProtectedRoute />}>
    <Route element={<ProShell />}>
      <Route path="/pro/dashboard"            element={<ProDashboardPage />} />
      <Route path="/pro/pacientes"            element={<ProPatientsPage />} />
      <Route path="/pro/pacientes/:patientId" element={<ProPatientDetailPage />} />
      <Route path="/pro/alertas"              element={<ProAlertsPage />} />
      <Route path="/pro/agenda"               element={<ProAgendaPage />} />
      <Route path="/pro/mensagens"            element={<ProMensagensPage />} />
      <Route path="/pro/exames"               element={<ProExamesPage />} />
      <Route path="/pro/relatorios"           element={<ProRelatoriosPage />} />
      <Route path="/pro/conta"                element={<ProAccountPage />} />
      <Route path="/pro/marca"                element={<ProMarcaPage />} />
      <Route path="/pro/feedback"             element={<ProFeedbackPage />} />
    </Route>
  </Route>
);
