import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; positive?: boolean };
  className?: string;
  iconColor?: string;
}

export function StatCard({ label, value, icon: Icon, trend, className, iconColor }: StatCardProps) {
  return (
    <div className={cn("surface-card rounded-2xl p-4 md:p-5", className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p className={cn(
              "text-xs font-medium mt-1",
              trend.positive ? "text-success" : "text-error"
            )}>
              {trend.positive ? "+" : ""}{trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: iconColor ? `${iconColor}15` : "hsl(var(--primary) / 0.08)" }}
          >
            <Icon
              className="h-5 w-5"
              style={{ color: iconColor || "hsl(var(--primary))" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
