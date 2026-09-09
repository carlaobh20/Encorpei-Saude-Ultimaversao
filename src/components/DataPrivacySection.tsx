/**
 * Seção "Privacidade e dados" da conta do paciente.
 * Entrega os direitos do titular (LGPD art. 18):
 *   - Exportar meus dados (JSON)
 *   - Excluir minha conta (hard-delete com confirmação dupla)
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { exportData, deleteAccountData } from "@/lib/dataPrivacy";

const CONFIRM_WORD = "APAGAR";

export function DataPrivacySection() {
  const { user, signOut } = useAuth() as any;
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    if (!user?.id) return;
    setExporting(true);
    try {
      await exportData(user.id);
      toast.success("Seus dados foram exportados");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível exportar agora");
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.id) return;
    setDeleting(true);
    try {
      const { failed } = await deleteAccountData(user.id);
      if (failed.length > 0) {
        toast.error("Alguns dados não puderam ser removidos. Tente novamente ou fale com o suporte.");
        setDeleting(false);
        return;
      }
      toast.success("Seus dados foram apagados em definitivo");
      await signOut?.();
      navigate("/landing");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível excluir agora");
      setDeleting(false);
    }
  };

  return (
    <section id="privacidade" className="rounded-3xl bg-card border border-border shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.75} />
        <h3 className="font-display text-lg font-medium text-foreground tracking-tight">
          Privacidade e dados
        </h3>
      </div>
      <p className="text-[11.5px] text-muted-foreground mb-4">
        Você é dona dos seus dados. A qualquer momento pode baixar uma cópia ou apagar tudo em definitivo.
      </p>

      <div className="space-y-2.5">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full rounded-2xl bg-card border border-border shadow-card p-4 flex items-center gap-3.5 hover:border-border-strong transition-colors text-left disabled:opacity-60"
        >
          <div className="h-10 w-10 rounded-2xl bg-cardio-50 grid place-items-center text-primary shrink-0">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={1.75} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Exportar meus dados</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Baixa um arquivo com tudo que guardamos sobre você</p>
          </div>
        </button>

        <button
          onClick={() => { setConfirmText(""); setDeleteOpen(true); }}
          className="w-full rounded-2xl bg-card border border-error/30 shadow-card p-4 flex items-center gap-3.5 hover:bg-error-bg transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-2xl bg-error-bg grid place-items-center text-error shrink-0">
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-error">Excluir minha conta</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">Apaga todos os seus dados em definitivo</p>
          </div>
        </button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-medium tracking-tight">
              Apagar sua conta em definitivo?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Isso remove para sempre todos os seus registros: gestação, sintomas, exames,
              diário e tudo mais. <strong className="text-foreground">Não há como desfazer.</strong>
              <br /><br />
              Para confirmar, digite <strong className="text-error">{CONFIRM_WORD}</strong> abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_WORD}
            className="h-11 rounded-2xl"
            autoFocus
          />

          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl" disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={confirmText.trim() !== CONFIRM_WORD || deleting}
              className="rounded-2xl bg-error hover:bg-error/90 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apagar tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
