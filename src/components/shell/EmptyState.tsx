import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "subtle" | "card";
  secondaryLabel?: string;
  onSecondary?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "default",
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 text-center",
        variant === "card" && "rounded-2xl border border-dashed border-border bg-card/50 py-12",
        variant === "subtle" && "py-10",
        variant === "default" && "py-16"
      )}
    >
      <div
        className={cn(
          "rounded-2xl p-5 mb-5",
          variant === "card" ? "bg-muted/40" : "bg-secondary"
        )}
      >
        <Icon className="h-7 w-7 text-muted-foreground" />
      </div>
      <h3 className="text-foreground font-semibold mb-1.5">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[280px] leading-relaxed">{description}</p>
      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        {actionLabel && onAction && (
          <Button className="touch-target rounded-xl" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button variant="outline" className="touch-target rounded-xl" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
