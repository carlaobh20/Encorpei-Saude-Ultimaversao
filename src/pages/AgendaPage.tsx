/**
 * AgendaPage — consultas.
 *
 * Próxima consulta em destaque, histórico, e um bloco de anotações "o que
 * quero perguntar" que fica só no aparelho (nenhuma tabela nova inventada).
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * A lista de perguntas continua em `localStorage` e continua dizendo que fica
 * só no aparelho — isso é contrato com o paciente, não detalhe de layout
 * (e `localStorage` aqui não guarda dado clínico: guarda o que ELE quer
 * perguntar). O que mudou:
 *
 *  · O campo de anotação virou `Campo` dentro de `Formulario`: rótulo
 *    explícito em vez de placeholder fazendo papel de rótulo. Placeholder
 *    some quando se começa a digitar, e quem esqueceu o que era o campo fica
 *    sem instrução nenhuma.
 *
 *  · "Adicionar" deixou de ser azul cheio. O azul desta tela não é anotar uma
 *    dúvida — é a consulta em si. Anotar virou botão secundário; a próxima
 *    consulta ficou no cartão `cardio-50` de sempre, no topo.
 *
 *  · O botão de remover pergunta subiu de 32px para 44px de alvo e ganhou
 *    rótulo acessível com o texto da pergunta, para não haver oito botões
 *    "Remover" idênticos para quem usa leitor de tela.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, MapPin, ListChecks, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { TelaPaciente, TituloSecao, Formulario, Campo } from "@/components/shell";
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
      <TelaPaciente>
        <PageHeader title="Agenda" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Agenda" subtitle="Suas consultas" />

      {/* ── Próxima consulta ─────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Próxima consulta" />
        {proxima ? (
          <SurfaceCard className="bg-cardio-50 border-0">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-card grid place-items-center shrink-0">
                <CalendarClock className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-snug break-words">{fmtDataHora(proxima.scheduled_at)}</p>
                {proxima.location && (
                  <p className="text-base text-muted-foreground flex items-start gap-1.5 mt-1">
                    <MapPin className="h-5 w-5 shrink-0 mt-0.5" aria-hidden /> {proxima.location}
                  </p>
                )}
              </div>
            </div>
          </SurfaceCard>
        ) : (
          <EmptyState icon={CalendarClock} title="Sem consulta marcada" description="Quando seu médico agendar, ela aparece aqui." variant="card" />
        )}
      </section>

      {/* ── O que quero perguntar ────────────────────────────────── */}
      <section>
        <TituloSecao titulo="O que quero perguntar na consulta" icone={ListChecks} />
        <SurfaceCard>
          <Formulario>
            <Campo
              rotulo="Sua dúvida"
              para="nova-pergunta"
              ajuda="Essa lista fica guardada só neste aparelho — não é enviada ao médico automaticamente."
            >
              <Textarea
                id="nova-pergunta"
                placeholder="Escreva aqui uma dúvida para não esquecer na consulta..."
                value={novaPergunta}
                onChange={(e) => setNovaPergunta(e.target.value)}
                className="min-h-[96px]"
              />
            </Campo>
            {/* Secundário de propósito: o azul desta tela é a consulta. */}
            <Button variant="outline" size="lg" className="w-full gap-2 mt-3" onClick={adicionar} disabled={!novaPergunta.trim()}>
              <Plus className="h-5 w-5" aria-hidden /> Adicionar
            </Button>
          </Formulario>
        </SurfaceCard>

        {perguntas.length > 0 && (
          <div className="space-y-2 mt-3">
            {perguntas.map((p) => (
              <SurfaceCard key={p.id} className="flex items-center justify-between gap-3">
                <p className="text-base text-foreground min-w-0 break-words">{p.texto}</p>
                <button
                  type="button"
                  onClick={() => remover(p.id)}
                  aria-label={`Remover a pergunta: ${p.texto}`}
                  className="h-11 w-11 shrink-0 rounded-xl grid place-items-center text-muted-foreground hover:bg-secondary"
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>

      {/* ── Histórico ────────────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Consultas anteriores" />
        {historico.length === 0 ? (
          <EmptyState icon={CalendarClock} title="Sem histórico" description="Suas consultas passadas aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-2.5">
            {historico.map((a) => (
              <SurfaceCard key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground break-words">{fmtDataHora(a.scheduled_at)}</p>
                    {a.location && <p className="text-sm text-muted-foreground mt-0.5">{a.location}</p>}
                    {a.notes && <p className="text-base text-foreground mt-1.5 leading-relaxed">{a.notes}</p>}
                  </div>
                  <StatusBadge variant={STATUS_VARIANT[a.status] ?? "normal"} className="shrink-0">
                    {STATUS_LABEL[a.status] ?? a.status}
                  </StatusBadge>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>
    </TelaPaciente>
  );
}
