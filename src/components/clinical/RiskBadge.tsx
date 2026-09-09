/**
 * Badge de semáforo de risco com cor e motivo.
 *
 * Uso:
 *   <RiskBadge level="red" reason="PA 148/92" />
 *   <RiskBadge level="green" />
 */

import { ShieldAlert, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RISK_LABEL } from "@/lib/clinical/cardioRiskEngine";
import type { RiskLevel } from "@/types/cardio";

const RISK_LABELS = RISK_LABEL;
const RISK_COLORS: Record<RiskLevel, { text: string; bg: string; border: string; dot: string }> = {
  red:    { text: "text-error",   bg: "bg-error/10",   border: "border-error/30",   dot: "bg-error" },
  yellow: { text: "text-warning", bg: "bg-warning/10", border: "border-warning/30", dot: "bg-warning" },
  green:  { text: "text-success", bg: "bg-success/10", border: "border-success/30", dot: "bg-success" },
};

interface Props {
  level: RiskLevel;
  reason?: string;
  /** Mostrar dot animado para red */
  pulse?: boolean;
  /** Modo compacto: só dot + label */
  compact?: boolean;
  className?: string;
}

const ICONS = {
  red: ShieldAlert,
  yellow: AlertTriangle,
  green: CheckCircle2,
};

export function RiskBadge({ level, reason, pulse, compact, className }: Props) {
  const Icon = ICONS[level];
  const colors = RISK_COLORS[level];
  const label = RISK_LABELS[level];

  if (compact) {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold", colors.text, className)}
        title={reason ?? label}
      >
        <span className={cn("h-2 w-2 rounded-full", colors.dot, pulse && level === "red" && "animate-pulse")} />
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full",
        colors.bg, colors.text, colors.border, "border",
        className,
      )}
      title={reason}
    >
      <Icon className="h-3 w-3" />
      {label}
      {reason && (
        <span className="font-normal opacity-80 truncate max-w-[200px]">
          — {reason}
        </span>
      )}
    </span>
  );
}
