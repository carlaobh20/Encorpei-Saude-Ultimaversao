import { useEffect, useRef, useState } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { classifyError } from "@/lib/errorHandler";
import { grantManyConsents } from "@/lib/consent";
import { fetchAccountRoleFlags } from "@/lib/accountAccess";
import { useHasPatientProfile, useHasProfessionalProfile, perfilDosMetadados } from "@/hooks/useAccountRoleCheck";
import { setDevBypass } from "@/contexts/DevBypass";
import { WrongPortalBlock } from "@/components/WrongPortalBlock";
import { PageTransition } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, User, Lock, Eye, EyeOff, ShieldCheck, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvisoSemBanco } from "@/components/shell/AvisoSemBanco";

type Mode = "login" | "signup" | "forgot";
type MsgTone = "erro" | "ok" | "warn";

/**
 * Mensagens de erro do login — sem mascarar o motivo real. Só reescreve os
 * dois casos mais comuns (credenciais erradas / sem rede) numa cópia mais
 * clara; qualquer outro erro do Supabase é mostrado como veio.
 */
function getAuthErrorMessage(error: unknown, mode: Mode): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (mode !== "forgot" && (lower.includes("invalid login") || lower.includes("invalid_credentials"))) {
    return "E-mail ou senha incorretos.";
  }
  if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (e spam).";
  }
  if (lower.includes("already registered") || lower.includes("user_already_exists")) {
    return "Este e-mail já possui cadastro. Tente fazer login.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("net::err") ||
    !navigator.onLine
  ) {
    return "Não foi possível conectar agora. Verifique sua internet e tente de novo.";
  }
  if (raw) return raw;
  return classifyError(error).userMessage;
}

/**
 * Login/cadastro do CARDIOLOGISTA. Bloqueio de login cruzado espelhado do
 * lado do paciente (docs/CONTRATO-DE-CODIGO.md): e-mail de paciente não
 * entra aqui. Grava `perfil: "profissional"` nos metadados do usuário e
 * deixa claro, no cadastro, que o acesso ao painel depende de aprovação.
 */
export default function ProAuthPage() {
  const { user, loading, signOut } = useAuth();
  const { data: hasPro, isLoading: checkingPro } = useHasProfessionalProfile(user?.id, !!user);
  const { data: patientRow, isLoading: checkingPatient } = useHasPatientProfile(user?.id, !!user);
  const isPatient = !!patientRow || perfilDosMetadados(user) === "paciente";
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [crm, setCrm] = useState("");
  const [uf, setUf] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ tipo: MsgTone; texto: string } | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (msg?.tipo === "erro") emailRef.current?.focus();
  }, [msg]);

  // Sessão ativa que clica em "Login do médico":
  //   • já tem cadastro profissional → dashboard
  //   • é conta de paciente          → bloqueio "portal errado" + Sair
  //   • sem nenhum cadastro          → onboarding (acabou de criar a conta)
  if (loading || (user && (checkingPro || checkingPatient))) return null;
  if (user && hasPro) return <Navigate to="/pro/dashboard" replace />;
  if (user && isPatient) {
    return (
      <WrongPortalBlock
        message={`Você está conectado como paciente (${user.email ?? ""}). Para entrar como médico, saia desta conta primeiro.`}
        correctPortalLabel="o portal do paciente"
        correctPortalHref="/hoje"
        onSignOut={async () => { try { await signOut(); } catch { /* segue */ } window.location.href = "/pro/auth"; }}
      />
    );
  }
  if (user) return <Navigate to="/pro/onboarding" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (mode === "signup" && !acceptedTerms) {
      setMsg({ tipo: "erro", texto: "Para criar a conta, é preciso aceitar os termos e a política de privacidade." });
      return;
    }
    if (mode === "signup" && (!fullName.trim() || !crm.trim() || !uf.trim())) {
      setMsg({ tipo: "erro", texto: "Preencha nome, CRM e UF para continuar." });
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMsg({ tipo: "ok", texto: "Enviamos um link de recuperação para o seu e-mail." });
        setMode("login");
      } else if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Bloqueio de login cruzado — espelha o do paciente. Este é o
        // portal do médico; e-mail de paciente é barrado aqui, não
        // redirecionado.
        try {
          const flags = await fetchAccountRoleFlags(data.user!.id);
          if (flags.isPatient) {
            await supabase.auth.signOut();
            setMsg({ tipo: "erro", texto: "Este e-mail está cadastrado como paciente. Entre pelo portal do paciente." });
            return;
          }
        } catch {
          await supabase.auth.signOut();
          setMsg({ tipo: "erro", texto: "Não foi possível confirmar seu acesso agora. Tente de novo." });
          return;
        }

        navigate("/pro/dashboard");
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: {
              full_name: fullName,
              perfil: "profissional",
              registration_number: crm.trim(),
              registration_state: uf.trim().toUpperCase(),
            },
            emailRedirectTo: window.location.origin + "/pro/auth",
          },
        });
        if (error) throw error;

        if (data?.user?.id) {
          try {
            await grantManyConsents(data.user.id, ["terms", "privacy"], "signup");
          } catch {
            // não bloqueia o cadastro se o registro de consentimento falhar
          }
        }

        if (data?.user?.email_confirmed_at) {
          const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
          if (!loginErr) {
            navigate("/pro/onboarding");
            return;
          }
        }
        const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!loginErr) {
          navigate("/pro/onboarding");
          return;
        }
        setMsg({ tipo: "ok", texto: "Conta criada! Verifique seu e-mail para confirmar o cadastro." });
      }
    } catch (error) {
      setMsg({ tipo: "erro", texto: getAuthErrorMessage(error, mode) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogoClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try { await signOut(); } catch { /* segue mesmo se falhar */ }
    window.location.href = "/landing";
  };

  const handleDemo = () => {
    setDevBypass("medico");
    window.location.href = "/pro/dashboard";
  };

  const invalid = msg?.tipo === "erro";

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-[480px]">

          <a href="/landing" onClick={handleLogoClick} className="flex items-center gap-2.5 mb-8 justify-center w-fit mx-auto">
            <img src="/logo-symbol.png" alt="Encorpei Cardio" width={40} height={40} className="object-contain shrink-0" style={{ width: 40, height: 40 }} />
            <div className="leading-tight text-left">
              <div className="font-display text-lg font-medium tracking-tight">Encorpei</div>
              <div className="text-base text-primary font-semibold -mt-0.5">Cardio · Médico</div>
            </div>
          </a>

          <div className="bg-card border border-border shadow-card rounded-[28px] p-7 sm:p-9">
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <Stethoscope className="h-7 w-7 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">
                {mode === "forgot" ? "Recuperar senha" : "Portal do médico"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "login" && "Entre para acompanhar seus pacientes."}
                {mode === "signup" && "Cadastro para cardiologistas e equipe clínica."}
                {mode === "forgot" && "Digite seu e-mail e enviaremos um link de recuperação."}
              </p>
            </div>

            <AvisoSemBanco />
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {mode === "signup" && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-sm">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                      <Input
                        id="fullName"
                        placeholder="Dr(a). Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        required
                        className="h-[58px] rounded-2xl pl-12 text-base"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="crm" className="text-sm">CRM</Label>
                      <Input
                        id="crm"
                        placeholder="000000"
                        value={crm}
                        onChange={(e) => setCrm(e.target.value)}
                        required
                        className="h-[58px] rounded-2xl text-base text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="uf" className="text-sm">UF</Label>
                      <Input
                        id="uf"
                        placeholder="SP"
                        maxLength={2}
                        value={uf}
                        onChange={(e) => setUf(e.target.value.toUpperCase())}
                        required
                        className="h-[58px] rounded-2xl text-base text-center uppercase"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">E-mail</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    ref={emailRef}
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={msg ? "auth-msg" : undefined}
                    className="h-[58px] rounded-2xl pl-12 text-base"
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm">Senha</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setMsg(null); }}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required
                      minLength={6}
                      aria-invalid={invalid || undefined}
                      aria-describedby={msg ? "auth-msg" : undefined}
                      className="h-[58px] rounded-2xl pl-12 pr-12 text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "signup" && (
                <>
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground leading-relaxed">
                      Li e concordo com os{" "}
                      <Link to="/termos" className="text-primary font-medium hover:underline">termos de uso</Link>{" "}
                      e a{" "}
                      <Link to="/privacidade" className="text-primary font-medium hover:underline">política de privacidade</Link>.
                    </span>
                  </label>
                  <div className="rounded-2xl bg-secondary/60 p-4 text-sm text-muted-foreground leading-relaxed">
                    Seu cadastro passa por uma análise da nossa equipe antes de liberar o acesso ao painel de pacientes.
                  </div>
                </>
              )}

              {msg && (
                <div
                  id="auth-msg"
                  role="alert"
                  aria-live="polite"
                  className={cn(
                    "rounded-2xl p-4 text-sm border",
                    msg.tipo === "erro" && "bg-error-bg text-error border-error/20",
                    msg.tipo === "ok" && "bg-success-bg text-success border-success/20",
                    msg.tipo === "warn" && "bg-warning-bg text-warning border-warning/20",
                  )}
                >
                  {msg.texto}
                </div>
              )}

              <Button
                type="submit"
                size="xl"
                disabled={submitting || (mode === "signup" && !acceptedTerms)}
                aria-busy={submitting}
                className="w-full h-[58px] rounded-2xl text-base mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    {mode === "forgot" ? "Enviar link" : mode === "login" ? "Entrar" : "Criar conta"}
                    {mode !== "signup" && <ArrowRight className="h-5 w-5" />}
                  </>
                )}
              </Button>

              {mode === "login" && (
                <Button
                  type="button"
                  variant="outline"
                  size="xl"
                  className="w-full h-[54px] rounded-2xl"
                  onClick={handleDemo}
                  disabled={submitting}
                >
                  Conhecer o painel médico (modo demonstração)
                </Button>
              )}
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === "forgot" ? (
                <button type="button" onClick={() => { setMode("login"); setMsg(null); }} className="text-primary font-medium hover:underline">
                  Voltar ao login
                </button>
              ) : mode === "login" ? (
                <>Não tem conta?{" "}
                  <button type="button" onClick={() => { setMode("signup"); setMsg(null); }} className="text-primary font-semibold hover:underline">
                    Criar conta
                  </button>
                </>
              ) : (
                <>Já tem conta?{" "}
                  <button type="button" onClick={() => { setMode("login"); setMsg(null); }} className="text-primary font-semibold hover:underline">
                    Entrar
                  </button>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Dados de pacientes protegidos e auditados.</span>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-3">
            É paciente?{" "}
            <Link to="/auth" className="text-primary font-medium hover:underline">Entre pelo portal do paciente</Link>
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
