/**
 * AprenderPage — micro-lições puxadas pelo caso do próprio paciente.
 * docs/ENGAJAMENTO-CARDIO.md §3.4.
 *
 * Não é uma biblioteca de artigos. Lições curtas, agrupadas por categoria,
 * não lidas primeiro, e recolhidas por baixo depois de lidas.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ThumbsUp, Check, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
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
    <SurfaceCard className={lida ? "bg-card/70" : undefined}>
      <p className="text-xs font-medium text-primary mb-1.5">{licao.origem}</p>
      <h3 className="text-base font-semibold text-foreground mb-2">{licao.titulo}</h3>
      <p className="text-[16px] leading-[1.7] text-foreground/90">{licao.corpo}</p>
      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
        <Button
          variant={lida ? "secondary" : "outline"}
          size="sm"
          className="rounded-xl"
          onClick={onEntendi}
          disabled={lida}
        >
          <Check className="h-3.5 w-3.5" /> {lida ? "Entendido" : "Entendi"}
        </Button>
        <Button
          variant={util ? "secondary" : "ghost"}
          size="sm"
          className="rounded-xl"
          onClick={onUtil}
          disabled={util}
        >
          <ThumbsUp className="h-3.5 w-3.5" /> {util ? "Marcado como útil" : "Isso me ajudou"}
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
      <div>
        <PageHeader title="Aprender" />
        <TabPageSkeleton />
      </div>
    );
  }

  if (licoes.length === 0) {
    return (
      <div>
        <PageHeader title="Aprender" subtitle="O que puxamos do seu caso" />
        <EmptyState
          icon={BookOpen}
          title="Ainda sem lições"
          description="Conforme seus exames e receitas forem registrados, aparecem aqui explicações sobre o seu próprio caso."
          variant="card"
        />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Aprender" subtitle="Explicações a partir do seu próprio caso" />

      {naoLidas.length === 0 && (
        <SurfaceCard className="mb-5 bg-success-bg border-0">
          <p className="text-sm font-medium text-foreground">Você já leu todas as lições disponíveis por enquanto.</p>
        </SurfaceCard>
      )}

      {ORDEM_CATEGORIA.map((cat) => {
        const doGrupo = gruposNaoLidas.get(cat) ?? [];
        if (doGrupo.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <SectionHeader title={CATEGORIA_LABEL[cat]} />
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
          </div>
        );
      })}

      {lidasLista.length > 0 && (
        <div>
          <button
            onClick={() => setMostrarLidas((v) => !v)}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 mb-3"
          >
            <span className="text-sm font-semibold text-foreground">Já lidas ({lidasLista.length})</span>
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", mostrarLidas && "rotate-180")} />
          </button>
          {mostrarLidas && (
            <div>
              {ORDEM_CATEGORIA.map((cat) => {
                const doGrupo = gruposLidas.get(cat) ?? [];
                if (doGrupo.length === 0) return null;
                return (
                  <div key={cat} className="mb-6">
                    <SectionHeader title={CATEGORIA_LABEL[cat]} />
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
    </div>
  );
}
