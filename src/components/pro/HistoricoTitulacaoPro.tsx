/**
 * Histórico de titulação na tela do médico — denso, ao lado das medicações.
 *
 * A tabela `medication_titrations` existia, era escrita a cada titulação, tem
 * três índices e não tinha um SELECT no projeto inteiro. O resultado prático:
 * o médico que titulou Losartana três vezes em seis meses via só "100 mg" e
 * precisava lembrar de cabeça de onde tinha partido e por quê — exatamente a
 * informação que a migração diz ser "o ato clínico central".
 *
 * Densidade de tela de médico: linha por titulação, texto pequeno, sem
 * cartões grandes e sem a tipografia do app do paciente.
 */
import { History } from "lucide-react";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import type { Titulacao } from "@/hooks/useCardioMedications";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function HistoricoTitulacaoPro({
  titulacoes,
  isLoading,
}: {
  titulacoes: Titulacao[];
  isLoading?: boolean;
}) {
  return (
    <div>
      <SectionHeader
        title="Histórico de titulação"
        icon={History}
        subtitle="dose anterior → nova, motivo e autor — o mesmo histórico que o paciente vê em Remédios"
      />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : titulacoes.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma titulação registrada"
          description="Cada mudança de dose feita por aqui entra nesta lista, com motivo e autor."
          variant="card"
        />
      ) : (
        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
          {titulacoes.map((t) => (
            <div key={t.id} className="px-3 py-2.5 bg-card">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <p className="text-sm text-foreground">
                  <b>{t.medicamento ?? "Medicação removida"}</b>{" "}
                  <span className="tabular-nums">
                    {t.previous_dose ?? "—"} → <b>{t.new_dose}</b>
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {fmt(t.created_at)} · {t.medico ?? "autor não registrado"}
                </p>
              </div>
              {t.reason ? (
                <p className="text-[11px] text-muted-foreground mt-0.5 break-words">Motivo: {t.reason}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
