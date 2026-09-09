import { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Modal padrao do app - pequeno e centralizado na tela.
 * Substitui os antigos bottom sheets de largura total nos formularios,
 * para uma experiencia consistente em todas as telas (mobile e desktop).
 */
export function AppModal({ open, onOpenChange, title, children, className }: AppModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "w-[calc(100vw-2rem)] sm:max-w-md rounded-3xl max-h-[85vh] overflow-y-auto",
          className
        )}
      >
        <DialogHeader className="pb-2 text-left">
          <DialogTitle className="font-display text-xl font-medium tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

