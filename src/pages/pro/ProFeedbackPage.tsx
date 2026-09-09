/**
 * FEEDBACK — canal de feedback do médico.
 */
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { useProfessionalProfile } from "@/hooks/useProfessional";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { MyFeedbackList } from "@/components/feedback/MyFeedbackList";

const SCREENS = [
  "Painel", "Pacientes", "Detalhe do paciente", "Alertas", "Agenda",
  "Mensagens", "Exames", "Relatórios", "Minha conta", "Outra",
];

export default function ProFeedbackPage() {
  const { profile } = useProfessionalProfile();

  return (
    <div className="mx-auto w-full max-w-[820px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Feedback"
        subtitle="Sua opinião ajuda a tornar o Encorpei Cardio melhor para você e seus pacientes."
        action={
          <div className="hidden sm:grid place-items-center h-14 w-14 rounded-2xl bg-primary/10 text-primary shrink-0">
            <MessagesSquare className="h-6 w-6" strokeWidth={1.75} />
          </div>
        }
      />

      <FeedbackForm role="professional" authorName={profile?.display_name ?? null} screens={SCREENS} />

      <div className="mt-8">
        <MyFeedbackList authorName={profile?.display_name ?? null} />
      </div>
    </div>
  );
}
