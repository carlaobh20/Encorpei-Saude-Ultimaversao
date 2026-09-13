/**
 * A instrução que o médico escreveu PARA AQUELA métrica, na tela em que a
 * métrica aparece.
 *
 * `monitoring_plan.instructions` é preenchido item a item no editor do médico
 * e, até aqui, era lido num lugar só — o item prioritário da tela inicial.
 * Quem tinha instrução em três métricas via a de uma. O médico escrevia, o
 * paciente não recebia, e ninguém dos dois lados tinha como perceber.
 *
 * Componente de TELA, não de item de lista: ele consome
 * `useInstrucoesDoPlano()`, que é uma consulta por paciente, compartilhada no
 * cache. Renderizá-lo dentro de um `.map()` continuaria sendo uma consulta só
 * — mas repetiria o mesmo cartão N vezes, que é outro defeito. Um por tela.
 *
 * Não interpreta nem acrescenta conduta: mostra o texto do médico como ele
 * escreveu, atribuído a ele.
 */
import { Stethoscope } from "lucide-react";
import {
  useInstrucoesDoPlano, ROTULO_FREQUENCIA, ROTULO_HORARIO,
  type MetricaPlano,
} from "@/hooks/usePlanoMonitoramento";

export function InstrucaoDoMedico({
  metric,
  patientUserId,
}: {
  metric: MetricaPlano;
  patientUserId?: string;
}) {
  const { porMetrica, prescrito } = useInstrucoesDoPlano(patientUserId);
  const item = porMetrica.get(metric);

  // Sem prescrição real, o que existe é o plano mínimo sugerido pelo app — e
  // ele não tem instrução de médico nenhum. Silêncio é a resposta honesta.
  if (!prescrito || !item) return null;
  if (!item.instructions && !item.preferred_time) return null;

  const quando = [
    ROTULO_FREQUENCIA[item.frequency],
    item.preferred_time && item.preferred_time !== "any" ? ROTULO_HORARIO[item.preferred_time] : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="rounded-2xl border border-primary/20 bg-cardio-50 p-4">
      <div className="flex items-start gap-3">
        <Stethoscope className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">O que seu médico pediu</p>
          {item.instructions ? (
            <p className="text-base text-foreground leading-relaxed mt-1 break-words">{item.instructions}</p>
          ) : null}
          {quando ? (
            <p className="text-sm text-muted-foreground mt-1">Combinado: {quando}.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
