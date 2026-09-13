/**
 * O plano de monitoramento inteiro, com a instrução de CADA item.
 *
 * A tela inicial mostra a instrução de um item — o prioritário do dia. Quem
 * tem quatro itens prescritos, cada um com sua instrução, lia uma. Aqui, no
 * resumo que o paciente leva à consulta, o plano aparece inteiro: métrica,
 * frequência, horário combinado e o texto que o médico escreveu.
 *
 * Uma consulta só (`useInstrucoesDoPlano`), feita no topo — a lista abaixo só
 * itera sobre o que já está em memória.
 */
import { ClipboardList } from "lucide-react";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TituloSecao } from "@/components/shell";
import {
  useInstrucoesDoPlano, ROTULO_METRICA, ROTULO_FREQUENCIA, ROTULO_HORARIO,
} from "@/hooks/usePlanoMonitoramento";

export function PlanoDoMedicoCard({ patientUserId }: { patientUserId?: string }) {
  const { itens, prescrito } = useInstrucoesDoPlano(patientUserId);

  // Sem prescrição, o que existe é a sugestão do próprio app. Chamar isso de
  // "o que seu médico pediu" no papel que vai para a consulta seria pôr na
  // boca do médico uma frase que ele não disse.
  if (!prescrito || itens.length === 0) return null;

  return (
    <section>
      <TituloSecao
        titulo="O que seu médico pediu para acompanhar"
        icone={ClipboardList}
        subtitulo="combinado do plano de monitoramento"
      />
      <SurfaceCard>
        <ul className="divide-y divide-border">
          {itens.map((i) => (
            <li key={i.id} className="py-3 first:pt-0 last:pb-0">
              <p className="text-base font-semibold text-foreground">
                {ROTULO_METRICA[i.metric]}
                <span className="font-normal text-muted-foreground">
                  {" "}— {ROTULO_FREQUENCIA[i.frequency]}
                  {i.preferred_time && i.preferred_time !== "any" ? `, ${ROTULO_HORARIO[i.preferred_time]}` : ""}
                </span>
              </p>
              {i.instructions ? (
                <p className="text-base text-foreground leading-relaxed mt-1 break-words">{i.instructions}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </SurfaceCard>
    </section>
  );
}
