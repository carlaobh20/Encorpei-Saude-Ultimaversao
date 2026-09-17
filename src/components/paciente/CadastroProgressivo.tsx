import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Loader2, Check, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getDevBypass } from "@/contexts/DevBypass";
import { useCardioPatient, useSalvarCardioPatient } from "@/hooks/useCardioPatient";
import { useProfile } from "@/hooks/useProfile";
import { useWeight } from "@/hooks/useCardioReadings";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { idadeEmAnos } from "@/lib/clinical/scores";
import {
  COMORBIDADE_CHIPS,
  HISTORIA_CHIPS,
  OBJETIVO_CHIPS,
  algumaComorbidadeChip,
  algumaHistoriaChip,
  limparComorbidadesChip,
  limparHistoriaChip,
} from "@/lib/cadastroPaciente";
import type {
  CardioComorbidities,
  CardioHistory,
  CardioIntake,
  SmokingStatus,
} from "@/types/cardio";

const PASSOS = [
  { id: "sobre", titulo: "Sobre você", descricao: "Como podemos te chamar e te encontrar." },
  { id: "corpo", titulo: "Seu corpo", descricao: "Medidas simples. Sem jargão clínico." },
  { id: "saude", titulo: "Sua saúde", descricao: "Só o que importa para quem cuida de você." },
  { id: "vida", titulo: "Estilo de vida", descricao: "Fumo, álcool, sono e movimento." },
  { id: "objetivos", titulo: "Objetivos", descricao: "Para onde você quer ir." },
  { id: "medico", titulo: "Seu médico", descricao: "Opcional — dá para vincular depois." },
] as const;

function Chip({
  on, onClick, children, perigo,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-2xl border-2 px-4 py-2 text-base font-semibold transition-colors",
        on
          ? perigo
            ? "border-error bg-error-bg text-error"
            : "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-border-strong",
      )}
    >
      {children}
    </button>
  );
}

function PassoCabecalho({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="mb-5">
      <h2 className="font-display text-3xl font-medium tracking-tight text-foreground leading-tight">{titulo}</h2>
      <p className="text-base text-muted-foreground mt-1 leading-relaxed">{descricao}</p>
    </div>
  );
}

export type ModoCadastro = "cadastro" | "edicao";

/**
 * Wizard de 6 passos do cadastro do paciente.
 *
 * Usado em /onboarding (primeira vez) e reaberto pela Conta (?editar=1).
 * Grava em cardio_patients + profiles.onboarding_completed. Modo demo não escreve.
 */
export function CadastroProgressivo({ modo = "cadastro" }: { modo?: ModoCadastro }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { profile, updateProfile } = useProfile();
  const { data: patient, isLoading: carregandoPaciente } = useCardioPatient();
  const salvarPaciente = useSalvarCardioPatient();
  const { ultimo: ultimoPeso, registrar: registrarPeso, isLoading: carregandoPeso } = useWeight();
  const { acceptInvite } = useMyProfessionals();

  const [passo, setPasso] = useState(0);
  const [saving, setSaving] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  const [nome, setNome] = useState("");
  const [nascimento, setNascimento] = useState("");
  const [sexo, setSexo] = useState<"male" | "female" | "">("");
  const [telefone, setTelefone] = useState("");

  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");

  const [tabagismo, setTabagismo] = useState<SmokingStatus | "">("");
  const [alcool, setAlcool] = useState("");
  const [sonoHoras, setSonoHoras] = useState("");
  const [seMovimenta, setSeMovimenta] = useState<boolean | null>(null);
  const [notaAtividade, setNotaAtividade] = useState("");

  const [comorbidities, setComorbidities] = useState<CardioComorbidities>({});
  const [history, setHistory] = useState<CardioHistory>({});
  const [temAlergia, setTemAlergia] = useState(false);
  const [alergias, setAlergias] = useState("");

  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [metaPeso, setMetaPeso] = useState("");

  const [quisCodigo, setQuisCodigo] = useState(false);
  const [codigo, setCodigo] = useState("");

  useEffect(() => {
    if (hidratado || carregandoPaciente || carregandoPeso) return;
    const intake = (patient?.intake ?? {}) as CardioIntake;
    setNome(patient?.full_name ?? profile?.full_name ?? "");
    setNascimento(patient?.birth_date ?? profile?.birth_date ?? "");
    const sexoInicial = patient?.sex ?? profile?.sex;
    setSexo(sexoInicial === "male" || sexoInicial === "female" ? sexoInicial : "");
    setTelefone(patient?.phone ?? profile?.phone ?? "");
    setAltura(
      patient?.height_cm != null
        ? String(patient.height_cm)
        : profile?.height_cm != null
          ? String(profile.height_cm)
          : "",
    );
    setPeso(ultimoPeso?.value != null ? String(ultimoPeso.value) : "");
    setTabagismo(patient?.smoking_status ?? "");
    setAlcool(patient?.alcohol_units_week != null ? String(patient.alcohol_units_week) : "");
    setSonoHoras(intake.sleep_hours_usual != null ? String(intake.sleep_hours_usual) : "");
    setSeMovimenta(typeof intake.physically_active === "boolean" ? intake.physically_active : null);
    setNotaAtividade(intake.activity_note ?? "");
    setComorbidities(patient?.comorbidities ?? {});
    setHistory(patient?.history ?? {});
    const alergiaTexto = patient?.allergies?.trim() ?? "";
    setTemAlergia(alergiaTexto.length > 0);
    setAlergias(alergiaTexto);
    setObjetivos(intake.goals ?? []);
    setMetaPeso(intake.target_kg != null ? String(intake.target_kg) : "");
    setHidratado(true);
  }, [hidratado, carregandoPaciente, carregandoPeso, patient, profile, ultimoPeso]);

  if (!hidratado) {
    return <div className="leitura-paciente min-h-screen bg-background" />;
  }

  const pct = Math.round(((passo + 1) / PASSOS.length) * 100);
  const idade = idadeEmAnos(nascimento || null);

  const podeAvancar = () => {
    if (passo === 0) return nome.trim().length >= 2 && nascimento.length === 10 && sexo !== "";
    return true;
  };

  const toggleComorbid = (key: (typeof COMORBIDADE_CHIPS)[number]["key"]) =>
    setComorbidities((c) => ({ ...c, [key]: !c[key] }));

  const toggleHistory = (key: (typeof HISTORIA_CHIPS)[number]["key"]) =>
    setHistory((h) => ({ ...h, [key]: !h[key] }));

  const toggleObjetivo = (k: string) =>
    setObjetivos((lista) => (lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]));

  const concluir = async () => {
    setSaving(true);
    try {
      if (getDevBypass() || !user) {
        toast.info(getDevBypass() ? "Modo demo: nada é salvo." : "Entre na sua conta para gravar o cadastro.");
        navigate(modo === "edicao" ? "/conta" : "/hoje", { replace: true });
        return;
      }

      const intake: CardioIntake = {
        goals: objetivos,
        target_kg: objetivos.includes("peso") && metaPeso ? Number(metaPeso) : null,
        sleep_hours_usual: sonoHoras ? Number(sonoHoras) : null,
        physically_active: seMovimenta,
        activity_note: seMovimenta && notaAtividade.trim() ? notaAtividade.trim() : null,
      };

      await salvarPaciente.mutateAsync({
        full_name: nome.trim(),
        phone: telefone.trim() || null,
        birth_date: nascimento || null,
        sex: sexo || null,
        height_cm: altura ? Number(altura) : null,
        smoking_status: tabagismo || null,
        alcohol_units_week: alcool ? Number(alcool) : null,
        comorbidities,
        history,
        allergies: temAlergia ? (alergias.trim() || null) : null,
        intake,
      });

      await updateProfile.mutateAsync({
        full_name: nome.trim(),
        phone: telefone.trim() || null,
        birth_date: nascimento || null,
        sex: sexo || null,
        height_cm: altura ? Number(altura) : null,
        onboarding_completed: true,
      });

      const pesoNum = peso ? Number(peso) : NaN;
      if (Number.isFinite(pesoNum) && pesoNum > 0 && pesoNum !== ultimoPeso?.value) {
        try {
          await registrarPeso.mutateAsync({ value: pesoNum });
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

      toast.success(
        modo === "edicao"
          ? "Cadastro atualizado."
          : "Cadastro pronto, " + (nome.split(" ")[0] || "") + "!",
      );
      navigate(modo === "edicao" ? "/conta" : "/hoje", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar seu cadastro agora.");
    } finally {
      setSaving(false);
    }
  };

  const atual = PASSOS[passo];

  return (
    <div className="leitura-paciente min-h-screen flex flex-col bg-background">
      <header className="px-6 pt-6 pb-4 flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <img src="/logo-symbol.png" alt="Encorpei Cardio" width={36} height={36} className="object-contain shrink-0" style={{ width: 36, height: 36 }} />
          <div className="leading-tight">
            <div className="font-display text-base font-medium tracking-tight">Encorpei</div>
            <div className="text-sm text-primary font-semibold -mt-0.5">Cardio</div>
          </div>
        </div>
        <div className="ml-auto text-sm text-muted-foreground tabular-nums" aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
          {passo + 1} / {PASSOS.length}
        </div>
      </header>

      <div className="px-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary">{atual.titulo}</p>
          <p className="text-sm text-muted-foreground tabular-nums">{pct}%</p>
        </div>
        <div
          className="h-2 bg-secondary rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={passo + 1}
          aria-valuemin={1}
          aria-valuemax={PASSOS.length}
          aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        </div>
      </div>

      <main className="flex-1 px-6 pb-4 overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={atual.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              <PassoCabecalho titulo={atual.titulo} descricao={atual.descricao} />

              {passo === 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-base text-foreground">Nome completo</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" className="mt-1.5 h-14 rounded-2xl text-base" autoFocus />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-base text-foreground">Nascimento</Label>
                      <Input value={nascimento} onChange={(e) => setNascimento(e.target.value)} type="date" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                    <div>
                      <Label className="text-base text-foreground">Telefone</Label>
                      <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                  </div>
                  {idade != null && <p className="text-sm text-muted-foreground">{idade} anos</p>}
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
              )}

              {passo === 1 && (
                <div className="space-y-4">
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
                </div>
              )}

              {passo === 2 && (
                <div className="space-y-5">
                  <div>
                    <p className="text-base font-medium text-foreground mb-2">Você tem alguma dessas condições?</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        on={!algumaComorbidadeChip(comorbidities)}
                        onClick={() => setComorbidities((c) => limparComorbidadesChip(c))}
                      >
                        Nenhuma
                      </Chip>
                      {COMORBIDADE_CHIPS.map((c) => (
                        <Chip key={c.key} on={!!comorbidities[c.key]} onClick={() => toggleComorbid(c.key)}>
                          {c.label}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground mb-2">Já teve algum destes problemas?</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        on={!algumaHistoriaChip(history)}
                        onClick={() => setHistory((h) => limparHistoriaChip(h))}
                      >
                        Nenhum
                      </Chip>
                      {HISTORIA_CHIPS.map((c) => (
                        <Chip key={c.key} on={!!history[c.key]} onClick={() => toggleHistory(c.key)}>
                          {c.label}
                        </Chip>
                      ))}
                      <Chip
                        on={history.device_implant === "pacemaker"}
                        onClick={() => setHistory((h) => ({ ...h, device_implant: h.device_implant === "pacemaker" ? null : "pacemaker" }))}
                      >
                        Marcapasso
                      </Chip>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground mb-2">Alergia a remédio ou alimento?</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Chip on={!temAlergia} onClick={() => { setTemAlergia(false); setAlergias(""); }}>Não tenho</Chip>
                      <Chip on={temAlergia} perigo={temAlergia} onClick={() => setTemAlergia(true)}>Sim, tenho</Chip>
                    </div>
                    {temAlergia && (
                      <Textarea
                        value={alergias}
                        onChange={(e) => setAlergias(e.target.value)}
                        placeholder="Ex: dipirona, amendoim, estatina…"
                        className="rounded-2xl text-base"
                        rows={3}
                      />
                    )}
                  </div>
                </div>
              )}

              {passo === 3 && (
                <div className="space-y-5">
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
                  <div>
                    <Label className="text-base text-foreground">Sono (horas por noite)</Label>
                    <Input value={sonoHoras} onChange={(e) => setSonoHoras(e.target.value)} type="number" inputMode="decimal" placeholder="Ex: 7" className="mt-1.5 h-14 rounded-2xl text-base" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-foreground mb-2">Você se movimenta no dia a dia?</p>
                    <div className="flex flex-wrap gap-2">
                      <Chip on={seMovimenta === true} onClick={() => setSeMovimenta(true)}>Sim</Chip>
                      <Chip on={seMovimenta === false} onClick={() => { setSeMovimenta(false); setNotaAtividade(""); }}>Ainda não</Chip>
                    </div>
                    {seMovimenta && (
                      <Input
                        value={notaAtividade}
                        onChange={(e) => setNotaAtividade(e.target.value)}
                        placeholder="Ex: caminhada 3 vezes por semana"
                        className="mt-3 h-14 rounded-2xl text-base"
                      />
                    )}
                  </div>
                </div>
              )}

              {passo === 4 && (
                <div className="space-y-4">
                  <p className="text-base font-medium text-foreground">O que mais importa agora?</p>
                  <div className="flex flex-wrap gap-2">
                    {OBJETIVO_CHIPS.map((g) => (
                      <Chip key={g.k} on={objetivos.includes(g.k)} onClick={() => toggleObjetivo(g.k)}>{g.l}</Chip>
                    ))}
                  </div>
                  {objetivos.includes("peso") && (
                    <div>
                      <Label className="text-base text-foreground">Peso que você gostaria de alcançar (kg)</Label>
                      <Input value={metaPeso} onChange={(e) => setMetaPeso(e.target.value)} type="number" inputMode="decimal" className="mt-1.5 h-14 rounded-2xl text-base" />
                    </div>
                  )}
                </div>
              )}

              {passo === 5 && (
                <div className="space-y-5">
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
                  <div className="rounded-2xl bg-card border border-border shadow-sm p-5">
                    <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resumo</p>
                    <div className="space-y-2 mt-3 text-base">
                      {[
                        { label: "Nome", value: nome || "—" },
                        { label: "Nascimento", value: nascimento ? new Date(nascimento + "T00:00:00").toLocaleDateString("pt-BR") : "—" },
                        { label: "Altura / peso", value: `${altura || "—"} cm · ${peso || "—"} kg` },
                      ].map((r) => (
                        <div key={r.label} className="flex justify-between gap-3">
                          <span className="text-muted-foreground">{r.label}</span>
                          <span className="text-foreground font-medium text-right">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <div className="px-6 pb-8 pt-2 flex gap-3 max-w-md mx-auto w-full">
        {passo > 0 && (
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-2xl shrink-0" onClick={() => setPasso(passo - 1)} aria-label="Voltar" disabled={saving}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <Button
          size="xl"
          className="flex-1 h-14 rounded-2xl text-base"
          disabled={!podeAvancar() || saving}
          onClick={() => { if (passo === PASSOS.length - 1) void concluir(); else setPasso(passo + 1); }}
        >
          {saving ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : passo === PASSOS.length - 1 ? (
            <>Concluir <Check className="h-5 w-5" /></>
          ) : (
            <>Continuar <ChevronRight className="h-5 w-5" /></>
          )}
        </Button>
      </div>
    </div>
  );
}
