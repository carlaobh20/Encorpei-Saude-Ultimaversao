import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WrongPortalBlockProps {
  message: string;
  correctPortalLabel: string;
  correctPortalHref: string;
  onSignOut: () => void;
}

/**
 * Tela de bloqueio quando uma sessão autenticada (e-mail/senha corretos)
 * pertence ao papel errado para o portal em que está — ex.: conta de
 * médico tentando acessar o app da mamãe, ou vice-versa. Usada como defesa
 * em profundidade nos route guards (ProtectedRoute / ProProtectedRoute),
 * caso alguma sessão já autenticada chegue até aqui mesmo com o bloqueio
 * feito na tela de login (auditoria 26/08/2026).
 */
export function WrongPortalBlock({ message, correctPortalLabel, correctPortalHref, onSignOut }: WrongPortalBlockProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
      <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
        <ShieldAlert className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1 max-w-[320px]">
        <p className="text-sm font-semibold text-foreground">Portal errado para esta conta</p>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onSignOut}>Sair</Button>
        <Button size="sm" onClick={() => { window.location.href = correctPortalHref; }}>
          Ir para {correctPortalLabel}
        </Button>
      </div>
    </div>
  );
}
