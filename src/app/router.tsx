import { Suspense } from "react";
import { BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/shell/PageLoader";
import {
  publicRoutes, notFoundRoute,
  appRoutes,
  proPublicRoutes, proProtectedRoutes,
  adminPublicRoutes, adminProtectedRoutes,
} from "./routes";

/**
 * Gate herdado do Encorpei Saúde. O useRealtimeSync antigo assinava
 * 5 tabelas que não existem neste projeto (workout_logs, meals, etc.)
 * e abria um WebSocket por usuário à toa — desligado desde então.
 */
function RealtimeGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/**
 * App router — BrowserRouter + AuthProvider + lazy Suspense boundary.
 *
 * Route groups are defined in src/app/routes/ and composed here.
 * Adding a new area = create a routes file + add it below.
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RealtimeGate>
          <Suspense fallback={<PageLoader />}>
            <ErrorBoundary scope="Router">
              <Routes>
                {/* Public */}
                {publicRoutes}

                {/* Pro — public */}
                {proPublicRoutes}

                {/* Pro — authenticated */}
                {proProtectedRoutes}

                {/* App — authenticated */}
                {appRoutes}

                {/* Admin — público (login) */}
                {adminPublicRoutes}

                {/* Admin — autenticado */}
                {adminProtectedRoutes}

                {/* 404 */}
                {notFoundRoute}
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </RealtimeGate>
      </AuthProvider>
    </BrowserRouter>
  );
}
