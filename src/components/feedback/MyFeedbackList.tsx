/**
 * "Meus feedbacks enviados" — lista os feedbacks da própria pessoa (paciente
 * ou médico) com o status atual e a conversa com a equipe, se houver.
 * Usado tanto em /feedback (paciente) quanto em /pro/feedback (médico).
 */
import { useState } from "react";
import { ChevronUp, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyFeedback, useFeedbackReplyCounts, type FeedbackRow } from "@/hooks/useFeedback";
import { FeedbackThread } from "@/components/feedback/FeedbackThread";

const CATEGORY_LABEL: Record<string, string> = {
  suggestion: "Sugestão", bug: "Erro", praise: "Elogio", improvement: "Melhoria",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Enviado", in_review: "Em análise", resolved: "Resolvido", archived: "Arquivado",
};
const STATUS_TONE: Record<string, string> = {
  new: "bg-secondary text-muted-foreground",
  in_review: "bg-sky-50 text-sky-700",
  resolved: "bg-emerald-50 text-emerald-700",
  archived: "bg-secondary text-muted-foreground",
};

function MyFeedbackCard({ item, authorName, respostas }: { item: FeedbackRow; authorName: string | null; respostas: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-foreground">
              {CATEGORY_LABEL[item.category] ?? item.category}
            </span>
            <span className={cn("text-[11px] px-2 py-0.5 rounded-full", STATUS_TONE[item.status])}>
              {STATUS_LABEL[item.status] ?? item.status}
            </span>
          </div>
          <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{item.message}</p>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground pt-1"
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
        {open ? "Ocultar conversa" : respostas > 0 ? `Ver resposta da equipe (${respostas})` : "Responder / ver conversa"}
      </button>

      {open && (
        <div className="pt-1">
          <FeedbackThread
            feedbackId={item.id}
            currentAuthorRole="user"
            currentAuthorName={authorName}
            variant="light"
            placeholder="Escreva sua resposta para a equipe..."
            locked={item.status === "resolved"}
          />
        </div>
      )}
    </div>
  );
}

export function MyFeedbackList({ authorName }: { authorName: string | null }) {
  const { data: items = [], isLoading } = useMyFeedback();
  // Uma consulta para a lista toda, em vez de uma por cartão.
  const contagens = useFeedbackReplyCounts(items.map((i) => i.id));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando seus feedbacks...
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Meus feedbacks enviados</h2>
      <div className="space-y-2.5">
        {items.map((item) => (
          <MyFeedbackCard key={item.id} item={item} authorName={authorName} respostas={contagens[item.id] ?? 0} />
        ))}
      </div>
    </div>
  );
}
