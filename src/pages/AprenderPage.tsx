/**
 * AprenderPage — micro-lições puxadas pelo caso do próprio paciente.
 * docs/ENGAJAMENTO-CARDIO.md §3.4.
 *
 * Não é uma biblioteca de artigos. Lições curtas, agrupadas por categoria,
 * não lidas primeiro, e recolhidas por baixo depois de lidas.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhum texto de lição, nenhuma regra de quais lições aparecem. Mudou:
 *
 *  · O corpo da lição já era 16px — aqui ele foi o único lugar do app que
 *    tinha acertado a escala antes da reforma. O que estava errado era o
 *    resto em volta: título de seção de 13px, botões de "Entendi" em `sm`
 *    (36px de altura, abaixo do alvo de toque) e cartão de lição lida com
 *    opacidade — cinza claro sobre branco não é estado, é sujeira de tela.
 *    Lição lida agora se marca pelo BOTÃO desabilitado que diz "Entendido".
 *
 *  · O bloco "você já leu todas" saiu do verde. Verde num app de saúde é
 *    lido como resultado clínico bom; ter lido as lições não é resultado
 *    clínico de coisa nenhuma.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ThumbsUp, Check, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { TelaPaciente, TituloSecao } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAprender } from "@/hooks/useEngajamento";
import type { Licao } from "@/lib/clinical/educacao";

const CATEGORIA_LABEL: Record<Licao["categoria"], string> = {
  exame: "Sobre seus exames",
  remedio: "Sobre seus remédios",
  condicao: "Sobre o seu caso",
  habito: "Hábitos",
};

const ORDEM_CATEGORIA: Licao["categoria"][] = ["exame", "remedio", "condicao", "habito"];

function agrupar(licoes: Licao[]): Map<Licao["categoria"], Licao[]> {
  const grupos = new Map<Licao["categoria"], Licao[]>();
  for (const cat of ORDEM_CATEGORIA) grupos.set(cat, []);
  for (const l of licoes) grupos.get(l.categoria)?.push(l);
  return grupos;
}

function LicaoCard({
  licao, lida, util, onEntendi, onUtil,
}: {
  licao: Licao;
  lida: boolean;
  util: boolean;
  onEntendi: () => void;
  onUtil: () => void;
}) {
  return (
    <SurfaceCard>
      <p className="text-sm font-medium uppercase tracking-wide text-primary mb-1.5">{licao.origem}</p>
      <h3 className="font-display text-xl font-semibold leading-snug text-foreground mb-2">{licao.titulo}</h3>
      <p className="text-[17px] leading-[1.7] text-foreground/90">{licao.corpo}</p>
      {/* Dois botões secundários, nenhum azul cheio: ler uma lição não é a
          ação que a tela está pedindo — é o que o paciente já está fazendo.
          `flex-wrap` porque em 360px os dois rótulos não cabem lado a lado. */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
        <Button variant="outline" className="rounded-xl" onClick={onEntendi} disabled={lida}>
          <Check className="h-4 w-4" aria-hidden /> {lida ? "Entendido" : "Entendi"}
        </Button>
        <Button variant="ghost" className="rounded-xl" onClick={onUtil} disabled={util}>
          <ThumbsUp className="h-4 w-4" aria-hidden /> {util ? "Marcado como útil" : "Isso me ajudou"}
        </Button>
      </div>
    </SurfaceCard>
  );
}

export default function AprenderPage() {
  const { licoes, naoLidas, jaLidas, isLoading, marcarLida } = useAprender();
  const [uteis, setUteis] = useState<Set<string>>(new Set());
  const [mostrarLidas, setMostrarLidas] = useState(false);

  const lidasLista = useMemo(() => licoes.filter((l) => jaLidas.has(l.id)), [licoes, jaLidas]);

  const gruposNaoLidas = useMemo(() => agrupar(naoLidas), [naoLidas]);
  const gruposLidas = useMemo(() => agrupar(lidasLista), [lidasLista]);

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Aprender" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  if (licoes.length === 0) {
    return (
      <TelaPaciente>
        <PageHeader title="Aprender" subtitle="O que puxamos do seu caso" />
        <EmptyState
          icon={BookOpen}
          title="Ainda sem lições"
          description="Conforme seus exames e receitas forem registrados, aparecem aqui explicações sobre o seu próprio caso."
          variant="card"
        />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Aprender" subtitle="Explicações a partir do seu próprio caso" />

      {naoLidas.length === 0 && (
        <SurfaceCard className="bg-cardio-50 border-0">
          <p className="text-base font-medium text-foreground">Você já leu todas as lições disponíveis por enquanto.</p>
        </SurfaceCard>
      )}

      {ORDEM_CATEGORIA.map((cat) => {
        const doGrupo = gruposNaoLidas.get(cat) ?? [];
        if (doGrupo.length === 0) return null;
        return (
          <section key={cat}>
            <TituloSecao titulo={CATEGORIA_LABEL[cat]} />
            <div className="space-y-3">
              {doGrupo.map((l) => (
                <LicaoCard
                  key={l.id}
                  licao={l}
                  lida={false}
                  util={uteis.has(l.id)}
                  onEntendi={() => marcarLida.mutate({ licaoId: l.id })}
                  onUtil={() => {
                    setUteis((s) => new Set(s).add(l.id));
                    marcarLida.mutate({ licaoId: l.id, util: true });
                  }}
                />
              ))}
            </div>
          </section>
        );
      })}

      {lidasLista.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarLidas((v) => !v)}
            aria-expanded={mostrarLidas}
            className="w-full min-h-[48px] flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 mb-3 shadow-sm"
          >
            <span className="text-base font-semibold text-foreground">Já lidas ({lidasLista.length})</span>
            <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform motion-reduce:transition-none", mostrarLidas && "rotate-180")} aria-hidden />
          </button>
          {mostrarLidas && (
            <div>
              {ORDEM_CATEGORIA.map((cat) => {
                const doGrupo = gruposLidas.get(cat) ?? [];
                if (doGrupo.length === 0) return null;
                return (
                  <div key={cat} className="mb-6">
                    <TituloSecao titulo={CATEGORIA_LABEL[cat]} />
                    <div className="space-y-3">
                      {doGrupo.map((l) => (
                        <LicaoCard
                          key={l.id}
                          licao={l}
                          lida
                          util={uteis.has(l.id)}
                          onEntendi={() => undefined}
                          onUtil={() => {
                            setUteis((s) => new Set(s).add(l.id));
                            marcarLida.mutate({ licaoId: l.id, util: true });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </TelaPaciente>
  );
}
