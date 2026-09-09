import { FileCheck2, Search, CheckCircle2, Heart, ArrowRight, Clock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tela de "cadastro em análise" do médico — redesenho de 26/08/2026 a
 * pedido explícito, com referência visual enviada pelo usuário (layout em
 * duas colunas igual ao ProAuthPage, com passo a passo do status).
 *
 * Ajuste de 26/08/2026 (2ª rodada): removido o seletor de tema/idioma
 * decorativo do canto superior direito (era só visual, sem funcionalidade
 * real — este projeto não tem modo escuro nem outro idioma implementados),
 * logo aumentada e todo o conteúdo do status escalado para cima a pedido
 * do usuário ("pode deixar tudo maior").
 */
export function ProPendingApprovalScreen({ onLogoClick, onSignOut }: {
  onLogoClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onSignOut: () => void;
}) {
  const steps = [
    {
      key: "recebido",
      icon: FileCheck2,
      label: "Recebemos seu cadastro",
      desc: "Obrigado por confiar em nosso trabalho.",
      state: "done" as const,
    },
    {
      key: "analise",
      icon: Search,
      label: "Em análise",
      desc: "Nossa equipe está verificando suas informações.",
      state: "active" as const,
    },
    {
      key: "liberado",
      icon: CheckCircle2,
      label: "Acesso liberado",
      desc: "Você será notificado por e-mail assim que seu acesso for liberado.",
      state: "upcoming" as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[48%_52%]">
      {/* Painel esquerdo — só desktop. Mesma foto/mensagem institucional do login. */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col p-10 xl:p-12">
        <img src="/medico-tablet.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/25" />

        <a href="/landing" onClick={onLogoClick} className="relative flex items-center gap-3 w-fit">
          <img src="/logo-symbol.png" alt="Encorpei Mamãe" width={60} height={60} className="object-contain shrink-0" style={{ width: 60, height: 60 }} />
          <div className="leading-tight">
            <div className="font-display text-2xl font-medium tracking-tight text-white">Encorpei</div>
            <div className="font-script text-xl text-white/90 -mt-0.5">Médico</div>
          </div>
        </a>

        <div className="relative flex-1 flex flex-col justify-center max-w-md mt-10">
          <h1 className="font-display text-4xl xl:text-[44px] font-medium text-white leading-[1.1] tracking-tight">
            Obrigado por fazer parte do <span className="font-script italic text-primary">Encorpei.</span>
          </h1>
          <p className="text-base text-white/85 mt-5 leading-relaxed max-w-sm">
            Estamos felizes em ter você conosco na missão de cuidar de vidas com excelência.
          </p>
        </div>

        <div className="relative flex items-start gap-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 max-w-sm">
          <div className="h-9 w-9 rounded-xl bg-white/15 grid place-items-center shrink-0">
            <ShieldCheck className="h-[18px] w-[18px] text-white" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white">Seguro e confidencial</p>
            <p className="text-[12px] text-white/75 mt-0.5 leading-snug">
              Seus dados e os de suas pacientes protegidos com segurança.
            </p>
          </div>
        </div>
      </aside>

      {/* Painel direito — status do cadastro */}
      <section className="flex flex-col px-6 py-10 md:px-12 min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-lg text-center">
            {/* Logo — só mobile (o painel esquerdo já mostra no desktop) */}
            <a href="/landing" onClick={onLogoClick} className="lg:hidden flex items-center gap-3 mb-10 justify-center w-fit mx-auto">
              <img src="/logo-symbol.png" alt="Encorpei Mamãe" width={56} height={56} className="object-contain shrink-0" style={{ width: 56, height: 56 }} />
              <div className="leading-tight">
                <div className="font-display text-xl font-medium tracking-tight">Encorpei</div>
                <div className="font-script text-lg text-primary -mt-0.5">Médico</div>
              </div>
            </a>

            <div className="h-20 w-20 rounded-full bg-amber-100 grid place-items-center mx-auto mb-6">
              <Clock className="h-9 w-9 text-amber-700" strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-3xl sm:text-[34px] font-medium tracking-tight text-foreground">Cadastro em análise.</h2>
            <p className="text-base text-muted-foreground mt-3.5 leading-relaxed max-w-md mx-auto">
              Nossa equipe está avaliando seu cadastro com atenção e carinho. Você recebe acesso ao painel assim que ele for aprovado.
            </p>

            {/* Passo a passo do status */}
            <div className="grid grid-cols-3 gap-1 mt-11">
              {steps.map((step, i) => (
                <div key={step.key} className="flex flex-col items-center">
                  <div className="flex items-center w-full">
                    <div className={cn("flex-1 border-t-2 border-dashed", i === 0 ? "border-transparent" : "border-border")} />
                    <div
                      className={cn(
                        "h-12 w-12 sm:h-14 sm:w-14 rounded-full grid place-items-center shrink-0 mx-1",
                        step.state === "active" && "bg-amber-100 text-amber-700",
                        step.state !== "active" && "bg-primary/10 text-primary/70",
                      )}
                    >
                      <step.icon className="h-[22px] w-[22px] sm:h-6 sm:w-6" strokeWidth={1.75} />
                    </div>
                    <div className={cn("flex-1 border-t-2 border-dashed", i === steps.length - 1 ? "border-transparent" : "border-border")} />
                  </div>
                  <p className={cn("text-xs sm:text-sm font-semibold mt-2.5 px-0.5 leading-tight", step.state === "active" ? "text-primary" : "text-foreground")}>
                    {step.label}
                  </p>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 leading-snug px-1">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-9 rounded-2xl bg-primary/5 border border-primary/10 p-5 flex items-start gap-3.5 text-left">
              <Heart className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
              <p className="text-sm text-foreground/80 leading-relaxed">
                Enquanto isso, fique à vontade para conhecer mais sobre o Encorpei e nossas soluções para você e suas pacientes.
              </p>
            </div>

            <Button variant="outline" size="lg" onClick={onSignOut} className="mt-9 rounded-full gap-2">
              <ArrowRight className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
