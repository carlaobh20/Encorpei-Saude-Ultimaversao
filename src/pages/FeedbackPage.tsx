/**
 * FeedbackPage — envio de feedback do paciente sobre o app.
 *
 * A tela é só a moldura: o formulário e a lista vivem em
 * `components/feedback/*`, compartilhados com o médico e o admin — mexer no
 * desenho deles daqui mudaria as outras duas áreas junto. O que esta passada
 * fez foi dar à página a mesma coluna e o mesmo respiro das demais telas do
 * paciente, e trocar o ícone solto do cabeçalho, que parecia um botão sem
 * ação atrás, por nada: o título já diz o que a tela é.
 */
import { PageHeader } from "@/components/shell/PageHeader";
import { TelaPaciente } from "@/components/shell";
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
    <TelaPaciente>
      <PageHeader
        title="Feedback"
        subtitle="Conte pra gente o que podemos melhorar"
      />
      <FeedbackForm role="patient" authorName={profile?.full_name ?? null} screens={TELAS} />
      <MyFeedbackList authorName={profile?.full_name ?? null} />
    </TelaPaciente>
  );
}
