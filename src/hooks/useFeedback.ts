/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

export type FeedbackAuthorRole = "patient" | "professional";
export type FeedbackCategory = "suggestion" | "bug" | "praise" | "improvement";
export type FeedbackImportance = "nice_to_have" | "important" | "essential";
export type FeedbackStatus = "new" | "in_review" | "resolved" | "archived";

export interface FeedbackRow {
  id: string;
  user_id: string;
  author_role: FeedbackAuthorRole;
  author_name: string | null;
  author_email: string | null;
  category: FeedbackCategory;
  screen: string | null;
  message: string;
  importance: FeedbackImportance;
  status: FeedbackStatus;
  admin_notes: string | null;
  attachment_path: string | null;
  created_at: string;
  updated_at: string;
}

interface SubmitFeedbackInput {
  authorRole: FeedbackAuthorRole;
  authorName: string | null;
  category: FeedbackCategory;
  screen?: string;
  message: string;
  importance: FeedbackImportance;
  attachment?: File | null;
}

const ATTACHMENTS_BUCKET = "feedback-attachments";
const MAX_ATTACHMENT_MB = 20;

/** Envio de feedback — usado tanto pela tela do paciente quanto pela do médico. */
export function useSubmitFeedback() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SubmitFeedbackInput) => {
      if (getDevBypass()) {
        toast.info("Modo demo: feedback não é salvo de verdade");
        return;
      }
      if (!user) throw new Error("Você precisa estar logada(o) para enviar feedback.");

      let attachmentPath: string | null = null;
      if (input.attachment) {
        if (input.attachment.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
          throw new Error(`Arquivo muito grande (máximo ${MAX_ATTACHMENT_MB}MB).`);
        }
        const ext = input.attachment.name.split(".").pop() || "bin";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(ATTACHMENTS_BUCKET)
          .upload(path, input.attachment, { contentType: input.attachment.type || undefined });
        if (uploadError) throw new Error(`Falha ao subir o arquivo: ${uploadError.message}`);
        attachmentPath = path;
      }

      const { error } = await (supabase as any).from("feedback" as any).insert({
        user_id: user.id,
        author_role: input.authorRole,
        author_name: input.authorName,
        author_email: user.email ?? null,
        category: input.category,
        screen: input.screen || null,
        message: input.message.trim(),
        importance: input.importance,
        attachment_path: attachmentPath,
      });
      if (error) throw error;
    },
  });
}

/** Gera um link temporário (60s) pra ver um anexo — o bucket é privado. */
export async function getFeedbackAttachmentUrl(path: string) {
  const { data, error } = await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

/** Lista de feedbacks — RLS só deixa admin ler tudo; os demais só veem os próprios. */
export function useAllFeedback(statusFilter?: FeedbackStatus | "all") {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.feedback.admin, statusFilter ?? "all"],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("feedback" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackRow[];
    },
  });
}

/** Admin: mudar status e/ou anotar nota interna num feedback. */
export function useUpdateFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status?: FeedbackStatus; admin_notes?: string }) => {
      const { error } = await supabase
        .from("feedback" as any)
        .update({
          ...(input.status ? { status: input.status } : {}),
          ...(input.admin_notes !== undefined ? { admin_notes: input.admin_notes } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.feedback.all }),
  });
}

/** Meus feedbacks (RLS já filtra para só os próprios) — usado na tela de "meus feedbacks". */
export function useMyFeedback() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.feedback.mine,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackRow[];
    },
  });
}

export type FeedbackReplyAuthorRole = "admin" | "user";

export interface FeedbackReplyRow {
  id: string;
  feedback_id: string;
  author_role: FeedbackReplyAuthorRole;
  author_name: string | null;
  message: string;
  created_at: string;
}

/** Conversa (respostas) de um feedback — admin vê qualquer uma, dono vê só a própria. */
export function useFeedbackReplies(feedbackId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.feedback.replies(feedbackId ?? ""),
    enabled: !!user && !!feedbackId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_replies" as any)
        .select("*")
        .eq("feedback_id", feedbackId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackReplyRow[];
    },
  });
}

/**
 * Quantas respostas tem cada feedback — em UMA consulta para a lista inteira.
 *
 * A lista de feedbacks só precisa do NÚMERO de respostas para escrever
 * "Ver resposta da equipe (2)" no cartão fechado. Antes cada cartão chamava
 * `useFeedbackReplies(item.id)` por conta própria: uma consulta por linha,
 * o padrão N+1 que já derrubou o painel do médico. A conversa inteira
 * continua sendo carregada por `useFeedbackReplies`, mas só quando alguém
 * ABRE aquele feedback — aí é uma consulta, sob demanda, e não N.
 */
export function useFeedbackReplyCounts(feedbackIds: string[]) {
  const { user } = useAuth();
  // Ordenado para a chave não mudar só porque a lista veio noutra ordem.
  const ids = [...feedbackIds].filter(Boolean).sort();
  const chave = ids.join(",");

  const { data } = useQuery({
    queryKey: [...queryKeys.feedback.all, "replyCounts", chave],
    enabled: !!user && ids.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("feedback_replies" as any)
        .select("feedback_id")
        .in("feedback_id", ids);
      if (error) throw error;
      const contagem: Record<string, number> = {};
      for (const linha of (data ?? []) as unknown as { feedback_id: string }[]) {
        contagem[linha.feedback_id] = (contagem[linha.feedback_id] ?? 0) + 1;
      }
      return contagem;
    },
  });

  return data ?? {};
}

/** Envia uma resposta na conversa de um feedback — usado pelo admin e por quem enviou o feedback. */
export function useSendFeedbackReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      feedbackId: string;
      authorRole: FeedbackReplyAuthorRole;
      authorName: string | null;
      message: string;
    }) => {
      const message = input.message.trim();
      if (!message) throw new Error("Escreva uma mensagem antes de enviar.");
      const { error } = await (supabase as any).from("feedback_replies" as any).insert({
        feedback_id: input.feedbackId,
        author_role: input.authorRole,
        author_name: input.authorName,
        message,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.feedback.replies(variables.feedbackId) });
      // O contador da lista é outra consulta: sem isto o cartão continuaria
      // dizendo "(1)" logo depois de a segunda resposta ser enviada.
      qc.invalidateQueries({ queryKey: [...queryKeys.feedback.all, "replyCounts"] });
    },
  });
}
