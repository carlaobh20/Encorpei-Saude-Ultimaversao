/**
 * EmergenciaPage — sem jargão, sem passo clínico prescritivo além de
 * "procure atendimento". Regra 3 do contrato: é para onde a dor torácica
 * em repouso e o desmaio levam direto, sem passar pela fila do médico.
 *
 * ── O que a passada visual mudou, e o que NÃO podia mudar ─────────────
 * O vermelho, o botão de ligar, o telefone, a lista do "quando ligar" e a do
 * "enquanto espera" estão idênticos — cor, tamanho, ordem e palavra por
 * palavra. Esta é a última tela do app em que vale a pena "melhorar" alguma
 * coisa que custe um instante de leitura.
 *
 * O acabamento foi só isto: os textos de apoio saíram de 13px para o corpo
 * legível de 17px (a lista "quando ligar" era o menor texto de uma tela de
 * emergência — o oposto do que deveria ser), os títulos de seção viraram
 * títulos de verdade, o link do consultório ganhou alvo de toque de 44px, e
 * a página passou a usar a mesma coluna das demais.
 */
import { PhoneCall, AlertTriangle, Armchair, Car, Users, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { TelaPaciente, TituloSecao } from "@/components/shell";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { EMERGENCIA_TELEFONE } from "@/lib/config";

const QUANDO_LIGAR = [
  "Dor no peito que não passa",
  "Falta de ar que começou de repente",
  "Desmaio",
  "Fala enrolada ou fraqueza de um lado do corpo",
];

const ENQUANTO_ESPERA = [
  { icon: Armchair, texto: "Sente-se ou deite-se em um lugar confortável." },
  { icon: Car, texto: "Não dirija até o hospital — peça para alguém te levar, ou aguarde a ambulância." },
  { icon: Users, texto: "Avise alguém perto de você para ficar junto enquanto espera." },
];

export default function EmergenciaPage() {
  const { professionals, isLoading } = useMyProfessionals();
  const medico = professionals[0] ?? null;
  const { data: patient } = useCardioPatient();

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Emergência" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Emergência" />

      {/* Intocado: cor, tamanho, ordem e texto são os mesmos. */}
      <SurfaceCard className="bg-error-bg border-0 text-center py-8">
        <AlertTriangle className="h-8 w-8 text-error mx-auto mb-2" aria-hidden />
        <p className="text-base font-semibold text-error mb-4">Se você não está bem, ligue agora.</p>
        <a
          href={`tel:${EMERGENCIA_TELEFONE}`}
          className="inline-flex items-center justify-center gap-3 w-full h-20 rounded-3xl bg-error text-white text-3xl font-bold shadow-lg active:scale-[0.98] transition-transform"
        >
          <PhoneCall className="h-8 w-8" aria-hidden />
          Ligar {EMERGENCIA_TELEFONE}
        </a>
        <p className="text-sm text-error/80 mt-3">SAMU — atendimento de urgência</p>
      </SurfaceCard>

      <section>
        <TituloSecao titulo="Quando ligar" />
        <SurfaceCard>
          <ul className="space-y-3">
            {QUANDO_LIGAR.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-base text-foreground leading-relaxed">
                <span className="h-2 w-2 rounded-full bg-error mt-2.5 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </section>

      <section>
        <TituloSecao titulo="Enquanto espera" />
        <div className="space-y-2.5">
          {ENQUANTO_ESPERA.map((e) => (
            <SurfaceCard key={e.texto} className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <e.icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <p className="text-base text-foreground leading-relaxed">{e.texto}</p>
            </SurfaceCard>
          ))}
        </div>
      </section>

      {(medico || patient) && (
        <section>
          <TituloSecao titulo="Seu médico" icone={Stethoscope} />
          <SurfaceCard>
            <p className="text-base font-semibold text-foreground break-words">{medico?.display_name || "Não vinculado ainda"}</p>
            {medico?.clinic_name && <p className="text-sm text-muted-foreground mt-0.5">{medico.clinic_name}</p>}
            {medico?.phone && (
              <a
                href={`tel:${medico.phone}`}
                className="mt-2 inline-flex min-h-[44px] items-center text-base text-primary font-semibold rounded-lg"
              >
                Ligar para o consultório
              </a>
            )}
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Depois de procurar atendimento, avise seu médico assim que puder.
            </p>
          </SurfaceCard>
        </section>
      )}
    </TelaPaciente>
  );
}
