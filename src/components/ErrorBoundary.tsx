import { Component, useEffect, type ErrorInfo, type ReactNode } from "react";
import { monitor } from "@/lib/monitor";
import { isDev } from "@/lib/config";
import { getDevBypass } from "@/contexts/DevBypass";

interface Props {
  children: ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => ReactNode;
  scope?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    monitor.captureComponentError(
      error,
      info.componentStack,
      this.props.scope ?? "ErrorBoundary"
    );
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return <DefaultErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * Fallback de tela cheia. Usa window.location (não useNavigate) porque o
 * crash pode acontecer FORA do BrowserRouter (scope AppRoot no App.tsx).
 */
function DefaultErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  // Detecta erros conhecidos
  const isMissingTable = error.message?.includes("relation") && error.message?.includes("does not exist");
  const isNetworkError = error.message?.toLowerCase().includes("fetch") || error.message?.toLowerCase().includes("network");

  // Chunk velho apos deploy: import do lazy() da 404 ("Failed to fetch
  // dynamically imported module") e reset() re-falha pra sempre — so um
  // reload busca o index.html novo.
  const isChunkError = /dynamically imported/i.test(error.message ?? "");
  useEffect(() => {
    if (!isChunkError) return;
    if (sessionStorage.getItem("chunk_reload_at")) return; // um auto-reload por sessao, sem loop
    sessionStorage.setItem("chunk_reload_at", String(Date.now()));
    window.location.reload();
  }, [isChunkError]);

  // Area pro/medico volta pro painel; restante volta pro inicio
  const bypass = getDevBypass();
  const isProArea = window.location.pathname.startsWith("/pro");
  const isMedico = bypass?.role === "medico" || isProArea;

  // "/hoje" e a home do paciente. Ate a auditoria de setembro/2026 isto
  // apontava para "/minha-semana", tela do app de obstetricia que originou
  // este projeto: quem caia aqui era mandado para um redirect.
  const homeRoute = isMedico ? "/pro/dashboard" : "/hoje";
  const homeLabel = isMedico ? "Ir para o painel" : "Ir para início";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center gap-5">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <svg className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold text-foreground">
          {isMissingTable ? "Configuração pendente" : isNetworkError ? "Sem conexão" : "Algo deu errado"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isMissingTable
            ? "Esta funcionalidade precisa de uma migration no banco de dados. Execute o SQL no painel do Supabase."
            : isNetworkError
            ? "Verifique sua conexão com a internet e tente novamente."
            : "Ocorreu um erro inesperado. Tente novamente ou volte para o início."}
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => { if (isNetworkError) window.location.reload(); else reset(); }}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Tentar novamente
        </button>
        <button
          onClick={() => window.location.replace(homeRoute)}
          className="px-4 py-2 text-sm font-medium rounded-xl bg-secondary text-secondary-foreground hover:opacity-90 transition-opacity"
        >
          {homeLabel}
        </button>
      </div>

      {isDev && (
        <details className="mt-2 w-full max-w-md text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">Detalhes técnicos</summary>
          <pre className="mt-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap break-words">
            {error.message}
            {"\n\n"}
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  );
}