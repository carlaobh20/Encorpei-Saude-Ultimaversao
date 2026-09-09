import { Route } from "react-router-dom";
import { lazy } from "react";
import { AdminProtectedRoute } from "@/components/admin/AdminProtectedRoute";
import { AdminShell } from "@/components/admin/AdminShell";

const AdminAuthPage      = lazy(() => import("@/pages/admin/AdminAuthPage"));
const AdminDashboardPage = lazy(() => import("@/pages/admin/AdminDashboardPage"));
const AdminDoctorsPage   = lazy(() => import("@/pages/admin/AdminDoctorsPage"));
const AdminUsersPage     = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminFeedbackPage  = lazy(() => import("@/pages/admin/AdminFeedbackPage"));
const AdminSettingsPage  = lazy(() => import("@/pages/admin/AdminSettingsPage"));

export const adminPublicRoutes = (
  <Route path="/admin/auth" element={<AdminAuthPage />} />
);

export const adminProtectedRoutes = (
  <Route element={<AdminProtectedRoute />}>
    <Route element={<AdminShell />}>
      <Route path="/admin"           element={<AdminDashboardPage />} />
      <Route path="/admin/medicos"   element={<AdminDoctorsPage />} />
      <Route path="/admin/usuarios"  element={<AdminUsersPage />} />
      <Route path="/admin/feedbacks" element={<AdminFeedbackPage />} />
      <Route path="/admin/config"    element={<AdminSettingsPage />} />
    </Route>
  </Route>
);
