import { useState } from "react";
import { Loader2, Paperclip, MessageCircle, ChevronUp } from "lucide-react";
import { useAllFeedback, useUpdateFeedback, useFeedbackReplies, getFeedbackAttachmentUrl, type FeedbackStatus, type FeedbackRow } from "@/hooks/useFeedback";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FeedbackThread } from "@/components/feedback/FeedbackThread";
import { useAuth } from "@/contexts/AuthContext";

const CATEGORY_LABEL: Record<string, string> = {
  suggestion: "Sugestão", bug: "Erro", praise: "Elogio", improvement: "Melhoria",
};
const IMPORTANCE_LABEL: Record<string, string> = {
  nice_to_have: "Legal ter", important: "Importante", essential: "Essencial",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Novo", in_review: "Em análise", resolved: "Resolvido", archived: "Arquivado",
};
const ROLE_LABEL: Record<string, string> = { patient: "Paciente", professional: "Médico" };

function FeedbackCard({ item }: { item: FeedbackRow }) {
  const { user } = useAuth();
  const update = useUpdateFeedback();
  const [notes, setNotes] = useState(item.admin_notes ?? "");
  const [openingAttachment, setOpeningAttachment] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const { data: replies = [] } = useFeedbackReplies(item.id);

  const openAttachment = async () => {
    if (!item.attachment_path) return;
    setOpeningAttachment(true);
    try {
      const url = await getFeedbackAttachmentUrl(item.attachment_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      // silencioso — botão volta ao normal, usuário pode tentar de novo
    } finally {
      setOpeningAttachment(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/10">{CATEGORY_LABEL[item.category] ?? item.category}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/60">{IMPORTANCE_LABEL[item.importance] ?? item.importance}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-white/60">{ROLE_LABEL[item.author_role] ?? item.author_role}</span>
          </div>
          <p className="text-sm text-white mt-2 whitespace-pre-wrap">{item.message}</p>
          {item.attachment_path && (
            <button
              type="button"
              onClick={openAttachment}
              disabled={openingAttachment}
              className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-white/60 hover:text-white underline underline-offset-2"
            >
              <Paperclip className="h-3 w-3" />
              {openingAttachment ? "Abrindo..." : "Ver anexo"}
            </button>
          )}
          <p className="text-[11.5px] text-white/40 mt-2">
            {item.author_name ?? "—"} · {item.author_email ?? "—"}
            {item.screen ? ` · ${item.screen}` : ""}
            {" · "}
            {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Select value={item.status} onValueChange={(v) => update.mutate({ id: item.id, status: v as FeedbackStatus })}>
          <SelectTrigger className="h-8 w-[130px] bg-white/5 border-white/10 text-white text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota interna (só o time vê)"
          rows={1}
          className="bg-white/5 border-white/10 text-white text-xs placeholder:text-white/30 min-h-[36px]"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={update.isPending || notes === (item.admin_notes ?? "")}
          onClick={() => update.mutate({ id: item.id, admin_notes: notes })}
        >
          Salvar
        </Button>
      </div>

      <div className="pt-1 border-t border-white/10">
        <button
          type="button"
          onClick={() => setShowThread((s) => !s)}
          className="flex items-center gap-1.5 text-[11.5px] text-white/60 hover:text-white pt-2"
        >
          {showThread ? <ChevronUp className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
          {showThread ? "Ocultar conversa" : replies.length > 0 ? `Ver conversa (${replies.length})` : "Responder"}
        </button>
        {showThread && (
          <div className="mt-2">
            <FeedbackThread
              feedbackId={item.id}
              currentAuthorRole="admin"
              currentAuthorName={user?.email ?? "Equipe Encorpei"}
              variant="dark"
              placeholder="Agradecer, tirar dúvida ou pedir mais detalhes..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const { data: items = [], isLoading, isError, error } = useAllFeedback(statusFilter);

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[760px] mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Feedbacks</h1>
          <p className="text-sm text-white/50 mt-1">De pacientes e médicos, mais recentes primeiro.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[150px] bg-white/5 border-white/10 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Não foi possível carregar os feedbacks. {(error as any)?.message}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-white/40">Nenhum feedback ainda.</p>
      )}

      <div className="space-y-3">
        {items.map((item) => <FeedbackCard key={item.id} item={item} />)}
      </div>
    </div>
  );
}
