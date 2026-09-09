import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="space-y-2">
          <p className="text-8xl font-mono font-extrabold text-muted-foreground select-none">404</p>
          <div className="w-16 h-1 bg-primary rounded-full mx-auto" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Página não encontrada</h1>
          <p className="text-sm text-muted-foreground">
            A página{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
              {location.pathname}
            </code>{" "}
            não existe ou foi movida.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <Button className="flex-1 rounded-xl gap-2" onClick={() => navigate("/hoje")}>
            <Home className="w-4 h-4" /> Hoje
          </Button>
        </div>

        <button
          onClick={() => navigate("/landing")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Voltar para a página inicial
        </button>
      </div>
    </div>
  );
}
