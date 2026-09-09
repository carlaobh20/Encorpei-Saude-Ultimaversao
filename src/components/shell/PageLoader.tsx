import { Skeleton } from "@/components/ui/skeleton";

/** Full-page loading fallback used by React.lazy Suspense boundaries */
export function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-6 min-h-[60vh]">
      <div className="h-11 w-11 rounded-2xl gradient-brand opacity-80 animate-pulse" />
      <div className="space-y-2.5 w-full max-w-[200px]">
        <Skeleton className="h-4 w-4/5 mx-auto rounded-lg" />
        <Skeleton className="h-3 w-3/5 mx-auto rounded-lg" />
      </div>
    </div>
  );
}
