import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { useSalvarCardioPatient } from "@/hooks/useCardioPatient";
import { useProfile } from "@/hooks/useProfile";
import { useWeight } from "@/hooks/useCardioReadings";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronRight, ChevronLeft, Loader2, Check, KeyRound, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CardioComorbidities, CardioHistory, SmokingStatus } from "@/types/cardio";

type Step = "welcome" | "identificacao" | "medidas" | "habitos" | "comorbidades" | "historico" | "familia" | "medico";
const STEPS: Step[] = ["welcome", "identificacao", "medidas", "habitos", "comorbidades", "historico", "familia", "medico"];

/** Linha de alternância "sim/não" em lista — sem componente Switch no design system. */
function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      className={cn(
        "w-full flex items-center justify-between gap-4 rounded-2xl border-2 p-4 text-left transition-colors",
        checked ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border-strong",
      )}
    >
      <span>
        <span className={cn("block text-base font-medium leading-snug", checked ? "text-primary" : "text-foreground")}>{label}</span>
        {hint && <span className="block text-sm text-muted-foreground mt-0.5 leading-relaxed">{hint}</span>}
      </span>
      <span
        className={cn(
          "shrink-0 h-7 w-12 rounded-full transition-colors relative",
          checked ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

function StepShell({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
      <h2 className="font-display text-3xl font-medium tracking-tight text-foreground leading-tight">{title}</h2>
      {children}
    </div>
  );
}

/**
 * Onboarding do PACIENTE cardiológico — um assunto por tela, passos curtos
 * (público-alvo 60–75 anos). Coleta o essencial de anamnese descrito em
 * docs/MAPEAMENTO-CARDIO.md §2.1. Linguagem sempre leiga, termo técnico
 * entre parênteses quando ajuda.
 */
export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { updateProfile } = useProfile();
  const salvarPaciente = useSalvarCardioPatient();
  const { registrar: registrarPeso } = useWeight();
  const { acceptInvite } = useMyProfessionals();

  const [step, setStep] = useState<Step>("welcome");
  const [saving, setSaving] = useState(false);

  // Identificação
  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState<"male" | "female" | "">("");

  // Medidas
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");

  // Hábitos
  const [tabagismo, setTabagismo] = useState<SmokingStatus | "">("");
  const [alcool, setAlcool] = useState("");

  // Comorbidades
  const [comorbidities, setComorbidities] = useState<CardioComorbidities>({});

  // História cardíaca
  const [history, setHistory] = useState<CardioHistory>({});
  const [alergias, setAlergias] = useState("");

  // Convite do médico
  const [quisCodigo, setQuisCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");

  const stepIndex = STEPS.indexOf(step);
  const progress = (stepIndex / (STEPS.length - 1)) * 100;

  const canNext = () => {
    if (step === "identificacao") return nome.trim().length >= 2 && nascimento.length === 10 && sexo !== "";
    return true;
  };

  const next = () => { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) setStep(STEPS[i + 1]); };
  const back = () => { const i = STEPS.indexOf(step); if (i > 0) setStep(STEPS[i - 1]); };

  const toggleComorbid = (key: keyof CardioComorbidities) =>
    setComorbidities((c) => ({ ...c, [key]: !c[key] }));

  const toggleHistory = (key: keyof CardioHistory) =>
    setHistory((h) => ({ ...h, [key]: !h[key] }));

  const handleFinish = async () => {
    setSaving(true);
    try {
      if (getDevBypass()) {
        toast.success("Bem-vindo, " + (nome.split(" ")[0] || "por aqui") + ".");
        navigate("/hoje", { replace: true });
        return;
      }

      await salvarPaciente.mutateAsync({
        full_name: nome.trim(),
        birth_date: nascimento || null,
        sex: sexo || null,
        height_cm: altura ? Number(altura) : null,
        smoking_status: tabagismo || null,
        alcohol_units_week: alcool ? Number(alcool) : null,
        comorbidities,
        history,
        allergies: alergias.trim() || null,
      });

      await updateProfile.mutateAsync({
        full_name: nome.trim(),
        birth_date: nascimento || null,
        sex: sexo || null,
        height_cm: altura ? Number(altura) : null,
        onboarding_completed: true,
      });

      if (peso) {
        try {
          await registrarPeso.mutateAsync({ value: Number(peso) });
        } catch {
          // peso é complementar — não trava o fim do cadastro
        }
      }

      if (quisCodigo && codigo.trim().length >= 4) {
        try {
          await acceptInvite.mutateAsync(codigo.trim().toUpperCase());
        } catch {
          toast.info("Não consegui vincular ao médico agora — você pode tentar de novo em Minha conta.");
        }
      }

      toast.success("Cadastro pronto, " + (nome.split(" ")[0] || "") + "!");
      navigate("/hoje", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar seu cadastro agora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // `leitura-paciente` (index.css): o onboarding roda fora do AppShell e
    // ficava com a escala menor do app — justamente no formulário mais longo
    // que o paciente preenche, e no primeiro contato dele com o produto.
    // A classe sobe o piso de texto e de alvo de toque; nenhuma pergunta,
    // nenhum passo e nenhum texto mudou.
    <div className="leitura-paciente min-h-screen flex flex-col bg-background">

      {/* Topo */}
      <header className="px-6 pt-6 pb-4 flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <img src="/logo-symbol.png" alt="Encorpei Cardio" width={36} height={36} className="object-contain shrink-0" style={{ width: 36, height: 36 }} />
          <div className="leading-tight">
            <div className="font-display text-base font-medium tracking-tight">Encorpei</div>
            <div className="text-sm text-primary font-semibold -mt-0.5">Cardio</div>
          </div>
        </div>
        <div className="ml-auto text-sm text-muted-foreground tabular-nums" aria-label={`Passo ${stepIndex + 1} de ${STEPS.length}`}>
          {stepIndex + 1} / {STEPS.length}
        </div>
      </header>

      {/* Progresso */}
      <div className="px-6 mb-6">
        <div
          className="h-2 bg-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-label={`Passo ${stepIndex + 1} de ${STEPS.length}`}
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Conteúdo do passo */}
      <main className="flex-1 px-6 pb-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >

              {step === "welcome" && (
                <div className="text-center pt-6">
                  <div className="mx-auto h-32 w-32 rounded-full bg-primary/10 grid place-items-center">
                    <HeartPulse className="h-14 w-14 text-primary" strokeWidth={1.5} />
                  </div>
                  <h2 className="font-display text-3xl font-medium tracking-tight text-foreground mt-8 leading-tight">
                    Bem-vindo ao<br /><span className="text-primary">Encorpei Cardio</span>
                  </h2>
                  <p className="text-base text-muted-foreground mt-3 max-w-sm mx-auto leading-relaxed">
                    Só algumas perguntas rápidas sobre sua saúde. Leva menos de 3 minutos.
                  </p>
                </div>
              )}

              {step === "identificacao" && (
                <StepShell eyebrow="Identificação" title={<>Seus <span className="text-primary">dados</span></>}>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base text-foreground">Nome completo</Label>
                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="mt-1.5 h-14 rounded-2xl text-base" autoFocus />
                    </div>
                    <div>
                      <Label className="text-base text-foreground">Data de nascimento</Label>
                      <Input value={nascimento} onChange={(e) => setNascimento(e.target.value)} type="date" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                    <div>
                      <Label className="text-base text-foreground">Sexo biológico</Label>
                      <p className="text-sm text-muted-foreground mb-1.5 leading-relaxed">Usado para calcular seu risco cardiovascular.</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([{ value: "male" as const, label: "Masculino" }, { value: "female" as const, label: "Feminino" }]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSexo(opt.value)}
                            className={cn(
                              "h-14 rounded-2xl border-2 text-base font-semibold transition-colors",
                              sexo === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border-strong",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </StepShell>
              )}

              {step === "medidas" && (
                <StepShell eyebrow="Medidas" title={<>Altura e <span className="text-primary">peso</span></>}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-base text-foreground">Altura (cm)</Label>
                      <Input value={altura} onChange={(e) => setAltura(e.target.value)} type="number" inputMode="numeric" placeholder="Ex: 170" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                    <div>
                      <Label className="text-base text-foreground">Peso atual (kg)</Label>
                      <Input value={peso} onChange={(e) => setPeso(e.target.value)} type="number" inputMode="decimal" placeholder="Ex: 78" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">Pode deixar em branco e preencher depois, sem problema.</p>
                </StepShell>
              )}

              {step === "habitos" && (
                <StepShell eyebrow="Hábitos" title={<>Fumo e <span className="text-primary">álcool</span></>}>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base text-foreground">Fumo</Label>
                      <div className="grid grid-cols-3 gap-2 mt-1.5">
                        {([
                          { value: "never" as const, label: "Nunca fumei" },
                          { value: "former" as const, label: "Já fumei, parei" },
                          { value: "current" as const, label: "Fumo hoje" },
                        ]).map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setTabagismo(opt.value)}
                            className={cn(
                              "h-16 rounded-2xl border-2 text-sm font-semibold px-2 transition-colors",
                              tabagismo === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border-strong",
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-base text-foreground">Quantas doses de bebida alcoólica por semana, em média?</Label>
                      <Input value={alcool} onChange={(e) => setAlcool(e.target.value)} type="number" inputMode="numeric" placeholder="Ex: 0" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                  </div>
                </StepShell>
              )}

              {step === "comorbidades" && (
                <StepShell eyebrow="Saúde" title={<>Você tem alguma <span className="text-primary">dessas condições?</span></>}>
                  <div className="space-y-2.5">
                    <ToggleRow label="Pressão alta" hint="(hipertensão)" checked={!!comorbidities.hypertension} onChange={() => toggleComorbid("hypertension")} />
                    <ToggleRow label="Diabetes" checked={!!comorbidities.diabetes} onChange={() => toggleComorbid("diabetes")} />
                    <ToggleRow label="Colesterol alto" hint="(dislipidemia)" checked={!!comorbidities.dyslipidemia} onChange={() => toggleComorbid("dyslipidemia")} />
                    <ToggleRow label="Doença nos rins" hint="(doença renal crônica)" checked={!!comorbidities.ckd} onChange={() => toggleComorbid("ckd")} />
                    <ToggleRow label="Apneia do sono" hint="(ronco com pausas na respiração)" checked={!!comorbidities.sleep_apnea} onChange={() => toggleComorbid("sleep_apnea")} />
                  </div>
                </StepShell>
              )}

              {step === "historico" && (
                <StepShell eyebrow="Coração" title={<>Já teve algum <span className="text-primary">destes problemas?</span></>}>
                  <div className="space-y-2.5">
                    <ToggleRow label="Infarto" hint="(ataque do coração)" checked={!!history.previous_mi} onChange={() => toggleHistory("previous_mi")} />
                    <ToggleRow label="Insuficiência cardíaca" hint="(coração fraco/cansado)" checked={!!history.heart_failure} onChange={() => toggleHistory("heart_failure")} />
                    <ToggleRow label="Arritmia" hint="(fibrilação atrial — coração batendo fora do ritmo)" checked={!!history.atrial_fibrillation} onChange={() => toggleHistory("atrial_fibrillation")} />
                    <ToggleRow label="Entupimento tratado com stent" hint="(angioplastia com stent)" checked={!!history.pci} onChange={() => toggleHistory("pci")} />
                    <ToggleRow label="Ponte de safena" hint="(cirurgia de revascularização)" checked={!!history.cabg} onChange={() => toggleHistory("cabg")} />
                    <ToggleRow
                      label="Marcapasso"
                      checked={history.device_implant === "pacemaker"}
                      onChange={(v) => setHistory((h) => ({ ...h, device_implant: v ? "pacemaker" : null }))}
                    />
                    <ToggleRow label="AVC" hint="(derrame)" checked={!!history.stroke_tia} onChange={() => toggleHistory("stroke_tia")} />
                  </div>
                </StepShell>
              )}

              {step === "familia" && (
                <StepShell eyebrow="Família e alergias" title={<>Mais <span className="text-primary">algumas coisas</span></>}>
                  <div className="space-y-5">
                    <ToggleRow
                      label="Problema de coração precoce na família"
                      hint="Pai/irmão antes dos 55 anos, ou mãe/irmã antes dos 65"
                      checked={!!history.family_early_cad}
                      onChange={() => toggleHistory("family_early_cad")}
                    />
                    <div>
                      <Label className="text-base text-foreground">Alergia ou reação a algum remédio?</Label>
                      <Textarea
                        value={alergias}
                        onChange={(e) => setAlergias(e.target.value)}
                        placeholder="Ex: estatina me dá dor muscular. Se não tiver nenhuma, pode deixar em branco."
                        className="mt-1.5 rounded-2xl text-base"
                        rows={3}
                      />
                    </div>
                  </div>
                </StepShell>
              )}

              {step === "medico" && (
                <StepShell eyebrow="Médico" title={<>Seu <span className="text-primary">cardiologista</span></>}>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Se o seu médico já usa o Encorpei Cardio, ele te passa um código para vincular sua conta.
                    Se não tiver o código agora, pode continuar sem — dá para vincular depois em Minha conta.
                  </p>

                  {!quisCodigo ? (
                    <button
                      type="button"
                      onClick={() => setQuisCodigo(true)}
                      className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-border p-4 text-left hover:border-primary/50 transition-colors"
                    >
                      <span className="h-11 w-11 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0">
                        <KeyRound className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-base font-medium text-foreground">Tenho um código do meu médico</span>
                        <span className="block text-sm text-muted-foreground mt-0.5">Toque aqui para digitar</span>
                      </span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-base text-foreground">Código do médico</Label>
                      <Input
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                        placeholder="Ex: A4F9KP"
                        maxLength={8}
                        className="h-14 rounded-2xl text-center text-lg font-mono tracking-[0.3em] uppercase"
                      />
                    </div>
                  )}

                  <div className="rounded-2xl bg-card border border-border shadow-sm p-5 mt-6">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resumo</p>
                    <div className="space-y-2 mt-3 text-base">
                      {[
                        { label: "Nome", value: nome || "—" },
                        { label: "Nascimento", value: nascimento ? new Date(nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—" },
                        { label: "Altura / peso", value: `${altura || "—"} cm · ${peso || "—"} kg` },
                      ].map((r, i) => (
                        <div key={i} className="flex justify-between">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="text-foreground font-medium">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </StepShell>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navegação */}
      <div className="px-6 pb-8 pt-2 flex gap-3 max-w-md mx-auto w-full">
        {stepIndex > 0 && (
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl shrink-0" onClick={back} aria-label="Voltar" disabled={saving}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <Button
          size="xl"
          className="flex-1 h-14 rounded-2xl text-base"
          disabled={!canNext() || saving}
          onClick={step === "medico" ? handleFinish : next}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : step === "medico" ? (
            <>Concluir <Check className="h-5 w-5" /></>
          ) : step === "welcome" ? (
            "Começar"
          ) : (
            <>Próximo <ChevronRight className="h-5 w-5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
