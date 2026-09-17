import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CadastroProgressivo } from "@/components/paciente/CadastroProgressivo";

/**
 * Primeira visita: uma tela de boas-vindas, depois o wizard de 6 passos.
 * Edição pelo perfil: /onboarding?editar=1 abre o wizard já preenchido.
 * Completar depois não bloqueia o app — o cartão no Hoje lembra.
 */
export default function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editar = params.get("editar") === "1";
  const [comecou, setComecou] = useState(editar);

  if (!comecou) {
    return (
      <div className="leitura-paciente min-h-screen flex flex-col bg-background">
        <header className="px-6 pt-6 pb-4 flex items-center gap-2.5">
          <img src="/logo-symbol.png" alt="Encorpei Cardio" width={36} height={36} className="object-contain shrink-0" style={{ width: 36, height: 36 }} />
          <div className="leading-tight">
            <div className="font-display text-base font-medium tracking-tight">Encorpei</div>
            <div className="text-sm text-primary font-semibold -mt-0.5">Cardio</div>
          </div>
        </header>
        <main className="flex-1 px-6 pb-8 flex flex-col items-center justify-center text-center">
          <div className="mx-auto h-32 w-32 rounded-full bg-primary/10 grid place-items-center">
            <HeartPulse className="h-14 w-14 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-foreground mt-8 leading-tight">
            Bem-vindo ao<br /><span className="text-primary">Encorpei Cardio</span>
          </h1>
          <p className="text-base text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
            Só algumas perguntas rápidas sobre sua saúde. Leva menos de 3 minutos.
          </p>
        </main>
        <div className="px-6 pb-8 pt-2 max-w-md mx-auto w-full space-y-3">
          <Button size="xl" className="w-full h-14 rounded-2xl text-base" onClick={() => setComecou(true)}>
            Começar
          </Button>
          <Button variant="ghost" className="w-full h-12 text-base" onClick={() => navigate("/hoje", { replace: true })}>
            Prefiro preencher depois
          </Button>
        </div>
      </div>
    );
  }

  return <CadastroProgressivo modo={editar ? "edicao" : "cadastro"} />;
}
