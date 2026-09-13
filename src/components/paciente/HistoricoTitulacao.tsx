/**
 * "O que seu médico mudou nos seus remédios" — em linguagem de paciente.
 *
 * `medication_titrations` era gravada e nunca lida. O médico tinha a
 * impressão (reforçada por um toast) de que o paciente "foi avisado"; o
 * paciente abria Remédios e via só a dose nova, sem saber que mudou, quando
 * mudou nem por quê. Esta lista é o aviso que a frase prometia.
 *
 * Regras que este componente respeita:
 *   · não prescreve e não interpreta — repete o motivo que o MÉDICO escreveu,
 *     entre aspas, atribuído a ele;
 *   · quando não há motivo escrito, não inventa um;
 *   · o dado já vem resolvido do hook (nome do remédio cruzado em memória):
 *     nenhuma consulta acontece dentro deste `.map()`.
 */
import { History } from "lucide-react";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TituloSecao } from "@/components/shell";
import type { Titulacao } from "@/hooks/useCardioMedications";

function dataCurta(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "de 50 para 100 mg" quando dá; "para 100 mg" quando a dose anterior não foi guardada. */
function frase(t: Titulacao): string {
  const quem = t.medico ? `${t.medico}` : "Seu médico";
  const remedio = t.medicamento ?? "um dos seus remédios";
  const mudanca = t.previous_dose
    ? `de ${t.previous_dose} para ${t.new_dose}`
    : `para ${t.new_dose}`;
  return `${quem} mudou a dose ${remedio === "um dos seus remédios" ? "de " : "da "}${remedio} ${mudanca} em ${dataCurta(t.created_at)}`;
}

export function HistoricoTitulacao({
  titulacoes,
  titulo = "Mudanças nos seus remédios",
  subtitulo = "o que seu médico alterou, e por quê",
}: {
  titulacoes: Titulacao[];
  /** Em "Meu mês" a lista é recortada pelo mês e o título diz isso. */
  titulo?: string;
  subtitulo?: string;
}) {
  if (titulacoes.length === 0) return null;

  return (
    <section>
      <TituloSecao titulo={titulo} icone={History} subtitulo={subtitulo} />
      <div className="space-y-2.5">
        {titulacoes.map((t) => (
          <SurfaceCard key={t.id}>
            <p className="text-base text-foreground leading-relaxed break-words">{frase(t)}.</p>
            {t.reason ? (
              <p className="text-base text-muted-foreground leading-relaxed mt-1.5 break-words">
                Motivo que ele registrou: “{t.reason}”.
              </p>
            ) : null}
          </SurfaceCard>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
        Se alguma dessas mudanças não bate com o que você está tomando em casa, fale com seu médico antes de mudar qualquer coisa.
      </p>
    </section>
  );
}
