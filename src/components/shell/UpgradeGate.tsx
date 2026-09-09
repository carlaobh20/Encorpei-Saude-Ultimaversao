import { useProfessionalProfile } from "@/hooks/useProfessional";
import { getRequiredPlan, getPlanLabel, type GatedFeature } from "@/lib/planGating";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import type { ReactNode } from "react";

interface UpgradeGateProps {
  /** Feature being gated */
  feature: GatedFeature;
  /** Content to show when user has access (optional for inline mode) */
  children?: ReactNode;
  /** Optional custom message */
  message?: string;
  /** Show as inline badge instead of full block */
  inline?: boolean;
  /** Optional benefits to display in the premium gate */
  benefits?: string[];
}

/** Centralized upgrade gate. Premium block when locked. */
export function UpgradeGate({ feature, children, message, inline = false, benefits }: UpgradeGateProps) {
  const { profile, isLoading } = useProfessionalProfile();
  const canAccess = (_f: GatedFeature) => {
    // O gate vale para o painel do médico: quem define o acesso é o plano dele.
    // Paciente nunca é barrado — o app dele é sempre gratuito (docs §5).
    const plano = profile?.plan_type;
    return !plano || plano === "clinica" || plano === "rede" || plano === "consultorio";
  };
  const navigate = useNavigate();

  if (isLoading) return null;

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  const requiredPlan = getRequiredPlan(feature);
  const planName = getPlanLabel(requiredPlan);
  const defaultMessage = `Disponível a partir do plano ${planName}`;

  const handleUpgradeClick = () => {
    analytics.upgradeClicked("upgrade_gate", feature);
    navigate("/planos");
  };

  if (inline) {
    return (
      <button
        onClick={handleUpgradeClick}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
      >
        <Lock className="h-3 w-3" />
        <span>{message || defaultMessage}</span>
      </button>
    );
  }

  const defaultBenefits = [
    "Acesso completo ao módulo",
    "Registros ilimitados",
    "Estatísticas avançadas",
    "Insights personalizados",
  ];
  const displayBenefits = benefits ?? defaultBenefits;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Premium header gradient */}
      <div className="relative px-6 pt-8 pb-6 text-center bg-gradient-to-br from-[hsl(var(--primary)/0.08)] via-[hsl(var(--primary)/0.04)] to-transparent">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">
          Recurso Premium
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
          {message || defaultMessage}
        </p>
      </div>

      {/* Benefits */}
      <div className="px-6 pb-4">
        <div className="space-y-2.5">
          {displayBenefits.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm text-foreground">{b}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6 pt-2">
        <Button className="w-full h-11 text-sm font-semibold gap-2" onClick={handleUpgradeClick}>
          <Sparkles className="h-4 w-4" />
          Conhecer plano {planName}
        </Button>
      </div>
    </div>
  );
}
