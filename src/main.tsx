import { createRoot } from "react-dom/client";
import { initSentry, initGlobalErrorCapture } from "@/lib/monitor";
import { trackDayReturn } from "@/lib/analytics";
import App from "./App.tsx";
import "./index.css";

// Ciclo de atualização: verificação periódica + faixa discreta.
// Antes: updateSW(true) recarregava a página sem avisar — um paciente
// preenchendo sintomas perderia o que digitou.

// Initialize Sentry (no-op if VITE_SENTRY_DSN not set)
initSentry();

// Initialize global error capture before React renders
initGlobalErrorCapture();

// Track daily return for retention metrics
trackDayReturn();

createRoot(document.getElementById("root")!).render(<App />);
