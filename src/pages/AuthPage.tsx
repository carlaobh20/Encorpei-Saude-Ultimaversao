import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { clearDevBypass, setDevBypass } from "@/contexts/DevBypass";
import { grantManyConsents } from "@/lib/consent";
import { fetchAccountRoleFlags } from "@/lib/accountAccess";
import { PageTransition } from "@/components/shell";
import { WrongPortalBlock } from "@/components/WrongPortalBlock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, ArrowRight, Mail, Lock, Eye, EyeOff, User, ShieldCheck, HeartPulse } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvisoSemBanco } from "@/components/shell/AvisoSemBanco";

type Mode = "login" | "register" | "forgot";
type MsgTone = "erro" | "ok" | "warn";

/**
 * Login/cadastro do PACIENTE cardiológico.
 *
 * Preserva a auditoria de login cruzado herdada do app de obstetrícia que
 * originou este projeto
 * (docs/CONTRATO-DE-CODIGO.md): e-mail+senha só provam identidade, o papel
 * da conta (paciente x médico) é conferido direto no banco antes de deixar
 * entrar. Público-alvo 60–75 anos: campos grandes, poucas etapas, frases
 * curtas (tom de escrita — docs/MAPEAMENTO-CARDIO.md §"Tom de escrita").
 */
export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [searchParams] = useSearchParams();
  const wrongEmailFromQuery = searchParams.get("erro") === "medico";

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ tipo: MsgTone; texto: string } | null>(
    wrongEmailFromQuery ? { tipo: "erro", texto: "Este e-mail está cadastrado como médico. Entre pelo portal do médico." } : null
  );
  const [showResend, setShowResend] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedHealthData, setAcceptedHealthData] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signOut } = useAuth();
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (msg?.tipo === "erro") emailRef.current?.focus();
  }, [msg]);

  const handleLogoClick = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    try { await signOut(); } catch { /* segue mesmo se falhar */ }
    window.location.href = "/landing";
  };

  const handleLogin = async () => {
    if (!email.trim() || !senha) {
      setMsg({ tipo: "erro", texto: "Preencha e-mail e senha." });
      return;
    }
    setLoading(true); setMsg(null); setShowResend(false);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      setLoading(false);
      const lower = error.message.toLowerCase();
      if (lower.includes("email not confirmed") || lower.includes("email_not_confirmed")) {
        setMsg({ tipo: "warn", texto: "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada (e a pasta de spam)." });
        setShowResend(true);
      } else {
        setMsg({ tipo: "erro", texto: "E-mail ou senha incorretos. Verifique e tente de novo." });
      }
      return;
    }

    // Bloqueio de login cruzado — o Supabase Auth só prova e-mail+senha,
    // quem sabe o papel da conta é o banco. Este é o portal do paciente;
    // e-mail de médico não entra aqui.
    try {
      const flags = await fetchAccountRoleFlags(data.user!.id);
      if (flags.isProfessional) {
        await supabase.auth.signOut();
        setLoading(false);
        setMsg({ tipo: "erro", texto: "Este e-mail está cadastrado como médico. Entre pelo portal do médico." });
        return;
      }
    } catch {
      await supabase.auth.signOut();
      setLoading(false);
      setMsg({ tipo: "erro", texto: "Não foi possível confirmar seu acesso agora. Tente de novo." });
      return;
    }

    // Login real sempre desliga o modo demonstração — e recarrega a página
    // inteira (não navigate() do SPA) para o AuthContext sincronizar com a
    // sessão real do Supabase.
    clearDevBypass();
    window.location.href = "/hoje";
  };

  const handleRegister = async () => {
    if (!nome.trim()) { setMsg({ tipo: "erro", texto: "Por favor, escreva seu nome completo." }); return; }
    if (senha.length < 6) { setMsg({ tipo: "erro", texto: "A senha precisa ter pelo menos 6 letras ou números." }); return; }
    if (!acceptedTerms || !acceptedHealthData) {
      setMsg({ tipo: "erro", texto: "Para criar a conta, é preciso aceitar os termos e o consentimento de dados de saúde." });
      return;
    }
    setLoading(true); setMsg(null); setShowResend(false);

    const { data, error } = await supabase.auth.signUp({
      email, password: senha,
      options: { data: { full_name: nome, perfil: "paciente" }, emailRedirectTo: window.location.origin + "/auth" },
    });

    if (error) {
      setLoading(false);
      const lower = error.message.toLowerCase();
      if (lower.includes("already registered") || lower.includes("user_already_exists")) {
        setMsg({ tipo: "warn", texto: "Este e-mail já tem cadastro. Tente entrar." });
        setMode("login");
      } else {
        setMsg({ tipo: "erro", texto: error.message });
      }
      return;
    }

    // Consentimento explícito e destacado (LGPD art. 8 e 11 — dado de saúde
    // é dado sensível). Registra a aceitação dos termos e do tratamento de
    // dados de saúde já no cadastro.
    if (data?.user?.id) {
      try {
        await grantManyConsents(data.user.id, ["terms", "privacy", "health_data"], "signup");
      } catch {
        // não bloqueia o cadastro se o registro de consentimento falhar
      }
    }

    const { error: loginErr } = await supabase.auth.signInWithPassword({ email, password: senha });
    setLoading(false);
    if (!loginErr) {
      clearDevBypass();
      window.location.href = "/onboarding";
      return;
    }
    setMsg({ tipo: "ok", texto: "Conta criada! Verifique seu e-mail para confirmar o cadastro." });
    setShowResend(true);
  };

  const handleResend = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup", email,
      options: { emailRedirectTo: window.location.origin + "/auth" },
    });
    setLoading(false);
    if (error) setMsg({ tipo: "erro", texto: "Erro ao reenviar. Tente de novo em alguns minutos." });
    else setMsg({ tipo: "ok", texto: "E-mail reenviado! Verifique sua caixa de entrada e a pasta de spam." });
  };

  const handleForgot = async () => {
    if (!email.trim()) { setMsg({ tipo: "erro", texto: "Digite seu e-mail." }); return; }
    setLoading(true); setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) setMsg({ tipo: "erro", texto: error.message });
    else setMsg({ tipo: "ok", texto: "Enviamos um link de recuperação para o seu e-mail." });
  };

  const handleDemo = () => {
    setDevBypass("paciente");
    window.location.href = "/hoje";
  };

  const submit = mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgot;
  const invalid = msg?.tipo === "erro";

  // Se o link ?erro=medico trouxe uma sessão de médico ainda ativa (raro,
  // mas possível se veio de um redirect), mostra o bloqueio em vez do form.
  if (wrongEmailFromQuery) {
    return (
      <WrongPortalBlock
        message="Este e-mail está cadastrado como médico. Entre pelo portal do médico para acessar sua conta."
        correctPortalLabel="o portal do médico"
        correctPortalHref="/pro/auth"
        onSignOut={signOut}
      />
    );
  }

  return (
    <PageTransition>
      {/* `leitura-paciente` (index.css) aplicado aqui porque esta tela roda
          FORA do AppShell — é a primeira do app, e era a única da área do
          paciente onde `text-sm` valia 14px e `text-xs` valia 12px. Entrar e
          criar conta é onde o paciente de 68 anos mais desiste; não é lugar
          de ter a letra menor do produto. Nenhum texto e nenhum campo mudou:
          a classe só sobe a escala e garante os 44px de alvo. */}
      <div className="leitura-paciente min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">

          <a href="/landing" onClick={handleLogoClick} className="flex items-center gap-2.5 mb-8 justify-center w-fit mx-auto">
            <img src="/logo-symbol.png" alt="Encorpei Cardio" width={40} height={40} className="object-contain shrink-0" style={{ width: 40, height: 40 }} />
            <div className="leading-tight text-left">
              <div className="font-display text-lg font-medium tracking-tight">Encorpei</div>
              <div className="text-base text-primary font-semibold -mt-0.5">Cardio</div>
            </div>
          </a>

          <div className="bg-card border border-border shadow-card rounded-[28px] p-7 sm:p-9">
            {mode !== "login" && (
              <button
                type="button"
                onClick={() => { setMode("login"); setMsg(null); }}
                className="text-base text-muted-foreground inline-flex min-h-[44px] items-center gap-1 mb-3 rounded-lg hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}

            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4">
                <HeartPulse className="h-7 w-7 text-primary" strokeWidth={1.75} />
              </div>
              <h1 className="font-display text-[26px] font-medium tracking-tight text-foreground">
                {mode === "login" && "Bem-vindo de volta"}
                {mode === "register" && "Vamos criar sua conta"}
                {mode === "forgot" && "Recuperar senha"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {mode === "login" && "Entre para ver seus números de hoje."}
                {mode === "register" && "Leva menos de 2 minutos."}
                {mode === "forgot" && "Digite seu e-mail e enviamos um link para trocar a senha."}
              </p>
            </div>

            <AvisoSemBanco />
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4" noValidate>
              {mode === "register" && (
                <div className="space-y-1.5">
                  <Label htmlFor="nome" className="text-sm">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                    <Input
                      id="nome"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      required
                      className="h-[58px] rounded-2xl pl-12 text-base"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    ref={emailRef}
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
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
                    <Label htmlFor="senha" className="text-sm">Senha</Label>
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
                      id="senha"
                      type={showPassword ? "text" : "password"}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Pelo menos 6 caracteres"
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

              {mode === "register" && (
                <div className="space-y-3 rounded-2xl bg-secondary/60 p-4">
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
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedHealthData}
                      onChange={(e) => setAcceptedHealthData(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 rounded border-border accent-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Autorizo o uso dos meus dados de saúde</strong> (pressão, batimentos,
                      remédios e exames) para o acompanhamento do meu coração pelo app e pelo meu médico.
                    </span>
                  </label>
                </div>
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

              {showResend && (
                <button type="button" onClick={handleResend} className="text-sm font-semibold text-primary hover:underline">
                  Reenviar e-mail de confirmação
                </button>
              )}

              <Button
                size="xl"
                type="submit"
                disabled={loading || (mode === "register" && (!acceptedTerms || !acceptedHealthData))}
                aria-busy={loading}
                className="w-full h-[58px] rounded-2xl text-base mt-2"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? "Entrar" : mode === "register" ? "Criar minha conta" : "Enviar link de recuperação"}
                    {mode === "login" && <ArrowRight className="h-5 w-5" />}
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
                  disabled={loading}
                >
                  Conhecer sem cadastrar (modo demonstração)
                </Button>
              )}
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {mode === "forgot" ? (
                <button type="button" onClick={() => { setMode("login"); setMsg(null); }} className="text-primary font-semibold hover:underline">
                  Voltar para o login
                </button>
              ) : mode === "login" ? (
                <>Ainda não tem conta?{" "}
                  <button type="button" onClick={() => { setMode("register"); setMsg(null); }} className="text-primary font-semibold hover:underline">
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

          <div className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span>Seus dados de saúde ficam protegidos e são só seus.</span>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-3">
            É médico cardiologista?{" "}
            <Link to="/pro/auth" className="text-primary font-medium hover:underline">Entre pelo portal do médico</Link>
          </p>

          {/* Quem chega com um código de cuidador na mão chega AQUI, na tela de
              entrada — e até agora não havia nada nela dizendo onde usar o
              código. A rota existia; o caminho até ela, não. */}
          <p className="text-center text-sm text-muted-foreground mt-2">
            Fui convidado para cuidar de alguém.{" "}
            <Link to="/cuidador" className="text-primary font-medium hover:underline">Entrar com o código do convite</Link>
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
