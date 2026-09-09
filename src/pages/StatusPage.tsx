import { useState, useEffect, useCallback } from "react";
import { PageTransition, PageHeader } from "@/components/shell";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME, APP_VERSION, BUILD_SHA, BUILD_TIME, SUPABASE_URL, env } from "@/lib/config";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

interface ConexaoStatus {
  ok: boolean;
  latenciaMs: number;
  verificadoEm: string;
  mensagem?: string;
}

async function testarConexaoSupabase(): Promise<ConexaoStatus> {
  const t0 = Date.now();
  if (!SUPABASE_URL) {
    return {
      ok: false,
      latenciaMs: 0,
      verificadoEm: new Date().toISOString(),
      mensagem: "Supabase não configurado — app rodando só em modo demo.",
    };
  }
  const { error } = await supabase.from("profiles").select("user_id").limit(1);
  return {
    ok: !error,
    latenciaMs: Date.now() - t0,
    verificadoEm: new Date().toISOString(),
    mensagem: error?.message,
  };
}

export default function StatusPage() {
  const [status, setStatus] = useState<ConexaoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const verificar = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await testarConexaoSupabase());
    } catch (err) {
      setStatus({
        ok: false,
        latenciaMs: 0,
        verificadoEm: new Date().toISOString(),
        mensagem: err instanceof Error ? err.message : "Erro ao verificar conexão",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verificar();
  }, [verificar]);

  return (
    <PageTransition>
      <PageHeader title="Status do sistema" subtitle={`${APP_NAME} · ambiente ${env}`} />

      <div className="space-y-4 max-w-md mx-auto">
        {/* Conexão */}
        <div className="bg-card rounded-2xl border border-border p-6 text-center space-y-3">
          {loading ? (
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mx-auto" />
          ) : status?.ok ? (
            <CheckCircle className="h-12 w-12 text-success mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-error mx-auto" />
          )}

          <h2 className="text-xl font-bold text-foreground">
            {loading ? "Verificando..." : status?.ok ? "Tudo operacional" : "Problema na conexão"}
          </h2>

          {!loading && status?.mensagem && (
            <p className="text-sm text-muted-foreground">{status.mensagem}</p>
          )}
        </div>

        {/* Conexão — detalhes */}
        {status && !loading && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Banco de dados</span>
              <span className="text-sm font-semibold text-foreground">
                {status.ok ? "Conectado" : "Erro"}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Latência</span>
              <span className="text-sm font-semibold text-foreground">{status.latenciaMs}ms</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Verificado em</span>
              <span className="text-sm font-semibold text-foreground">
                {new Date(status.verificadoEm).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>
        )}

        {/* Versão do app */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Aplicativo</span>
            <span className="text-sm font-semibold text-foreground">{APP_NAME}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Versão</span>
            <span className="text-sm font-semibold text-foreground">{APP_VERSION}</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Build</span>
            <span className="text-sm font-mono text-foreground">{BUILD_SHA.slice(0, 12)}</span>
          </div>
          {BUILD_TIME && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Gerado em</span>
              <span className="text-sm font-semibold text-foreground">
                {new Date(BUILD_TIME).toLocaleString("pt-BR")}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">Ambiente</span>
            <span className="text-sm font-semibold text-foreground capitalize">{env}</span>
          </div>
        </div>

        <button
          onClick={verificar}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-opacity disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          Verificar novamente
        </button>
      </div>
    </PageTransition>
  );
}
