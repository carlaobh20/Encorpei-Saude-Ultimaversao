/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PESO — a tela que faltava.
 *
 * Por que peso tem tela própria num app de cardiologia: em insuficiência
 * cardíaca, ganho rápido de peso é retenção de líquido, e retenção de líquido
 * antecede a internação em dias. É o dado mais barato de coletar e um dos que
 * mais mudam conduta. Até esta tela existir, o app pedia o peso e não tinha
 * onde recebê-lo.
 *
 * REGRA CLÍNICA: a tela mostra a variação e diz para avisar o médico. Ela
 * NÃO diz "você está descompensando" e NÃO manda tomar diurético.
 */

import { useMemo, useState } from "react";
import { Scale, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader, SurfaceCard, EmptyState, PageLoader } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWeight } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PesoPage() {
  const { readings, ultimo, registrar, isLoading } = useWeight();
  const { targets } = useTargets();
  const { profile } = useProfile();
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const alturaM = profile?.height_cm ? Number(profile.height_cm) / 100 : null;

  const analise = useMemo(() => {
    const lista = (readings ?? []) as any[];
    if (lista.length === 0) return null;
    const atual = Number(lista[0].value);

    // Referência: peso seco prescrito pelo médico; na falta, a medida mais
    // próxima de 3 dias atrás. É a variação curta que importa aqui.
    const seco = targets?.dry_weight_kg ? Number(targets.dry_weight_kg) : null;
    const limite = new Date(Date.now() - 3 * 86400000).getTime();
    const antiga = lista.find((r) => new Date(r.recorded_at).getTime() <= limite);
    const base = seco ?? (antiga ? Number(antiga.value) : null);

    const imc = alturaM ? atual / (alturaM * alturaM) : null;
    const delta = base !== null ? +(atual - base).toFixed(1) : null;

    return { atual, base, baseEhSeco: seco !== null, delta, imc };
  }, [readings, targets, alturaM]);

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!v || v < 20 || v > 400) {
      toast.error("Digite um peso entre 20 e 400 kg.");
      return;
    }
    setSalvando(true);
    try {
      await (registrar as any).mutateAsync({ value: v });
      setValor("");
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <PageLoader />;

  const subiuMuito = analise?.delta !== null && analise?.delta !== undefined && analise.delta >= 2;

  return (
    <div className="space-y-4">
      <PageHeader title="Peso" subtitle="Meça de manhã, depois do banheiro, antes de comer." />

      <SurfaceCard>
        <label className="block">
          <span className="text-sm font-medium">Peso de hoje</span>
          <div className="mt-2 flex items-center gap-2">
            <Input
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="78,5"
              className="h-14 text-2xl font-semibold tabular-nums text-center"
            />
            <span className="text-base text-muted-foreground w-10">kg</span>
          </div>
        </label>
        <Button onClick={salvar} disabled={salvando} className="w-full h-12 mt-3 text-base">
          {salvando ? "Salvando…" : "Registrar peso"}
        </Button>
      </SurfaceCard>

      {analise ? (
        <SurfaceCard>
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-3xl font-semibold tabular-nums">{analise.atual.toFixed(1)} kg</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ultimo ? `Última medida em ${dataCurta((ultimo as any).recorded_at)}` : ""}
              </p>
            </div>
            {analise.imc ? (
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">IMC {analise.imc.toFixed(1)}</p>
                <p className="text-[11px] text-muted-foreground">altura {profile?.height_cm} cm</p>
              </div>
            ) : null}
          </div>

          {analise.delta !== null ? (
            <div className={cn("mt-4 rounded-xl px-3 py-3", subiuMuito ? "bg-error/10" : "bg-muted/50")}>
              <p className="flex items-center gap-2 text-sm font-medium">
                {analise.delta > 0 ? <TrendingUp className="h-4 w-4" />
                  : analise.delta < 0 ? <TrendingDown className="h-4 w-4" />
                  : <Minus className="h-4 w-4" />}
                {analise.delta === 0
                  ? "Mesmo peso da referência."
                  : `${analise.delta > 0 ? "+" : ""}${analise.delta.toFixed(1)} kg em relação ${
                      analise.baseEhSeco ? "ao seu peso de referência" : "aos últimos dias"
                    }.`}
              </p>
              {subiuMuito ? (
                <p className="text-sm mt-1.5">
                  Esse ganho rápido costuma ser líquido retido. Avise seu médico hoje.
                  Se estiver com falta de ar, pernas inchadas ou não conseguir deitar,
                  procure atendimento.
                </p>
              ) : null}
            </div>
          ) : null}
        </SurfaceCard>
      ) : (
        <EmptyState
          icon={Scale}
          title="Nenhum peso registrado ainda"
          description="Registre hoje e o app passa a mostrar a variação entre os dias — que é o que seu médico acompanha."
        />
      )}

      {(readings ?? []).length > 1 ? (
        <SurfaceCard>
          <p className="text-sm font-medium mb-2">Últimos registros</p>
          <ul className="divide-y divide-border">
            {(readings as any[]).slice(0, 14).map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">{dataCurta(r.recorded_at)}</span>
                <span className="text-sm font-semibold tabular-nums">{Number(r.value).toFixed(1)} kg</span>
              </li>
            ))}
          </ul>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
