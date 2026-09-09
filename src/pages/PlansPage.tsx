import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageTransition, PageHeader } from "@/components/shell";
import { PLANS, PRO_FEATURES, type FeatureKey } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Check, X, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { analytics } from "@/lib/analytics";

const FEATURE_ORDER: FeatureKey[] = [
  "risk_queue",
  "auto_alerts",
  "titration",
  "pdf_reports",
  "wearable_sync",
  "multi_doctor",
  "clinic_branding",
];

const PLAN_RANK: Record<string, number> = { free: 0, consultorio: 1, clinica: 2, rede: 3 };

export default function PlansPage() {
  const navigate = useNavigate();

  useEffect(() => {
    analytics.planPageViewed();
  }, []);

  const goCriarConta = (planKey: string) => {
    analytics.planSelected(planKey, PLANS.find((p) => p.key === planKey)?.price ?? 0);
    navigate("/pro/auth");
  };

  return (
    <PageTransition>
      <PageHeader
        title="Planos para cardiologistas"
        subtitle="Quem paga é o médico. O app do seu paciente é sempre gratuito."
      />

      {/* Cards de plano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={cn(
              "rounded-2xl bg-card border p-6 flex flex-col",
              plan.highlighted ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border"
            )}
          >
            {plan.badge && (
              <span className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary mb-2 bg-cardio-50 rounded-full px-2.5 py-1">
                <Crown className="h-3 w-3" />
                {plan.badge}
              </span>
            )}
            <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>
            <div className="mb-6">
              {plan.price === -1 ? (
                <span className="text-2xl font-bold text-foreground">{plan.priceLabel}</span>
              ) : (
                <>
                  <span className="text-3xl font-extrabold text-foreground">R$ {plan.price}</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </>
              )}
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((f) => (
                <li key={f.label} className="flex items-start gap-2 text-sm">
                  {f.included ? (
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={f.included ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                </li>
              ))}
            </ul>
            <Button
              variant={plan.highlighted ? "default" : "outline"}
              className="w-full touch-target"
              onClick={() => goCriarConta(plan.key)}
            >
              {plan.price === -1 ? "Falar com comercial" : "Começar"}
            </Button>
          </div>
        ))}
      </div>

      {/* Tabela comparativa */}
      <div className="mt-12">
        <h2 className="text-lg font-bold text-foreground mb-4">Comparar recursos</h2>
        <div className="rounded-2xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Recurso</th>
                {PLANS.map((plan) => (
                  <th key={plan.key} className="px-4 py-3 font-semibold text-foreground text-center whitespace-nowrap">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FEATURE_ORDER.map((key) => {
                const feature = PRO_FEATURES[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{feature.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{feature.description}</div>
                    </td>
                    {PLANS.map((plan) => {
                      const included = PLAN_RANK[plan.key] >= PLAN_RANK[feature.minPlan];
                      return (
                        <td key={plan.key} className="px-4 py-3 text-center">
                          {included ? (
                            <Check className="h-4 w-4 text-primary inline-block" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/50 inline-block" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Observação */}
      <div className="mt-8 rounded-2xl bg-cardio-50 border border-border p-5 text-sm text-foreground">
        <strong>O paciente nunca paga.</strong> O app de acompanhamento do paciente — registro de
        pressão, peso, sintomas, adesão e conexão com a pulseira — é gratuito em todos os planos.
        A assinatura cobre apenas o painel do cardiologista.
      </div>
    </PageTransition>
  );
}
