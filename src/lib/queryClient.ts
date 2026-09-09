import { QueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/errorHandler";

/**
 * Production-ready QueryClient — optimized for 5,000+ concurrent users.
 *
 * Key decisions:
 * - staleTime 5 min: health data changes infrequently within a session (up from 2min)
 * - gcTime 15 min: keeps inactive cache warm for back-navigation (up from 10min)
 * - retry 1: single retry on transient failures; fast fail otherwise
 * - refetchOnWindowFocus false: prevents jarring data flickers on tab switch
 * - refetchOnReconnect true: fresh data after connectivity loss
 * - Global mutation onError: classifies and toasts errors consistently
 *
 * Scalability notes:
 * - At 5k users, even with staleTime=5min, background refetches are minimized
 * - Dashboard now delegates to a single Edge Function instead of 12 separate queries
 * - Analytics events are batched (see analytics.ts) — no per-pageview INSERT
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes — reduced refetch frequency
      gcTime: 1000 * 60 * 15,        // 15 minutes — keep cache warm
      retry: 1,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      throwOnError: false,
    },
    mutations: {
      retry: 0,
      onError: (error) => toastError(error),
    },
  },
});
