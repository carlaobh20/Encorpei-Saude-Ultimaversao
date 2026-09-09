/**
 * MINHA CONTA — perfil profissional, plano atual, limite de pacientes e
 * exibição dos limiares padrão de alerta (personalização por paciente fica
 * na tela do paciente — os limiares aqui são só leitura).
 */
import { useState } from "react";
import { LogOut, MessageSquarePlus, Pencil, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalProfile, useProfessionalPatients } from "@/hooks/useProfessional";
import { ALERT_RULES } from "@/lib/clinical/cardioAlertRules";

const SPECIALTY_LABELS: Record<string, string> = {
  cardiologist: "Cardiologista", clinician: "Clínico geral", nurse: "Enfermagem", nutritionist: "Nutricionista",
};
const PLAN_LABELS: Record<string, string> = {
  starter: "Starter", pro: "Pro", clinic: "Clínica", clinica: "Clínica",
};

function initials(name?: string | null) {
  return (name ?? "Dr").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function ProAccountPage() {
  const { profile, salvar } = useProfessionalProfile();
  const { contagem } = useProfessionalPatients();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ display_name: "", clinic_name: "" });

  const openEdit = () => {
    setForm({ display_name: profile?.display_name ?? "", clinic_name: profile?.clinic_name ?? "" });
    setEditOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[760px] px-5 md:px-8 py-6 md:py-8">
      <PageHeader title="Minha conta" subtitle="Perfil profissional e preferências" />

      {profile && (
        <>
          <SurfaceCard className="mb-4">
            <div className="flex items-center gap-4 pb-4 border-b border-border">
              <div className="h-16 w-16 rounded-full grid place-items-center text-white text-base font-semibold bg-gradient-to-br from-primary to-cardio-dark shrink-0">
                {initials(profile.display_name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-medium text-foreground truncate">{profile.display_name}</p>
                <p className="text-sm text-muted-foreground">{SPECIALTY_LABELS[profile.specialty] ?? profile.specialty}</p>
                {profile.registration_number && (
                  <p className="text-xs text-muted-foreground mt-0.5">CRM {profile.registration_number}/{profile.registration_state}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Editar</Button>
            </div>
            {profile.clinic_name && (
              <p className="text-sm text-foreground pt-3">{profile.clinic_name}</p>
            )}
          </SurfaceCard>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Plano atual" value={PLAN_LABELS[profile.plan_type] ?? profile.plan_type} icon={Users} />
            <StatCard label="Limite de pacientes" value={`${contagem.total} / ${profile.max_patients ?? "∞"}`} icon={Users} />
          </div>

          <SectionHeader title="Limiares padrão de alerta" subtitle="a régua clínica que dispara alertas — docs §2.6" />
          <p className="text-xs text-muted-foreground mb-3">
            Estes são os padrões do sistema. A personalização por paciente (sobrepor um limiar específico) fica
            na tela de cada paciente — aqui é só consulta.
          </p>
          <div className="rounded-2xl border border-border overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Alerta</th><th className="text-left px-3 py-2">Limiar padrão</th><th className="text-left px-3 py-2">Severidade</th></tr>
              </thead>
              <tbody>
                {Object.values(ALERT_RULES).map((r) => (
                  <tr key={r.code} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{r.label}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.defaultThreshold}</td>
                    <td className="px-3 py-2 text-xs capitalize">{r.severity === "emergency" ? "Emergência" : r.severity === "critical" ? "Crítico" : r.severity === "warning" ? "Atenção" : "Informativo"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" className="w-full mb-2.5" onClick={() => navigate("/pro/feedback")}>
            <MessageSquarePlus className="h-4 w-4" /> Enviar feedback
          </Button>
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4" /> Sair da conta
          </Button>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Nome de exibição</Label><Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Clínica</Label><Input value={form.clinic_name} onChange={(e) => setForm((f) => ({ ...f, clinic_name: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              disabled={salvar.isPending}
              onClick={() => salvar.mutate(form, { onSuccess: () => setEditOpen(false) })}
            >
              {salvar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
