/**
 * Anexo dentro de um balão de mensagem (médico e paciente compartilham).
 * Imagem → miniatura clicável (abre em nova aba). PDF/documento → card com
 * ícone, nome, tamanho e "Visualizar". Recebe a URL já assinada (temporária)
 * gerada em usePatientMessages.
 */
import { FileText, ImageIcon, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MessageAttachmentData {
  url: string | null;
  name: string | null;
  type: string | null;
  size: number | null;
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MessageAttachment({ att, className }: { att: MessageAttachmentData; className?: string }) {
  const isImage = (att.type ?? "").startsWith("image/");
  if (!att.url) {
    // Anexo existe mas o link temporário ainda não resolveu (ou sem permissão).
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground", className)}>
        <ImageIcon className="h-4 w-4 shrink-0" /> {att.name ?? "Anexo"}
      </div>
    );
  }
  if (isImage) {
    return (
      <a href={att.url} target="_blank" rel="noopener noreferrer" className={cn("block overflow-hidden rounded-xl border border-border", className)}>
        <img src={att.url} alt={att.name ?? "Imagem"} className="max-h-56 w-auto max-w-full object-cover" loading="lazy" />
      </a>
    );
  }
  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 hover:border-border-strong transition-colors max-w-[280px]", className)}
    >
      <div className="h-9 w-9 rounded-lg bg-error-bg text-error grid place-items-center shrink-0">
        <FileText className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-foreground truncate">{att.name ?? "Documento"}</p>
        <p className="text-[10.5px] text-muted-foreground">{fmtSize(att.size)} · Visualizar</p>
      </div>
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
    </a>
  );
}
