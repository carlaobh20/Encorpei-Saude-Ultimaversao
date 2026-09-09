/**
 * Vincular médico — o paciente digita o código de convite do médico.
 */
import { useState } from "react";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";

export function LinkDoctorCard({ onLinked }: { onLinked?: () => void }) {
  const { acceptInvite } = useMyProfessionals();
  const { toast } = useToast();
  const [code, setCode] = useState("");

  const submit = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      toast({ title: "Digite o código do seu médico", variant: "destructive" });
      return;
    }
    try {
      await acceptInvite.mutateAsync(c);
      toast({ title: "Médico vinculado!", description: "Agora vocês estão conectados." });
      setCode("");
      onLinked?.();
    } catch (e: any) {
      toast({ title: "Não foi possível vincular", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-3xl bg-card border border-border shadow-card p-7 text-center max-w-md mx-auto">
      <div className="mx-auto h-16 w-16 rounded-full bg-secondary grid place-items-center mb-4">
        <Stethoscope className="h-7 w-7 text-primary" strokeWidth={1.5} />
      </div>
      <h2 className="font-display text-2xl font-medium text-foreground leading-tight">Conecte-se ao seu médico</h2>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Seu médico vai te passar um código de 6 caracteres. Digite abaixo para
        vincular sua conta e começar o acompanhamento.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Ex: A4F9KP"
          maxLength={8}
          className="text-center text-lg font-mono tracking-[0.3em] h-12"
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <Button onClick={submit} disabled={acceptInvite.isPending} className="h-11">
          {acceptInvite.isPending ? "Vinculando..." : "Vincular médico"}
        </Button>
      </div>
    </div>
  );
}
