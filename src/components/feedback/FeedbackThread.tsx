/**
 * Conversa de um feedback específico — lista de respostas + campo para
 * escrever uma nova. Compartilhado entre o painel admin (tema escuro) e as
 * telas de paciente/médico (tema claro, tokens padrão do app).
 */
import { useState } from "react";
import { CheckCircle2, Lock, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppModal } from "@/components/shell/AppModal";
import {
  useFeedbackReplies,
  useSendFeedbackReply,
  type FeedbackReplyAuthorRole,
} from "@/hooks/useFeedback";

interface FeedbackThreadProps {
  feedbackId: string;
  currentAuthorRole: FeedbackReplyAuthorRole;
  currentAuthorName: string | null;
  variant?: "dark" | "light";
  placeholder?: string;
  /**
   * Quando true, esconde o campo de escrever pra quem está com currentAuthorRole
   * "user" — mantém o histórico visível, só não deixa mandar mensagem nova.
   * Usado quando o feedback já foi marcado como "Resolvido" pelo admin.
   * O admin nunca fica travado por isso (pode reabrir a conversa quando quiser).
   */
  locked?: boolean;
}

export function FeedbackThread({
  feedbackId,
  currentAuthorRole,
  currentAuthorName,
  variant = "light",
  placeholder,
  locked = false,
}: FeedbackThreadProps) {
  const { data: replies = [], isLoading } = useFeedbackReplies(feedbackId);
  const send = useSendFeedbackReply();
  const [message, setMessage] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sentMessage, setSentMessage] = useState("");

  const isDark = variant === "dark";
  const composerLocked = locked && currentAuthorRole === "user";

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    try {
      await send.mutateAsync({ feedbackId, authorRole: currentAuthorRole, authorName: currentAuthorName, message: text });
      setMessage("");
      setSentMessage(text);
      setConfirmOpen(true);
    } catch {
      // erro já vira toast genérico pelo onError global do queryClient
    }
  };

  return (
    <div className={cn("space-y-3", isDark ? "" : "")}>
      {isLoading && (
        <div className={cn("flex items-center gap-2 text-xs", isDark ? "text-white/50" : "text-muted-foreground")}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando conversa...
        </div>
      )}

      {!isLoading && replies.length > 0 && (
        <div className="space-y-2">
          {replies.map((r) => {
            const mine = r.author_role === currentAuthorRole;
            return (
              <div key={r.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] whitespace-pre-wrap",
                    isDark
                      ? mine
                        ? "bg-white/15 text-white"
                        : "bg-white/5 text-white/85 border border-white/10"
                      : mine
                        ? "bg-primary/10 text-foreground border border-primary/20"
                        : "bg-secondary/50 text-foreground border border-border",
                  )}
                >
                  <p className={cn("text-[10.5px] font-semibold mb-0.5", isDark ? "text-white/50" : "text-muted-foreground")}>
                    {r.author_role === "admin" ? "Equipe Encorpei" : (r.author_name || "Você")}
                  </p>
                  <p>{r.message}</p>
                  <p className={cn("text-[10px] mt-1", isDark ? "text-white/35" : "text-muted-foreground/70")}>
                    {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {composerLocked ? (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[12.5px]",
            isDark ? "bg-white/5 text-white/50 border border-white/10" : "bg-secondary/40 text-muted-foreground border border-border",
          )}
        >
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Este feedback foi marcado como resolvido — o histórico continua aqui, mas não é mais possível enviar novas mensagens.
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder ?? (currentAuthorRole === "admin" ? "Responder, agradecer ou perguntar algo..." : "Escreva sua resposta...")}
            rows={1}
            className={cn(
              "min-h-[38px] text-[13px]",
              isDark ? "bg-white/5 border-white/10 text-white placeholder:text-white/30" : "",
            )}
          />
          <Button
            size="icon"
            variant={isDark ? "secondary" : "default"}
            disabled={send.isPending || !message.trim()}
            onClick={handleSend}
            className="shrink-0"
          >
            {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <AppModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Resposta enviada!
          </span>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary/50 border border-border p-3 text-sm text-foreground whitespace-pre-wrap">
            {sentMessage}
          </div>
          <Button className="w-full" onClick={() => setConfirmOpen(false)}>
            OK
          </Button>
        </div>
      </AppModal>
    </div>
  );
}
