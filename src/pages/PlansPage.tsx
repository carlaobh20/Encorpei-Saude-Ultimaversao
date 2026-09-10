/**
 * PLANOS — a página comercial, ajustada para não prometer o que não existe.
 *
 * O que estava errado aqui: os planos anunciavam alerta por SMS, equipe
 * multidisciplinar, multiunidade e integração com PEP/HIS como recursos
 * inclusos, com preço ao lado. Nenhum dos quatro existe no código — uma busca
 * por "sms" no `src/` só encontra o próprio rótulo do plano, e `planGating.ts`
 * tem as chaves (`sms_alerts`, `multi_unit`, `api_access`) sem nada por trás.
 * Além disso o botão "Contratar" levava ao cadastro e o "Falar com comercial"
 * levava ao MESMO cadastro, com preço em destaque — desenho de checkout num
 * produto que não processa pagamento nenhum.
 *
 * Regra adotada: o que existe aparece normal; o que não existe continua
 * listado (é roadmap real e o médico merece saber para onde o produto vai),
 * mas com selo "em desenvolvimento", sem check de incluso e explicitamente
 * fora do que o preço cobre. E o caminho comercial é contato humano de
 * verdade, não um botão que finge cobrança.
 *
 * A lista de pendências vive AQUI e não em `config/plans.ts` de propósito
 * imediato — plans.ts é a fonte da oferta; esta é a camada de honestidade
 * sobre ela. Quando um item entrar em produção, basta tirá-lo do Set abaixo.
 */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PageTransition, PageHeader } from "@/components/shell";
import { PLANS, PRO_FEATURES, type FeatureKey } from "@/config/plans";
import { Button } from "@/components/ui/button";
import { Check, X, Crown, Hammer, Mail } from "lucide-react";
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

/** Para onde vai quem quer falar com gente de verdade (mesmo endereço dos Termos). */
const EMAIL_COMERCIAL = "contato@encorpei.com";

/**
 * Rótulos de `config/plans.ts` que descrevem coisas ainda NÃO implementadas.
 *
 * Casado por rótulo exato porque plans.ts não tem id por item. Se um rótulo
 * mudar lá, o item volta a aparecer como incluso — por isso a checagem de
 * cobertura logo abaixo, que grita no console em dev quando isso acontece.
 */
const EM_DESENVOLVIMENTO = new Set<string>([
  // Não existe envio de SMS em lugar nenhum do código. Push existe pela metade
  // (cliente registra a subscription, backend de envio não existe — ver
  // lib/notifications.ts), então o item inteiro fica como pendente.
  "Alertas por push + SMS",
  // Não há noção de equipe: o profissional é único por conta.
  "Equipe multidisciplinar (enfermagem, nutrição)",
  "Até 5 médicos no mesmo painel",
  "Vários médicos no mesmo painel",
  "Médicos ilimitados",
  "Painel administrativo com indicadores",
  // Nenhuma unidade/rede modelada no banco.
  "Multiunidade com painel centralizado",
  "Indicadores populacionais (controle de PA, LDL, adesão)",
  // Não há API pública nem qualquer conector de prontuário.
  "API e integrações",
  "API aberta + integração com PEP/HIS",
  // Compromissos de serviço que ninguém assumiu contratualmente ainda.
  "Suporte prioritário no WhatsApp",
  "Gerente de conta dedicado",
  "SLA de suporte com tempo de resposta",
  "Treinamento da equipe",
  "Customização de protocolos",
  "Contrato anual com desconto",
  // Programa de hardware com marca: não existe operação por trás.
  "Programa de pulseiras com a marca da clínica",
  // Limite de pacientes não é aplicado em lugar nenhum (PLAN_LIMITS existe,
  // mas nada consulta antes de vincular paciente).
  "Até 60 pacientes ativos",
  "Pacientes ilimitados",
]);

/** Recursos da tabela comparativa que ainda não existem. */
const FEATURE_EM_DESENVOLVIMENTO: Partial<Record<FeatureKey, true>> = {
  multi_doctor: true,
};

/**
 * O plano "Rede" é, hoje, inteiramente roadmap: todos os seus itens estão em
 * desenvolvimento. Ele fica na página como intenção declarada, mas sem
 * qualquer aparência de coisa contratável.
 */
const PLANOS_ROADMAP = new Set<string>(["rede"]);

if (import.meta.env.DEV) {
  // Guarda-corpo: se alguém renomear um rótulo em plans.ts, o item some deste
  // Set e volta a ser anunciado como pronto sem ninguém perceber. Melhor um
  // aviso barulhento em dev do que promessa falsa em produção.
  const rotulos = new Set(PLANS.flatMap((p) => p.features.map((f) => f.label)));
  const orfaos = [...EM_DESENVOLVIMENTO].filter((l) => !rotulos.has(l));
  if (orfaos.length) {
    console.warn(
      "[PlansPage] Rótulos marcados como 'em desenvolvimento' que não existem mais em config/plans.ts:",
      orfaos
    );
  }
}

function SeloDesenvolvimento() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 text-warning px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle ml-1.5">
      <Hammer className="h-2.5 w-2.5" />
      em desenvolvimento
    </span>
  );
}

export default function PlansPage() {
  const navigate = useNavigate();

  useEffect(() => {
    analytics.planPageViewed();
  }, []);

  /**
   * O botão cria conta — e o texto diz isso. Antes ele se chamava "Começar"
   * logo abaixo de "R$ 247/mês", o que lê como checkout. Não há cobrança
   * implementada em canto nenhum do app: nenhum gateway, nenhuma tela de
   * pagamento. Por isso o evento continua sendo `planSelected` e NÃO
   * `checkoutStarted` — não começou checkout nenhum.
   */
  const goCriarConta = (planKey: string) => {
    analytics.planSelected(planKey, PLANS.find((p) => p.key === planKey)?.price ?? 0);
    navigate("/pro/auth");
  };

  /** Contato comercial de verdade: e-mail humano, não um funil falso. */
  const falarComercial = (planKey: string) => {
    analytics.b2bInterestClicked(`plans_page:${planKey}`);
    const assunto = encodeURIComponent(`Encorpei Cardio — plano ${planKey}`);
    const corpo = encodeURIComponent(
      "Olá! Sou cardiologista e quero conversar sobre o Encorpei Cardio.\n\n" +
        "Nome:\nCRM:\nClínica/hospital:\nNº aproximado de pacientes:\nTelefone:\n"
    );
    window.location.href = `mailto:${EMAIL_COMERCIAL}?subject=${assunto}&body=${corpo}`;
  };

  return (
    <PageTransition>
      <PageHeader
        title="Planos para cardiologistas"
        subtitle="Quem paga é o médico. O app do seu paciente é sempre gratuito."
      />

      {/* Aviso de estágio do produto — antes dos preços, não depois.
          Quem lê o preço precisa já saber o que ele cobre hoje. */}
      <div className="mb-6 rounded-2xl border border-warning/30 bg-warning/5 p-5 text-sm text-foreground">
        <p className="font-semibold flex items-center gap-2">
          <Hammer className="h-4 w-4 text-warning" />
          O que está no ar hoje, e o que ainda não
        </p>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          Funcionam hoje: acompanhamento de pacientes, plano de monitoramento, alertas
          clínicos, mensagens com o paciente, exames, relatórios, marca da clínica e
          importação dos dados da pulseira. Os itens marcados como{" "}
          <strong className="text-warning">em desenvolvimento</strong> ainda não existem
          no produto e <strong>não estão cobertos pelo preço</strong> — não cobramos por
          promessa. O app não processa pagamento: criar conta não gera cobrança, a
          contratação é combinada por contato direto.
        </p>
      </div>

      {/* Cards de plano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const roadmap = PLANOS_ROADMAP.has(plan.key);
          return (
            <div
              key={plan.key}
              className={cn(
                "rounded-2xl bg-card border p-6 flex flex-col",
                plan.highlighted ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border",
                roadmap && "border-dashed opacity-95"
              )}
            >
              {plan.badge && !roadmap && (
                <span className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary mb-2 bg-cardio-50 rounded-full px-2.5 py-1">
                  <Crown className="h-3 w-3" />
                  {plan.badge}
                </span>
              )}
              {roadmap && (
                <span className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-warning mb-2 bg-warning/10 rounded-full px-2.5 py-1">
                  <Hammer className="h-3 w-3" />
                  Em desenvolvimento
                </span>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">{plan.description}</p>
              <div className="mb-6">
                {plan.price === -1 ? (
                  // Sem preço atrelado — é o correto para um plano que ainda é
                  // roadmap. "Sob consulta" continua honesto porque a conversa
                  // é mesmo caso a caso.
                  <span className="text-2xl font-bold text-foreground">{plan.priceLabel}</span>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-foreground">R$ {plan.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Cobre apenas os itens já disponíveis.
                    </p>
                  </>
                )}
              </div>
              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((f) => {
                  const pendente = EM_DESENVOLVIMENTO.has(f.label);
                  return (
                    <li key={f.label} className="flex items-start gap-2 text-sm">
                      {pendente ? (
                        <Hammer className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                      ) : f.included ? (
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <span className={f.included && !pendente ? "text-foreground" : "text-muted-foreground"}>
                        {f.label}
                        {pendente && <SeloDesenvolvimento />}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {plan.price === -1 ? (
                <>
                  <Button
                    variant="outline"
                    className="w-full touch-target"
                    onClick={() => falarComercial(plan.key)}
                  >
                    <Mail className="h-4 w-4" /> Escrever para o comercial
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Abre seu e-mail para {EMAIL_COMERCIAL}. Nenhuma contratação acontece aqui.
                  </p>
                </>
              ) : (
                <>
                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full touch-target"
                    onClick={() => goCriarConta(plan.key)}
                  >
                    Criar conta de cardiologista
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-2 text-center">
                    Sem cartão. O cadastro não cobra nada — combinamos a assinatura depois.
                  </p>
                </>
              )}
            </div>
          );
        })}
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
                    {PLANOS_ROADMAP.has(plan.key) && (
                      <span className="block text-[10px] font-medium text-warning normal-case">
                        em desenvolvimento
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {FEATURE_ORDER.map((key) => {
                const feature = PRO_FEATURES[key];
                const pendente = FEATURE_EM_DESENVOLVIMENTO[key];
                return (
                  <tr key={key}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {feature.label}
                        {pendente && <SeloDesenvolvimento />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{feature.description}</div>
                    </td>
                    {PLANS.map((plan) => {
                      const included = PLAN_RANK[plan.key] >= PLAN_RANK[feature.minPlan];
                      return (
                        <td key={plan.key} className="px-4 py-3 text-center">
                          {/* Recurso pendente nunca ganha check, em plano nenhum:
                              o check é a afirmação "isso funciona hoje". */}
                          {pendente && included ? (
                            <Hammer className="h-4 w-4 text-warning inline-block" />
                          ) : included ? (
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

      <div className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
        Dúvida sobre o que já está no ar, prazo de algum item ou contratação?{" "}
        <button
          type="button"
          onClick={() => falarComercial("rodape")}
          className="text-primary font-medium hover:underline"
        >
          Fale com a gente por e-mail
        </button>
        . Responde uma pessoa, não um formulário automático.
      </div>
    </PageTransition>
  );
}
