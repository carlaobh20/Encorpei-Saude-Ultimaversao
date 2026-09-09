/**
 * AgendaPage — consultas.
 *
 * Próxima consulta em destaque, histórico, e um bloco de anotações "o que
 * quero perguntar" que fica só no aparelho (nenhuma tabela nova inventada).
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, MapPin, ListChecks, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppointments } from "@/hooks/useProfessional";

const STORAGE_KEY = "cardio.agenda.perguntas.v1";

interface Pergunta { id: string; texto: string; criadoEm: string; }

function carregarPerguntas(): Pergunta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Pergunta[]) : [];
  } catch {
    return [];
  }
}
function salvarPerguntas(lista: Pergunta[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lista)); } catch { /* ignora */ }
}

const STATUS_VARIANT: Record<string, "normal" | "pendente" | "concluido" | "urgencia"> = {
  scheduled: "pendente",
  completed: "concluido",
  cancelled: "normal",
  no_show: "urgencia",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "Faltou",
};

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) + " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function AgendaPage() {
  const { appointments, proxima, isLoading } = useAppointments();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [novaPergunta, setNovaPergunta] = useState("");

  useEffect(() => { setPerguntas(carregarPerguntas()); }, []);

  const adicionar = () => {
    const texto = novaPergunta.trim();
    if (!texto) return;
    const lista = [{ id: crypto.randomUUID(), texto, criadoEm: new Date().toISOString() }, ...perguntas];
    setPerguntas(lista);
    salvarPerguntas(lista);
    setNovaPergunta("");
    toast.success("Anotado. Essa lista fica só no seu aparelho — mostre para o médico na consulta.");
  };

  const remover = (id: string) => {
    const lista = perguntas.filter((p) => p.id !== id);
    setPerguntas(lista);
    salvarPerguntas(lista);
  };

  const historico = appointments.filter((a) => a.id !== proxima?.id);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Agenda" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Agenda" subtitle="Suas consultas" />

      {/* ── Próxima consulta ─────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Próxima consulta" />
        {proxima ? (
          <SurfaceCard className="bg-cardio-50 border-0">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-card grid place-items-center shrink-0">
                <CalendarClock className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-foreground">{fmtDataHora(proxima.scheduled_at)}</p>
                {proxima.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {proxima.location}
                  </p>
                )}
              </div>
            </div>
          </SurfaceCard>
        ) : (
          <EmptyState icon={CalendarClock} title="Sem consulta marcada" description="Quando seu médico agendar, ela aparece aqui." variant="card" />
        )}
      </div>

      {/* ── O que quero perguntar ────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="O que quero perguntar na consulta" icon={ListChecks} />
        <SurfaceCard>
          <Textarea
            placeholder="Escreva aqui uma dúvida para não esquecer na consulta..."
            value={novaPergunta}
            onChange={(e) => setNovaPergunta(e.target.value)}
            className="min-h-[80px] mb-3"
          />
          <Button size="lg" className="w-full gap-2" onClick={adicionar} disabled={!novaPergunta.trim()}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Essa lista fica guardada só neste aparelho — não é enviada ao médico automaticamente.
          </p>
        </SurfaceCard>

        {perguntas.length > 0 && (
          <div className="space-y-2 mt-3">
            {perguntas.map((p) => (
              <SurfaceCard key={p.id} className="flex items-center justify-between gap-3">
                <p className="text-sm text-foreground">{p.texto}</p>
                <button
                  onClick={() => remover(p.id)}
                  aria-label="Remover"
                  className="h-8 w-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-secondary shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>

      {/* ── Histórico ────────────────────────────────────────────── */}
      <div>
        <SectionHeader title="Consultas anteriores" />
        {historico.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Sem histórico" description="Suas consultas passadas aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-2.5">
            {historico.map((a) => (
              <SurfaceCard key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{fmtDataHora(a.scheduled_at)}</p>
                    {a.location && <p className="text-xs text-muted-foreground mt-0.5">{a.location}</p>}
                    {a.notes && <p className="text-xs text-foreground mt-1.5">{a.notes}</p>}
                  </div>
                  <StatusBadge variant={STATUS_VARIANT[a.status] ?? "normal"} className="shrink-0">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </StatusBadge>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
