import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageTransition } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Lock, HeartPulse } from "lucide-react";

/** Redefinição de senha via Supabase — o paciente chega aqui pelo link do e-mail. */
export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase acrescenta #access_token=...&type=recovery na URL do link.
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setIsRecovery(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não são iguais.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível trocar a senha agora.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <PageTransition>
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="w-full max-w-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-success-bg text-success mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Senha alterada!</h1>
            <p className="text-sm text-muted-foreground">Sua senha foi atualizada. Já pode entrar com ela.</p>
            <Button size="xl" className="w-full h-[56px] rounded-2xl" onClick={() => navigate("/hoje")}>
              Ir para o app
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-4 mx-auto">
              <HeartPulse className="h-7 w-7 text-primary" strokeWidth={1.75} />
            </div>
            <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Nova senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRecovery ? "Escolha sua nova senha abaixo." : "Confirmando o link, aguarde um instante..."}
            </p>
          </div>

          {isRecovery ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Pelo menos 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="h-[58px] rounded-2xl pl-12 text-base"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm">Confirmar a nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Digite de novo"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="h-[58px] rounded-2xl pl-12 text-base"
                  />
                </div>
              </div>
              <Button size="xl" type="submit" disabled={submitting} className="w-full h-[58px] rounded-2xl text-base">
                {submitting ? "Salvando..." : "Trocar senha"}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Se você chegou aqui por engano, volte para o login.
              </p>
              <Button variant="outline" size="xl" className="rounded-2xl" onClick={() => navigate("/auth")}>
                Ir para o login
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
