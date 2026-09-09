import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalProfile } from "@/hooks/useProfessional";
import { useHasPatientProfile, perfilDosMetadados } from "@/hooks/useAccountRoleCheck";
import { WrongPortalBlock } from "@/components/WrongPortalBlock";
import { PageTransition } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, HeartPulse, Loader2 } from "lucide-react";
import { classifyError } from "@/lib/errorHandler";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const SPECIALTIES = [
  { value: "cardiologist", label: "Cardiologista" },
  { value: "general_practitioner", label: "Clínico geral" },
  { value: "nurse", label: "Enfermagem" },
  { value: "nutritionist", label: "Nutrição" },
] as const;

/**
 * Cadastro do perfil PROFISSIONAL (cardiologista/clínico/enfermagem/nutrição).
 * O acesso ao painel fica pendente de aprovação — a tela deixa isso claro
 * antes e depois de enviar (docs/CONTRATO-DE-CODIGO.md).
 */
export default function ProOnboardingPage() {
  const { user, loading, signOut } = useAuth();
  const { data: patientRow, isLoading: checkingPatient } = useHasPatientProfile(user?.id, !!user);
  const isPatient = !!patientRow || perfilDosMetadados(user) === "paciente";
  const { profile, isLoading, isError, error, refetch, salvar } = useProfessionalProfile();
  const navigate = useNavigate();

  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [registrationState, setRegistrationState] = useState("");
  const [specialty, setSpecialty] = useState<typeof SPECIALTIES[number]["value"]>("cardiologist");
  const [clinicName, setClinicName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");

  // O nome e o CRM/UF já podem ter vindo do cadastro (ProAuthPage) — não
  // pede de novo se já estiverem preenchidos nos metadados do usuário.
  useEffect(() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined;
    if (meta?.full_name && !displayName) setDisplayName(String(meta.full_name));
    if (meta?.registration_number && !registrationNumber) setRegistrationNumber(String(meta.registration_number));
    if (meta?.registration_state && !registrationState) setRegistrationState(String(meta.registration_state));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || isLoading || (user && !profile && checkingPatient)) return null;
  if (!user) return <Navigate to="/pro/auth" replace />;
  if (profile && !submitted) return <Navigate to="/pro/dashboard" replace />;

  // Conta de paciente nunca preenche o cadastro de médico.
  if (isPatient) {
    return (
      <WrongPortalBlock
        message={`Esta conta (${user.email ?? ""}) é de paciente. O cadastro de médico precisa de outro e-mail.`}
        correctPortalLabel="o portal do paciente"
        correctPortalHref="/hoje"
        onSignOut={async () => { try { await signOut(); } catch { /* segue */ } window.location.href = "/pro/auth"; }}
      />
    );
  }

  if (isError) {
    const classified = classifyError(error);
    return (
      <PageTransition>
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1 max-w-[280px]">
            <p className="text-sm font-semibold text-foreground">Não foi possível carregar seu perfil.</p>
            <p className="text-xs text-muted-foreground">{classified.userMessage}</p>
          </div>
          <button onClick={() => refetch()} className="text-sm font-semibold text-primary hover:underline px-3 py-1.5">
            Tentar de novo
          </button>
        </div>
      </PageTransition>
    );
  }

  if (submitted) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-success-bg text-success mx-auto">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Cadastro enviado!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Assim que a nossa equipe aprovar seu cadastro, você recebe acesso ao painel de pacientes.
              Isso costuma levar pouco tempo.
            </p>
            <Button size="xl" className="w-full h-[56px] rounded-2xl" onClick={() => navigate("/pro/dashboard")}>
              Ir para o painel
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  const faltando = () => {
    const itens = [
      !displayName.trim() && "nome de exibição",
      !registrationNumber.trim() && "CRM",
      !registrationState.trim() && "UF",
    ].filter(Boolean) as string[];
    return itens;
  };

  const handleFinish = async () => {
    const faltam = faltando();
    if (faltam.length > 0) {
      setAttempted(true);
      toast.error(`Preencha antes: ${faltam.join(", ")}.`);
      return;
    }
    try {
      await salvar.mutateAsync({
        display_name: displayName.trim(),
        registration_number: registrationNumber.trim(),
        registration_state: registrationState.trim().toUpperCase(),
        specialty,
        clinic_name: clinicName.trim() || null,
        bio: bio.trim() || null,
        // `phone` existe no banco mas não nos types gerados (mesmo caso
        // documentado em src/hooks/useMyProfessionals.ts).
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      setSubmitted(true);
    } catch {
      // erro já mostrado por toastError dentro do hook
    }
  };

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4 mx-auto">
              <HeartPulse className="h-7 w-7 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Configurar perfil profissional</h1>
            <p className="text-sm text-muted-foreground mt-1">Esses dados aparecem para seus pacientes.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome de exibição <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Dr(a). Nome"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className={cn("h-[54px] rounded-2xl text-base", attempted && !displayName.trim() && "border-destructive focus-visible:ring-destructive")}
              />
              {attempted && !displayName.trim() && <p className="text-xs text-destructive">Obrigatório</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">CRM <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="000000"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value)}
                  required
                  className={cn("h-[54px] rounded-2xl text-base", attempted && !registrationNumber.trim() && "border-destructive focus-visible:ring-destructive")}
                />
                {attempted && !registrationNumber.trim() && <p className="text-xs text-destructive">Obrigatório</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">UF <span className="text-destructive">*</span></Label>
                <select
                  value={registrationState}
                  onChange={(e) => setRegistrationState(e.target.value)}
                  className={cn(
                    "h-[54px] w-full rounded-2xl border border-input bg-background px-3 text-base",
                    attempted && !registrationState.trim() && "border-destructive"
                  )}
                >
                  <option value="">Selecione</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
                {attempted && !registrationState.trim() && <p className="text-xs text-destructive">Obrigatório</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Especialidade</Label>
              <div className="grid grid-cols-2 gap-2">
                {SPECIALTIES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSpecialty(s.value)}
                    className={cn(
                      "h-12 rounded-2xl border-2 text-sm font-semibold transition-colors px-3",
                      specialty === s.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-border-strong",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Clínica (opcional)</Label>
              <Input
                placeholder="Nome da clínica"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="h-[54px] rounded-2xl text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Telefone / WhatsApp (opcional)</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-[54px] rounded-2xl text-base"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Bio curta (opcional)</Label>
              <Textarea
                placeholder="Uma ou duas frases sobre sua atuação"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="rounded-2xl text-base"
              />
            </div>

            <div className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground leading-relaxed">
              Seu cadastro passa por análise da nossa equipe antes de liberar o acesso ao painel.
            </div>

            <Button
              size="xl"
              className="w-full h-[56px] rounded-2xl text-base"
              onClick={handleFinish}
              disabled={salvar.isPending}
            >
              {salvar.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Enviar para aprovação"}
            </Button>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
