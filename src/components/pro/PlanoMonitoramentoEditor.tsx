/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PLANO DE MONITORAMENTO — a prescrição de acompanhamento.
 *
 * É aqui que "registre o que o médico pede" deixa de ser retórica: o que o
 * médico marca nesta tela é exatamente o que aparece na tela inicial do
 * paciente e no botão Registrar, e é o que gera a aderência que volta para
 * a carteira dele.
 *
 * Deliberadamente pequeno: métrica, frequência, instrução. Um plano de
 * monitoramento que precisa de dez campos não é preenchido em consulta.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { cn } from "@/lib/utils";
import {
  ROTULO_METRICA, ROTULO_FREQUENCIA, ROTULO_HORARIO,
  type MetricaPlano, type Frequencia, type ItemPlano,
} from "@/hooks/usePlanoMonitoramento";
import { queryKeys } from "@/lib/queryKeys";

const METRICAS: MetricaPlano[] = [
  "bp", "weight", "medication", "wellbeing", "hr", "spo2",
  "glucose", "sleep", "steps", "walk", "sodium", "symptoms",
];

const FREQUENCIAS: Frequencia[] = ["twice_daily", "daily", "weekly", "biweekly", "monthly", "as_needed"];

type Horario = NonNullable<ItemPlano["preferred_time"]>;

/**
 * `preferred_time`: FICA, e passa a ser escrito.
 *
 * As duas colunas do plano nunca gravadas eram `preferred_time` e
 * `days_of_week`. A decisão foi diferente para cada uma, e o critério é o
 * mesmo: serve para o paciente saber o que fazer?
 *
 *  · `preferred_time` SERVE. "Peso de manhã, em jejum" e "peso à noite" são
 *    medidas diferentes; pressão à noite não substitui a da manhã. É uma
 *    palavra que muda o comportamento e cabe na frase que o paciente lê.
 *    Passa a ser gravada e a aparecer no app dele (InstrucaoDoMedico e
 *    PlanoDoMedicoCard).
 *
 *  · `days_of_week` SAI do modelo mental — não é oferecida aqui e é gravada
 *    como NULL explícito. Ela cria um segundo calendário que brigaria com a
 *    frequência: "semanal" já é verificada por JANELA MÓVEL de 7 dias, e
 *    "toda terça" exigiria que a pendência soubesse virar dívida na quarta e
 *    sumir na quinta. Duas noções de prazo, uma delas invisível ao paciente,
 *    para um ganho clínico que ninguém pediu. A coluna fica no banco, sem uso
 *    — e sem um campo na tela fingindo que ela faz algo.
 */
const HORARIOS: Horario[] = ["any", "morning", "afternoon", "evening"];

interface Linha {
  metric: MetricaPlano;
  ativo: boolean;
  frequency: Frequencia;
  preferred_time: Horario;
  instructions: string;
}

export function PlanoMonitoramentoEditor({
  patientUserId,
  professionalId,
}: {
  patientUserId: string;
  professionalId?: string | null;
}) {
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const [rascunho, setRascunho] = useState<Record<string, Linha> | null>(null);

  const { data: plano = [] } = useQuery({
    queryKey: queryKeys.monitoringPlan.todos(patientUserId),
    queryFn: async () => {
      if (demo) return [];
      const { data, error } = await (supabase as any)
        .from("monitoring_plan").select("*").eq("patient_user_id", patientUserId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!patientUserId,
  });

  const base = useMemo(() => {
    const mapa: Record<string, Linha> = {};
    for (const m of METRICAS) {
      const existente = (plano as any[]).find((p) => p.metric === m);
      mapa[m] = {
        metric: m,
        ativo: existente ? existente.is_active : false,
        frequency: (existente?.frequency ?? "daily") as Frequencia,
        preferred_time: (existente?.preferred_time ?? "any") as Horario,
        instructions: existente?.instructions ?? "",
      };
    }
    return mapa;
  }, [plano]);

  const linhas = rascunho ?? base;
  const sujo = rascunho !== null;

  function mudar(m: MetricaPlano, patch: Partial<Linha>) {
    setRascunho({ ...linhas, [m]: { ...linhas[m], ...patch } });
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (demo) return;
      const registros = METRICAS.map((m) => ({
        patient_user_id: patientUserId,
        professional_id: professionalId ?? null,
        metric: m,
        frequency: linhas[m].frequency,
        times_per_day: linhas[m].frequency === "twice_daily" ? 2 : 1,
        preferred_time: linhas[m].preferred_time,
        // NULL explícito: ver a nota sobre `days_of_week` no topo do arquivo.
        days_of_week: null,
        is_active: linhas[m].ativo,
        instructions: linhas[m].instructions.trim() || null,
      }));
      const { data, error } = await (supabase as any)
        .from("monitoring_plan")
        .upsert(registros, { onConflict: "patient_user_id,metric" })
        .select("id");
      if (error) throw error;
      /**
       * O `.select()` existe por causa de um jeito específico de falhar: a
       * RLS de `monitoring_plan` exige vínculo ativo com a paciente. Quando o
       * vínculo não está ativo, o upsert afeta ZERO linhas e devolve
       * `error: null` — e o toast dizia "Plano salvo. O paciente já vê na
       * tela inicial dele" para um plano que não existia em lugar nenhum. O
       * médico saía da consulta achando que tinha prescrito.
       */
      if (!data || data.length === 0) {
        throw new Error("O plano não foi gravado: confirme o vínculo ativo com a paciente.");
      }
      if (data.length < registros.length) {
        throw new Error(`Só ${data.length} de ${registros.length} itens foram gravados. Recarregue e confira o plano.`);
      }
    },
    onSuccess: () => {
      setRascunho(null);
      qc.invalidateQueries({ queryKey: queryKeys.monitoringPlan.all });
      // Em demonstração nada é gravado; dizer "o paciente já vê" ali era a
      // mesma mentira do caso da RLS, só que garantida.
      if (demo) toast.info("Modo demo: nada é salvo.");
      else toast.success("Plano salvo. O paciente já vê na tela inicial dele.");
    },
    // A mensagem do erro é específica (vínculo, gravação parcial) e precisa
    // chegar inteira ao médico — um "não consegui salvar" genérico esconde
    // justamente a causa que ele consegue resolver.
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Não consegui salvar o plano."),
  });

  const ativos = METRICAS.filter((m) => linhas[m].ativo).length;

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Plano de monitoramento"
        icon={ClipboardList}
        subtitle={
          ativos === 0
            ? "nada prescrito — o app do paciente está sugerindo o mínimo por conta própria"
            : `${ativos} ${ativos === 1 ? "item prescrito" : "itens prescritos"} — é isto que aparece na tela inicial dele`
        }
      />

      <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {METRICAS.map((m) => {
          const l = linhas[m];
          return (
            <div key={m} className={cn("px-3 py-3", l.ativo ? "bg-card" : "bg-muted/30")}>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 min-w-[140px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={l.ativo}
                    onChange={(e) => mudar(m, { ativo: e.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className={cn("text-sm", l.ativo ? "font-medium" : "text-muted-foreground")}>
                    {ROTULO_METRICA[m]}
                  </span>
                </label>

                {l.ativo ? (
                  <select
                    value={l.frequency}
                    onChange={(e) => mudar(m, { frequency: e.target.value as Frequencia })}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {FREQUENCIAS.map((f) => (
                      <option key={f} value={f}>{ROTULO_FREQUENCIA[f]}</option>
                    ))}
                  </select>
                ) : null}

                {/* Horário preferido só faz sentido em item cobrado todo dia:
                    em "uma vez por mês" a palavra "de manhã" não orienta nada.
                    Some da linha em vez de aparecer desabilitada. */}
                {l.ativo && (l.frequency === "daily" || l.frequency === "twice_daily") ? (
                  <select
                    value={l.preferred_time}
                    onChange={(e) => mudar(m, { preferred_time: e.target.value as Horario })}
                    aria-label={`Horário preferido para ${ROTULO_METRICA[m]}`}
                    className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                  >
                    {HORARIOS.map((h) => (
                      <option key={h} value={h}>{ROTULO_HORARIO[h]}</option>
                    ))}
                  </select>
                ) : null}

                {l.ativo ? (
                  <Input
                    value={l.instructions}
                    onChange={(e) => mudar(m, { instructions: e.target.value })}
                    placeholder="instrução para o paciente (opcional)"
                    className="h-9 flex-1 min-w-[180px] text-sm"
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {sujo ? (
        <div className="flex gap-2">
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando…" : "Salvar plano"}
          </Button>
          <Button variant="ghost" onClick={() => setRascunho(null)}>Descartar</Button>
        </div>
      ) : null}
    </section>
  );
}
