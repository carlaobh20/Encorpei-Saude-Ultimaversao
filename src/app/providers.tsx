import { type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { DemoProvider } from "@/contexts/DemoContext";
import { queryClient } from "@/lib/queryClient";
import { isProd } from "@/lib/config";

/**
 * Global providers — wraps the entire app.
 * Order matters: Theme > Demo > Query > Tooltip > Toasters.
 *
 * <Analytics /> é o Vercel Web Analytics: não precisa de chave nem DSN.
 * Ele só coleta quando o app está servido pela Vercel COM o Web Analytics
 * habilitado no painel do projeto. Fora disso é inerte — não quebra o build,
 * não quebra o dev local e não envia nada.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <DemoProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {children}
            {isProd && <Analytics />}
          </TooltipProvider>
        </QueryClientProvider>
      </DemoProvider>
    </ThemeProvider>
  );
}
