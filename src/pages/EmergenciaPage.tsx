/**
 * EmergenciaPage — sem jargão, sem passo clínico prescritivo além de
 * "procure atendimento". Regra 3 do contrato: é para onde a dor torácica
 * em repouso e o desmaio levam direto, sem passar pela fila do médico.
 */
import { PhoneCall, AlertTriangle, Armchair, Car, Users, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
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
      <div>
        <PageHeader title="Emergência" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Emergência" />

      <SurfaceCard className="bg-error-bg border-0 mb-6 text-center py-8">
        <AlertTriangle className="h-8 w-8 text-error mx-auto mb-2" />
        <p className="text-sm font-semibold text-error mb-4">Se você não está bem, ligue agora.</p>
        <a
          href={`tel:${EMERGENCIA_TELEFONE}`}
          className="inline-flex items-center justify-center gap-3 w-full h-20 rounded-3xl bg-error text-white text-3xl font-bold shadow-lg active:scale-[0.98] transition-transform"
        >
          <PhoneCall className="h-8 w-8" />
          Ligar {EMERGENCIA_TELEFONE}
        </a>
        <p className="text-xs text-error/80 mt-3">SAMU — atendimento de urgência</p>
      </SurfaceCard>

      <div className="mb-6">
        <SectionHeader title="Quando ligar" />
        <SurfaceCard>
          <ul className="space-y-2.5">
            {QUANDO_LIGAR.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-error mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </SurfaceCard>
      </div>

      <div className="mb-6">
        <SectionHeader title="Enquanto espera" />
        <div className="space-y-2.5">
          {ENQUANTO_ESPERA.map((e) => (
            <SurfaceCard key={e.texto} className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <e.icon className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-foreground">{e.texto}</p>
            </SurfaceCard>
          ))}
        </div>
      </div>

      {(medico || patient) && (
        <div>
          <SectionHeader title="Seu médico" icon={Stethoscope} />
          <SurfaceCard>
            <p className="text-sm font-semibold text-foreground">{medico?.display_name || "Não vinculado ainda"}</p>
            {medico?.clinic_name && <p className="text-xs text-muted-foreground mt-0.5">{medico.clinic_name}</p>}
            {medico?.phone && (
              <a href={`tel:${medico.phone}`} className="text-xs text-primary font-semibold mt-1 inline-block">
                Ligar para o consultório
              </a>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Depois de procurar atendimento, avise seu médico assim que puder.
            </p>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
}
