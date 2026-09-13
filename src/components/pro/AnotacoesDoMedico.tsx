/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ANOTAÇÕES DO MÉDICO — `professional_notes`, enfim ligada ao app.
 *
 * A tabela existe desde a migração inicial, com RLS e dois índices, e tinha
 * ZERO ocorrências no código. A aba "Anotações" guardava as notas num
 * `useState`: sumiam ao trocar de paciente, ao recarregar, ao fechar a aba —
 * e o próprio toast admitia isso. Evolução clínica escrita e perdida é pior
 * que evolução não escrita, porque o médico acredita que registrou.
 *
 * ── A política, conferida antes de construir ────────────────────────────
 *   create policy notes_professional on public.professional_notes for all
 *     using (public.owns_professional_profile(professional_id, auth.uid()))
 *     with check (...)
 *
 * Consequências que a interface RESPEITA em vez de contornar:
 *   1. o paciente NÃO tem política de leitura: não vê, não pode ver, e nada
 *      nesta tela sugere ao médico que ele veja — é anotação privada mesmo;
 *   2. a política é por DONO DO PERFIL, não por vínculo: cada médico lê e
 *      edita só as SUAS notas. Num serviço com dois médicos, um não enxerga a
 *      anotação do outro. Isso não é contornável do cliente e o subtítulo diz
 *      a verdade sobre o alcance;
 *   3. sem `professional_id` não há escrita possível — se o perfil ainda não
 *      carregou ou não existe, o formulário fica desabilitado dizendo por quê,
 *      em vez de gravar NULL e quebrar no banco.
 *
 * A tabela não tem `updated_at`: uma edição reescreve o corpo sem deixar
 * marca de quando. O rótulo mostra a data de CRIAÇÃO e não afirma nada sobre
 * a última alteração.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { StickyNote, Pencil } from "lucide-react";
import { toast } from "sonner";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getDevBypass } from "@/contexts/DevBypass";
import { toastError } from "@/lib/errorHandler";

interface Nota {
  id: string;
  body: string;
  created_at: string;
}

const chaveNotas = (patientId: string, professionalId: string) =>
  ["professional_notes", patientId, professionalId] as const;

function fmtDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const DEMO_NOTAS: Nota[] = [
  {
    id: "demo-nota-1",
    body: "Titulação de BRA em curso. PA domiciliar ainda acima do alvo; adesão marcada em 86% nos últimos 14 dias. Reavaliar K+ e creatinina antes de subir de novo.",
    created_at: new Date(Date.now() - 9 * 86_400_000).toISOString(),
  },
];

export function AnotacoesDoMedico({
  patientUserId,
  professionalId,
  autor,
}: {
  patientUserId: string;
  professionalId?: string | null;
  /** Só para o rodapé da nota. A autoria real é o `professional_id` da linha. */
  autor?: string | null;
}) {
  const qc = useQueryClient();
  const demo = !!getDevBypass();
  const [rascunho, setRascunho] = useState("");
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [notasDemo, setNotasDemo] = useState<Nota[]>(DEMO_NOTAS);

  const podeEscrever = demo || !!professionalId;

  const notas = useQuery({
    queryKey: chaveNotas(patientUserId, professionalId ?? "demo"),
    enabled: !!patientUserId && (demo || !!professionalId),
    staleTime: 30_000,
    queryFn: async (): Promise<Nota[]> => {
      if (demo) return notasDemo;
      const { data, error } = await (supabase as any)
        .from("professional_notes")
        .select("id, body, created_at")
        .eq("patient_user_id", patientUserId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Nota[];
    },
  });

  const criar = useMutation({
    mutationFn: async (body: string) => {
      if (demo) {
        setNotasDemo((prev) => [{ id: crypto.randomUUID(), body, created_at: new Date().toISOString() }, ...prev]);
        toast.info("Modo demo: a anotação fica só nesta sessão.");
        return;
      }
      const { data, error } = await (supabase as any)
        .from("professional_notes")
        .insert({ professional_id: professionalId, patient_user_id: patientUserId, body })
        .select("id");
      if (error) throw error;
      // Zero linha sem erro é a assinatura de uma negativa de RLS. Aqui isso
      // significaria o médico digitar a evolução, ver "salvo" e não ter nada.
      if (!data || data.length === 0) {
        throw new Error("A anotação não foi gravada (perfil profissional não confere).");
      }
    },
    onSuccess: () => {
      setRascunho("");
      qc.invalidateQueries({ queryKey: ["professional_notes"] });
      if (!demo) toast.success("Anotação salva.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui salvar a anotação."),
  });

  const editar = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      if (demo) {
        setNotasDemo((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)));
        toast.info("Modo demo: a alteração fica só nesta sessão.");
        return;
      }
      const { data, error } = await (supabase as any)
        .from("professional_notes")
        .update({ body })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("A alteração não foi gravada (a anotação é de outro profissional?).");
      }
    },
    onSuccess: () => {
      setEditando(null);
      qc.invalidateQueries({ queryKey: ["professional_notes"] });
      if (!demo) toast.success("Anotação atualizada.");
    },
    onError: (e: unknown) => toastError(e, "Não consegui atualizar a anotação."),
  });

  const lista = demo ? notasDemo : (notas.data ?? []);

  return (
    <SurfaceCard>
      <SectionHeader
        title="Anotações do médico"
        icon={StickyNote}
        subtitle="privadas — o paciente não tem leitura nesta tabela; outros profissionais do serviço também não veem as suas"
      />

      {!podeEscrever ? (
        <p className="text-xs text-warning mb-3">
          Sem perfil profissional carregado não é possível gravar anotação — a política do banco exige o vínculo do perfil.
        </p>
      ) : null}

      <Textarea
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        placeholder="Anotação sobre a evolução, conduta, pendências…"
        className="min-h-[70px] mb-2"
        disabled={!podeEscrever}
      />
      <Button
        size="sm"
        disabled={!rascunho.trim() || !podeEscrever || criar.isPending}
        onClick={() => criar.mutate(rascunho.trim())}
      >
        {criar.isPending ? "Salvando…" : "Salvar anotação"}
      </Button>

      <div className="mt-5 space-y-2.5">
        {notas.isLoading && !demo ? (
          <p className="text-xs text-muted-foreground">Carregando anotações…</p>
        ) : lista.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma anotação para este paciente.</p>
        ) : (
          lista.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-background p-3">
              {editando?.id === n.id ? (
                <>
                  <Textarea
                    value={editando.texto}
                    onChange={(e) => setEditando({ id: n.id, texto: e.target.value })}
                    className="min-h-[70px] mb-2"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={!editando.texto.trim() || editar.isPending}
                      onClick={() => editar.mutate({ id: n.id, body: editando.texto.trim() })}
                    >
                      {editar.isPending ? "Salvando…" : "Salvar alteração"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{n.body}</p>
                  <div className="flex items-center justify-between gap-3 mt-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      {fmtDataHora(n.created_at)} · {autor ?? "você"}
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-primary inline-flex items-center gap-1"
                      onClick={() => setEditando({ id: n.id, texto: n.body })}
                    >
                      <Pencil className="h-3 w-3" aria-hidden /> Editar
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </SurfaceCard>
  );
}
