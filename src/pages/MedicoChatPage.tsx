/**
 * MedicoChatPage — conversa do paciente com o cardiologista.
 *
 * Aviso fixo: este canal não é para emergência. Bolhas simples, envio,
 * marcação de lidas.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * O aviso de "não é para emergência" continua fixo, no topo, antes das
 * mensagens, com o mesmo texto e levando ao mesmo lugar. Mudou:
 *
 *  · O texto do aviso estava em `text-xs` sobre fundo amarelo — 13px, o
 *    menor texto da tela, para o recado que mais importa aqui. Subiu para o
 *    corpo legível e ganhou ícone e alvo de 48px.
 *
 *  · As bolhas saíram de 14px para o corpo de 17px, e a hora saiu de 10px
 *    para 12px, que é o piso da auditoria.
 *
 *  · A caixa de escrever ganhou rótulo acessível (era um `Textarea` com
 *    placeholder no lugar de rótulo) e o botão de enviar ficou em 48px.
 *
 * A altura calculada da tela (`100dvh - 10rem`) continua como estava: é ela
 * que mantém a caixa de escrever acima da barra inferior e do botão
 * flutuante de socorro.
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
import { useMedicoVinculado } from "@/hooks/useMarcaClinica";
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
  // Uma pergunta, uma resposta: quem é o médico deste paciente vem do mesmo
  // lugar que a marca da clínica — inclusive em demonstração, onde a lista
  // crua de vínculos chegava vazia e o cabeçalho caía em "Meu médico".
  const { medico } = useMedicoVinculado();
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
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Meu médico" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col h-[calc(100dvh-10rem)]">
      <PageHeader title={medico?.nome ?? "Meu médico"} subtitle={medico?.clinica ?? undefined} />

      <button
        type="button"
        onClick={() => navigate("/emergencia")}
        className="mb-4 w-full min-h-[56px] flex items-start gap-3 rounded-2xl border-l-4 border-warning bg-warning-bg px-4 py-3 text-left"
      >
        <AlertTriangle className="h-6 w-6 text-warning shrink-0 mt-0.5" aria-hidden />
        <p className="text-base text-foreground leading-relaxed">
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
                <p className="text-center text-sm text-muted-foreground mb-2">{fmtDia(g.itens[0].created_at)}</p>
                <div className="space-y-2">
                  {g.itens.map((m) => {
                    const minha = m.sender === "patient";
                    return (
                      <div key={m.id} className={cn("flex", minha ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3",
                            minha ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                          )}
                        >
                          <p className="text-base leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                          <p className={cn("text-xs mt-1", minha ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
          aria-label="Escreva uma mensagem para o seu médico"
          className="min-h-[48px] max-h-32 rounded-xl text-base"
        />
        <Button size="icon" className="h-12 w-12 rounded-full shrink-0" onClick={enviarMensagem} disabled={!texto.trim() || enviar.isPending} aria-label="Enviar">
          <Send className="h-5 w-5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
