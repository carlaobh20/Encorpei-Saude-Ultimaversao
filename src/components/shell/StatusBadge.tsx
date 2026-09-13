import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type StatusVariant = "normal" | "pendente" | "concluido" | "atencao" | "urgencia" | "informativo";

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<StatusVariant, string> = {
  normal: "bg-muted text-muted-foreground",
  pendente: "bg-warning-bg text-warning",
  concluido: "bg-success-bg text-success",
  atencao: "bg-warning-bg text-warning",
  urgencia: "bg-error-bg text-error",
  informativo: "bg-info-bg text-info",
};

/**
 * O pontinho vai na cor SÓLIDA do estado, nunca no token `-bg`: o fundo do
 * selo já é o `-bg`, e um ponto da mesma cor do fundo é um ponto invisível.
 */
const dotColors: Record<StatusVariant, string> = {
  normal: "bg-muted-foreground",
  pendente: "bg-warning",
  concluido: "bg-success",
  atencao: "bg-warning",
  urgencia: "bg-error",
  informativo: "bg-info",
};

export function StatusBadge({ variant = "normal", children, className, dot = true }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotColors[variant])} />}
      {children}
    </span>
  );
}
