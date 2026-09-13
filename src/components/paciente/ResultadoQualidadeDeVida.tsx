/**
 * A DEVOLUTIVA do questionário de qualidade de vida.
 *
 * O paciente respondia sete perguntas por mês, o app agradecia, e o resultado
 * ia direto para a tela do médico. `qol_responses` era escrita pelo paciente e
 * lida só pelo outro lado; do lado dele, `useQualidadeDeVida` servia apenas
 * para decidir se perguntava de novo. Pedir esforço todo mês e nunca devolver
 * nada é o jeito mais rápido de o paciente parar de responder.
 *
 * O que este cartão mostra, e o que ele deliberadamente NÃO mostra:
 *   · mostra o NÚMERO, a ESCALA em que ele vive e a VARIAÇÃO entre respostas;
 *   · não diz se o número é bom, ruim, preocupante ou tranquilizador — isso é
 *     leitura clínica, e leitura clínica é do médico. Nem cor de semáforo:
 *     verde aqui seria exatamente a frase "está tudo bem" dita sem médico.
 *   · fecha mandando conversar com o médico, que é o próximo passo real.
 */
import { ClipboardCheck, ArrowUp, ArrowDown } from "lucide-react";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TituloSecao, Lista, ItemLista, BarraProporcao } from "@/components/shell";
import type { useQualidadeDeVida } from "@/hooks/useEngajamento";

function dataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export function ResultadoQualidadeDeVida({ qol }: { qol: ReturnType<typeof useQualidadeDeVida> }) {
  const { ultima, anterior, variacao, respostas } = qol;

  // Enquanto carrega, nada — escrever "você ainda não respondeu" para quem
  // respondeu ontem seria a tela apagando o esforço dele por meio segundo.
  if (qol.isLoading) return null;

  if (!ultima) {
    return (
      <section>
        <TituloSecao titulo="Seu questionário de qualidade de vida" icone={ClipboardCheck} />
        <SurfaceCard>
          <p className="text-base text-foreground leading-relaxed">
            Você ainda não respondeu o questionário. Quando responder, o resultado aparece aqui — e você pode trazer este resumo para a consulta.
          </p>
        </SurfaceCard>
      </section>
    );
  }

  return (
    <section>
      <TituloSecao
        titulo="Seu questionário de qualidade de vida"
        icone={ClipboardCheck}
        subtitulo={`última resposta em ${dataLonga(ultima.respondido_em)}`}
      />
      <SurfaceCard>
        <p className="text-4xl font-bold text-foreground tabular-nums">{ultima.score}</p>
        <p className="text-base text-muted-foreground leading-relaxed mt-1">
          de 0 a 100. O número sobe quando você relata menos limitação nas atividades do dia a dia, e desce quando relata mais.
        </p>

        <div className="mt-4">
          <BarraProporcao
            rotulo="Onde seu número está na escala"
            valor={`${ultima.score} de 100`}
            percentual={ultima.score}
            /* Azul da marca, sempre. Uma barra que virasse verde acima de um
               corte estaria dando um parecer que este app não dá. */
            cor="hsl(var(--brand-cardio))"
          />
        </div>

        {variacao != null && anterior ? (
          <p className="text-base text-foreground leading-relaxed mt-4 flex items-start gap-1.5">
            {variacao !== 0 && (
              variacao > 0
                ? <ArrowUp className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
                : <ArrowDown className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            )}
            <span>
              {variacao === 0
                ? `Mesmo número da resposta anterior (${anterior.score}, em ${dataLonga(anterior.respondido_em)}).`
                : `${variacao > 0 ? "Subiu" : "Desceu"} ${Math.abs(variacao)} ${Math.abs(variacao) === 1 ? "ponto" : "pontos"} desde a resposta anterior (${anterior.score}, em ${dataLonga(anterior.respondido_em)}).`}
            </span>
          </p>
        ) : (
          <p className="text-base text-muted-foreground leading-relaxed mt-4">
            Esta foi sua primeira resposta. A partir da próxima, você vê aqui o quanto o número mudou.
          </p>
        )}

        {respostas.length > 1 ? (
          <div className="mt-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-1">Suas respostas</p>
            <Lista>
              {respostas.slice(0, 6).map((r) => (
                <ItemLista key={r.id}>
                  <span className="text-base text-foreground">{dataLonga(r.respondido_em)}</span>
                  <span className="text-base font-semibold text-foreground tabular-nums shrink-0">{r.score}</span>
                </ItemLista>
              ))}
            </Lista>
          </div>
        ) : null}

        <p className="text-base text-muted-foreground leading-relaxed mt-5">
          O que esse número significa para o seu tratamento é conversa de consulta. Leve este resumo e pergunte ao seu médico.
        </p>
      </SurfaceCard>
    </section>
  );
}
