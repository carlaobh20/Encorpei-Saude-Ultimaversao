/**
 * FeedbackPage — envio de feedback do paciente sobre o app.
 */
import { MessageSquareHeart } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { useProfile } from "@/hooks/useProfile";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { MyFeedbackList } from "@/components/feedback/MyFeedbackList";

const TELAS = [
  "Hoje", "Pressão e coração", "Atividade", "Sono", "Remédios", "Exames",
  "Agenda", "Minhas metas", "Sintomas", "Emergência", "Pulseira", "Meu médico", "Outra",
];

export default function FeedbackPage() {
  const { profile } = useProfile();

  return (
    <div className="pb-10">
      <PageHeader
        title="Feedback"
        subtitle="Conte pra gente o que podemos melhorar"
        action={<MessageSquareHeart className="h-6 w-6 text-primary" />}
      />
      <div className="space-y-6">
        <FeedbackForm role="patient" authorName={profile?.full_name ?? null} screens={TELAS} />
        <MyFeedbackList authorName={profile?.full_name ?? null} />
      </div>
    </div>
  );
}
