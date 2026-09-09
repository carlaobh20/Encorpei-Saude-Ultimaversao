/**
 * MENSAGENS — caixa de conversas do médico. Lista de pacientes com não
 * lidas + thread selecionada via usePatientMessages(uid, "doctor", user.id).
 */
import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Search, Send, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalPatients, usePatientMessages, type FilaItem } from "@/hooks/useProfessional";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtPreview(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return fmtTime(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function ChatThread({ patient, doctorId }: { patient: FilaItem; doctorId?: string }) {
  const { messages, isLoading, enviar, marcarLidas } = usePatientMessages(patient.patient_user_id, "doctor", doctorId);
  const [text, setText] = useState("");

  useEffect(() => { marcarLidas.mutate(); }, [patient.patient_user_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = text.trim();
    if (!t) return;
    enviar.mutate(t);
    setText("");
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="border-b border-border px-4 py-3 flex items-center gap-2.5 shrink-0">
        <div className="h-9 w-9 rounded-full grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-primary to-cardio-dark shrink-0">
          {initials(patient.full_name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{patient.full_name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{patient.condition || "—"}</p>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 bg-background">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : messages.length === 0 ? (
          <div className="h-full grid place-items-center text-center">
            <div>
              <MessageSquare className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender === "doctor" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-2xl px-3.5 py-2",
                m.sender === "doctor" ? "bg-primary text-primary-foreground" : "bg-card border border-border",
              )}>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                <p className={cn("text-[10px] mt-1", m.sender === "doctor" ? "text-primary-foreground/70" : "text-muted-foreground")}>{fmtTime(m.created_at)}</p>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border p-3 shrink-0 flex items-center gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escreva uma mensagem…"
          className="flex-1"
        />
        <button
          onClick={send}
          disabled={!text.trim() || enviar.isPending}
          className={cn("h-9 w-9 rounded-full grid place-items-center shrink-0 transition-colors",
            text.trim() ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function ProMensagensPage() {
  const { user } = useAuth();
  const { patients, isLoading } = useProfessionalPatients();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get("paciente"); } catch { return null; }
  });

  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);
  const filtered = useMemo(
    () => ativos.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase())),
    [ativos, search],
  );
  const selected = ativos.find((p) => p.patient_user_id === selectedId) ?? null;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader title="Mensagens" subtitle="Converse com seus pacientes" />

      <div className="rounded-2xl bg-card border border-border overflow-hidden grid md:grid-cols-[320px_1fr]" style={{ height: "calc(100vh - 13rem)", minHeight: 440 }}>
        <div className={cn("flex flex-col border-r border-border min-h-0", selected ? "hidden md:flex" : "flex")}>
          <div className="p-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2 border border-border rounded-xl px-3 h-9">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar paciente…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-w-0"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3"><ListSkeleton rows={4} /></div>
            ) : filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground p-6 text-center">Nenhum paciente ativo.</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.link_id}
                  onClick={() => setSelectedId(p.patient_user_id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3.5 py-3 text-left hover:bg-secondary/40 transition-colors",
                    selectedId === p.patient_user_id && "bg-primary/5",
                  )}
                >
                  <div className="h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-primary to-cardio-dark">
                    {initials(p.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.condition || "—"}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className={cn("min-w-0 min-h-0", selected ? "flex flex-col" : "hidden md:flex md:flex-col")}>
          {selected ? (
            <>
              <button onClick={() => setSelectedId(null)} className="md:hidden flex items-center gap-1 text-xs text-muted-foreground p-2">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <ChatThread patient={selected} doctorId={user?.id} />
            </>
          ) : (
            <EmptyState icon={MessageSquare} title="Selecione uma conversa" description="Escolha um paciente para ver as mensagens." />
          )}
        </div>
      </div>
    </div>
  );
}
