import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck } from "lucide-react";

export default function AdminAuthPage() {
  const { user, loading, signOut } = useAuth();
  const { isAdmin, isLoading } = useIsAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [forgot, setForgot] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  if (loading || (user && isLoading)) return <div className="min-h-screen grid place-items-center">Carregando acesso…</div>;
  if (user && isAdmin) return <Navigate to="/admin" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password?portal=admin`,
        });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        window.location.href = "/admin";
      }
    } catch (error) {
      toast({ title: forgot ? "Não foi possível enviar o link" : "Erro ao entrar", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const switchAccount = async () => {
    setSubmitting(true);
    try { await signOut(); }
    catch { toast({ title: "Não foi possível sair. Tente novamente.", variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cardio-dark px-5 py-10 text-white">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-white/10 mb-4"><ShieldCheck className="h-6 w-6" /></div>
          <p className="text-xs uppercase tracking-widest text-white/50 mb-2">Encorpei Saúde · Proprietário</p>
          <h1 className="text-2xl font-bold">{forgot ? "Recuperar acesso" : "Painel administrativo"}</h1>
          <p className="text-sm text-white/60 mt-2">Gestão de médicos, usuários e configurações.</p>
        </div>
        {user ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm break-all">Conectado como <strong>{user.email}</strong></p>
            <p className="text-sm text-white/65">Esta conta não possui permissão de administrador. Entre com a conta do proprietário. Recuperar a senha não concede essa permissão.</p>
            <Button className="w-full" disabled={submitting} onClick={switchAccount}>Sair e usar outra conta</Button>
          </div>
        ) : sent ? (
          <div role="status" className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm">Se houver uma conta elegível para este e-mail, você receberá um link para escolher uma nova senha. Confira também o spam.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">E-mail do proprietário</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
            </div>
            {!forgot && <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">Senha</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-white/5 border-white/10 text-white" />
            </div>}
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Aguarde…" : forgot ? "Enviar link para redefinir senha" : "Entrar no painel"}</Button>
          </form>
        )}
        {!user && <button type="button" className="block mx-auto text-sm text-white/75 underline" onClick={() => { setForgot(!forgot); setSent(false); }}>{forgot ? "Voltar ao login" : "Esqueci minha senha"}</button>}
        <p className="text-xs text-white/50 text-center">O administrador usa uma conta com permissão concedida no banco. Não existe senha padrão.</p>
        <nav className="flex justify-center gap-5 text-sm text-white/70"><Link to="/auth">App do paciente</Link><Link to="/pro/auth">Portal do médico</Link></nav>
      </div>
    </div>
  );
}
