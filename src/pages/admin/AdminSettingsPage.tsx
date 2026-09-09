import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: "Senha atualizada!" });
      setPassword("");
      setConfirm("");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[480px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-white/50 mt-1">{user?.email}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-medium text-white">Trocar senha de acesso</p>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-white/70">Nova senha</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-white/5 border-white/10 text-white" minLength={6} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm" className="text-white/70">Confirmar nova senha</Label>
          <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="bg-white/5 border-white/10 text-white" minLength={6} required />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
