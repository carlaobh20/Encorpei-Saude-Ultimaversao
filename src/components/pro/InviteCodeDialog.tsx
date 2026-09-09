/**
 * Diálogo do médico para gerar código de convite da paciente.
 * Gera um convite em branco (pending). O paciente digita o código no
 * app dela para ativar o vínculo.
 *
 * 27/08/2026 (pedido do Dr. Carlos): assim que um código existe — recém
 * gerado ou reaberto da lista de pendentes — o diálogo troca para a
 * experiência completa de compartilhamento (InvitePatientShareExperience):
 * código, link, mensagem pronta pro WhatsApp e como instalar o app.
 */
import { useState } from "react";
import { useInviteCode } from "@/hooks/useInviteCode";
import { useProfessionalProfile } from "@/hooks/useProfessional";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { classifyError } from "@/lib/errorHandler";
import { trackEvent } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Copy, Check, Trash2, Ticket, Share2 } from "lucide-react";

export function InviteCodeDialog() {
  const { pendingInvites, generateInvite, revokeInvite } = useInviteCode();
  const { profile } = useProfessionalProfile();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Código atualmente aberto na experiência de compartilhamento — null
  // volta pra tela de "gerar/lista de códigos pendentes".
  const [shareCode, setShareCode] = useState<string | null>(null);

  const generate = async () => {
    try {
      const res = await generateInvite.mutateAsync();
      if (res?.invite_code) {
        trackEvent("invite_generated");
        setShareCode(res.invite_code);
      }
    } catch (e) {
      // useInviteCode já mostra um toast (sonner) quando falta o perfil
      // profissional — não duplicar o aviso aqui.
      const message = e instanceof Error ? e.message : String(e);
      if (message === "missing_professional_profile") return;
      // Reaproveita a classificação de erro já usada no resto do app (rede,
      // sessão expirada, etc.) em vez de jogar a mensagem crua do Supabase.
      const { userMessage } = classifyError(e);
      toast({ title: "Não foi possível gerar o código", description: userMessage, variant: "destructive" });
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard pode falhar sem https */ }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShareCode(null); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Convidar paciente
        </Button>
      </DialogTrigger>
      <DialogContent className={shareCode ? "sm:max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{shareCode ? "Convidar paciente — Compartilhar acesso" : "Convidar paciente"}</DialogTitle>
          <DialogDescription>
            {shareCode
              ? "Envie este código ao paciente. Ele digita no app para se vincular a você."
              : "Gere um código e envie ao paciente. Ele digita o código no app dele para vincular."}
          </DialogDescription>
        </DialogHeader>

        {shareCode ? (
          <div className="py-4 space-y-4 text-center">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Código do convite</div>
            <div className="font-display text-4xl font-semibold tracking-[0.2em] text-cardio-dark">{shareCode}</div>
            <p className="text-sm text-muted-foreground">
              O paciente baixa o Encorpei Cardio, cria a conta dele e digita este código em
              “Tenho um código do meu médico”.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  navigator.clipboard?.writeText(shareCode);
                  sonnerToast.success("Código copiado.");
                }}
              >
                Copiar código
              </Button>
              <Button variant="ghost" className="flex-1" onClick={() => setShareCode(null)}>
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-2 space-y-4">
            <Button onClick={generate} disabled={generateInvite.isPending} className="w-full gap-2">
              <Ticket className="h-4 w-4" />
              {generateInvite.isPending ? "Gerando..." : "Gerar novo código"}
            </Button>

            {pendingInvites.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Códigos aguardando uso</p>
                <div className="space-y-1.5">
                  {pendingInvites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
                      <span className="font-mono font-bold tracking-widest text-foreground">{inv.invite_code}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="sm" className="gap-1 text-xs"
                          onClick={() => inv.invite_code && setShareCode(inv.invite_code)}
                        >
                          <Share2 className="h-3.5 w-3.5" /> Compartilhar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => inv.invite_code && copy(inv.invite_code)}>
                          {copied === inv.invite_code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                          onClick={() => revokeInvite.mutate(inv.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
