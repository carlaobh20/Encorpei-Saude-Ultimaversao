/**
 * MedicoChatPage — conversa do paciente com o cardiologista.
 *
 * Aviso fixo: este canal não é para emergência. Bolhas simples, envio,
 * marcação de lidas.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Send } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { usePatientMessages } from "@/hooks/useProfessional";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { MessageCircle } from "lucide-react";

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}
function diaChave(iso: string): string {
  return new Date(iso).toDateString();
}

export default function MedicoChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { professionals } = useMyProfessionals();
  const medico = professionals[0] ?? null;
  const { messages, isLoading, enviar, marcarLidas } = usePatientMessages(user?.id, "patient", user?.id);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  useEffect(() => { if (user?.id) marcarLidas.mutate(); }, [user?.id, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const grupos = useMemo(() => {
    const out: { dia: string; itens: typeof messages }[] = [];
    for (const m of messages) {
      const chave = diaChave(m.created_at);
      const atual = out[out.length - 1];
      if (atual && diaChave(atual.itens[0].created_at) === chave) atual.itens.push(m);
      else out.push({ dia: chave, itens: [m] });
    }
    return out;
  }, [messages]);

  const enviarMensagem = () => {
    const t = texto.trim();
    if (!t) return;
    enviar.mutate(t);
    setTexto("");
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Meu médico" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)]">
      <PageHeader title={medico?.display_name ?? "Meu médico"} subtitle={medico?.clinic_name ?? undefined} />

      <button
        onClick={() => navigate("/emergencia")}
        className="mb-4 w-full flex items-center gap-2 rounded-2xl bg-warning-bg px-4 py-3 text-left"
      >
        <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
        <p className="text-xs text-warning">
          Este chat não é para emergência. Se não estiver bem, toque aqui para ver o que fazer.
        </p>
      </button>

      <div className="flex-1 overflow-y-auto -mx-1 px-1 mb-4">
        {messages.length === 0 ? (
          <EmptyState icon={MessageCircle} title="Nenhuma mensagem ainda" description="Escreva para o seu médico abaixo." variant="card" />
        ) : (
          <div className="space-y-5">
            {grupos.map((g) => (
              <div key={g.dia}>
                <p className="text-center text-[11px] text-muted-foreground mb-2">{fmtDia(g.itens[0].created_at)}</p>
                <div className="space-y-2">
                  {g.itens.map((m) => {
                    const minha = m.sender === "patient";
                    return (
                      <div key={m.id} className={cn("flex", minha ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                            minha ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          <p className={cn("text-[10px] mt-1", minha ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {fmtHora(m.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={fimRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 pt-2 border-t border-border">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
          placeholder="Escreva uma mensagem..."
          className="min-h-[48px] max-h-32"
        />
        <Button size="icon" className="h-12 w-12 rounded-full shrink-0" onClick={enviarMensagem} disabled={!texto.trim() || enviar.isPending} aria-label="Enviar">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}
