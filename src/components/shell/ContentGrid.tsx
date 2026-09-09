import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ContentGridProps {
  columns?: 1 | 2 | 3 | 4;
  className?: string;
  children: ReactNode;
}

const colClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function ContentGrid({ columns = 2, className, children }: ContentGridProps) {
  return (
    <div className={cn("grid gap-4", colClasses[columns], className)}>
      {children}
    </div>
  );
}
