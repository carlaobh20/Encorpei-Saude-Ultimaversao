/**
 * AGENDA — consultas da semana e do dia. `useAppointments` é por paciente;
 * a agenda do médico é montada agregando `nextAppointment` de cada paciente
 * da fila (`useProfessionalPatients`). Sem consultas cadastradas, mostra um
 * estado vazio honesto — nada de compromisso fictício.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Clock, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { useProfessionalPatients } from "@/hooks/useProfessional";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}
function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameWeek(d: Date, ref: Date): boolean {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return d >= start && d < end;
}

export default function ProAgendaPage() {
  const navigate = useNavigate();
  const { patients, isLoading } = useProfessionalPatients();

  const consultas = useMemo(() => {
    const hoje = new Date();
    return patients
      .filter((p) => p.status === "active" && p.nextAppointment)
      .map((p) => ({ patient: p, at: new Date(p.nextAppointment as string) }))
      .filter((c) => Number.isFinite(c.at.getTime()))
      .sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [patients]);

  const hoje = new Date();
  const doDia = consultas.filter((c) => isSameDay(c.at, hoje));
  const daSemana = consultas.filter((c) => isSameWeek(c.at, hoje));
  const futuras = consultas.filter((c) => !isSameDay(c.at, hoje));

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader title="Agenda" subtitle="Consultas agendadas dos seus pacientes" />

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
            <StatCard label="Hoje" value={doDia.length} icon={Clock} />
            <StatCard label="Esta semana" value={daSemana.length} icon={CalendarDays} />
            <StatCard label="Total agendadas" value={consultas.length} icon={Calendar} />
          </div>

          <SectionHeader title="Hoje" />
          {doDia.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 mb-6">Nenhuma consulta hoje.</p>
          ) : (
            <div className="rounded-2xl bg-card border border-border overflow-hidden mb-6">
              {doDia.map((c) => (
                <button
                  key={c.patient.link_id}
                  onClick={() => navigate(`/pro/pacientes/${c.patient.patient_user_id}`)}
                  className="w-full flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors text-left"
                >
                  <div className="font-display text-lg font-medium tabular-nums text-foreground w-14 shrink-0">{fmtTime(c.patient.nextAppointment!)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{c.patient.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.patient.condition || "—"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}

          <SectionHeader title="Próximas consultas" subtitle="ordenadas por data" />
          {futuras.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nenhuma consulta futura agendada"
              description="Quando você ou o paciente registrarem uma consulta, ela aparece aqui automaticamente."
              variant="card"
            />
          ) : (
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              {futuras.map((c) => (
                <button
                  key={c.patient.link_id}
                  onClick={() => navigate(`/pro/pacientes/${c.patient.patient_user_id}`)}
                  className="w-full flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-secondary/40 transition-colors text-left"
                >
                  <div className={cn("rounded-xl bg-secondary/60 px-2.5 py-1.5 text-center shrink-0 w-20")}>
                    <p className="text-[11px] font-semibold text-foreground capitalize">{fmtDate(c.patient.nextAppointment!)}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{fmtTime(c.patient.nextAppointment!)}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{c.patient.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.patient.condition || "—"}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
