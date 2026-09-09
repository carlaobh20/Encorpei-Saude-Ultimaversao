import { type ReactNode } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Page-level error fallback ────────────────────────

interface PageErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** Used as Suspense/ErrorBoundary fallback inside AppShell */
export function PageError({
  title = "Erro ao carregar página",
  description = "Não foi possível exibir esta seção. Tente novamente.",
  onRetry,
}: PageErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-5">
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

// ─── Inline card-level error ──────────────────────────

interface CardErrorProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

/** Small error state for cards/sections — doesn't break the page */
export function CardError({
  message = "Erro ao carregar dados",
  onRetry,
  compact = false,
}: CardErrorProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive py-2">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="underline hover:no-underline ml-1">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-primary hover:underline mt-1"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Network/offline error ────────────────────────────

export function OfflineError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center gap-4">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
        <WifiOff className="h-7 w-7 text-muted-foreground" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-base font-semibold text-foreground">Sem conexão</h3>
        <p className="text-sm text-muted-foreground">
          Verifique sua internet e tente novamente.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Recarregar
      </Button>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────

interface EmptyDataProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Consistent empty state for queries with no results */
export function EmptyData({ icon, title, description, action }: EmptyDataProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-4">
      {icon && (
        <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="space-y-1.5 max-w-[280px]">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action}
    </div>
  );
}
