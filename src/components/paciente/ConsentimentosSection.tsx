import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { getConsentState, revokeConsent, type ConsentType } from "@/lib/consent";
import { TituloSecao } from "@/components/shell";
import { Button } from "@/components/ui/button";

const TIPOS: { tipo: ConsentType; titulo: string; texto: string }[] = [
  { tipo: "health_data", titulo: "Dados de saúde", texto: "Usar seus registros no acompanhamento." },
  { tipo: "doctor_sharing", titulo: "Compartilhar com o médico", texto: "O médico vinculado pode ver o que você liberou." },
  { tipo: "analytics", titulo: "Estatísticas de uso", texto: "Ajudar a melhorar o app, sem dado clínico." },
];

/**
 * Lista e revoga os consentimentos já modelados em `src/lib/consent.ts`.
 * Não é a matriz de permissões por especialidade — isso fica fora deste recorte.
 */
export function ConsentimentosSection() {
  const { user } = useAuth();
  const demo = !!getDevBypass();
  const qc = useQueryClient();

  const { data: estado, isLoading } = useQuery({
    queryKey: ["consents", user?.id ?? "demo"],
    enabled: !!user && !demo,
    queryFn: () => getConsentState(user!.id),
  });

  const revogar = useMutation({
    mutationFn: async (tipo: ConsentType) => {
      if (demo || !user) {
        toast.info("Modo demo: nada é salvo.");
        return;
      }
      await revokeConsent(user.id, tipo, "settings");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consents"] });
      toast.success("Consentimento revogado.");
    },
    onError: () => toast.error("Não consegui revogar agora."),
  });

  return (
    <section>
      <TituloSecao titulo="Consentimentos" />
      {demo ? (
        <p className="text-base text-muted-foreground leading-relaxed">
          No modo demo os consentimentos não são gravados.
        </p>
      ) : isLoading ? (
        <p className="text-base text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="space-y-2.5">
          {TIPOS.map((item) => {
            const atual = estado?.[item.tipo];
            const ativo = atual?.status === "granted";
            return (
              <li key={item.tipo} className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
                  <Shield className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold text-foreground">{item.titulo}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.texto}</p>
                  <p className="text-sm mt-1 text-muted-foreground">
                    {ativo
                      ? `Ativo desde ${new Date(atual.at).toLocaleDateString("pt-BR")}`
                      : atual?.status === "revoked"
                        ? "Revogado"
                        : "Ainda não registrado"}
                  </p>
                </div>
                {ativo && (
                  <Button
                    variant="outline"
                    onClick={() => revogar.mutate(item.tipo)}
                    disabled={revogar.isPending}
                  >
                    {revogar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Revogar"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
