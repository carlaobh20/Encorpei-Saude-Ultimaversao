/**
 * Indicador de status de validação de um dado clínico.
 *
 * Uso: <ValidationIndicator status="validated" />
 *      <ValidationIndicator status="suspect" compact />
 */

import { CheckCircle2, AlertTriangle, Clock, XCircle } from "lucide-react";
import type { ValidationStatus } from "@/types/cardio";

interface Props {
  status: ValidationStatus;
  /** Modo compacto: só ícone, sem texto */
  compact?: boolean;
  /** Exibir nome de quem validou */
  validatedBy?: string;
  className?: string;
}

const STATUS_CONFIG: Record<ValidationStatus, {
  label: string;
  icon: typeof CheckCircle2;
  className: string;
}> = {
  estimated: {
    label: "Estimativa — não usar para decisão clínica",
    icon: AlertTriangle,
    className: "text-warning bg-warning/10",
  },
  validated: {
    label: "Validado",
    icon: CheckCircle2,
    className: "text-success",
  },
  suspect: {
    label: "Suspeito",
    icon: AlertTriangle,
    className: "text-warning",
  },
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "text-info",
  },
  rejected: {
    label: "Rejeitado",
    icon: XCircle,
    className: "text-error",
  },
};

export function ValidationIndicator({ status, compact, validatedBy, className = "" }: Props) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <Icon
        className={`h-3.5 w-3.5 ${config.className} ${className}`}
        aria-label={`${config.label}${validatedBy ? ` por ${validatedBy}` : ""}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium ${config.className} ${className}`}
      title={validatedBy ? `Validado por ${validatedBy}` : undefined}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
