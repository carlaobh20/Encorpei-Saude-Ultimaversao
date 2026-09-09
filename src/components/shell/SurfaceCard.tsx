import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Variant = "default" | "elevated" | "interactive" | "brand" | "warm" | "highlight" | "stat";

interface SurfaceCardProps {
  variant?: Variant;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}

const variantStyles: Record<Variant, string> = {
  default: "bg-card border border-border shadow-sm",
  elevated: "bg-card shadow-md",
  interactive: "bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer",
  brand: "gradient-brand text-primary-foreground border-0 shadow-md",
  warm: "gradient-warm text-primary-foreground border-0 shadow-md",
  highlight: "bg-primary/5 border border-primary/20",
  stat: "bg-card border border-border shadow-sm",
};

export function SurfaceCard({ variant = "default", className, children, onClick, ariaLabel }: SurfaceCardProps) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      className={cn("rounded-2xl p-4 md:p-5", variantStyles[variant], className)}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Comp>
  );
}
