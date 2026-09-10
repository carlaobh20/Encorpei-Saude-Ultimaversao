import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCardioPatient, useSalvarCardioPatient } from "@/hooks/useCardioPatient";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { PageHeader, SurfaceCard } from "@/components/shell";
import { DataPrivacySection } from "@/components/DataPrivacySection";
import { LinkDoctorCard } from "@/components/LinkDoctorCard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stethoscope, Watch, LogOut, Loader2, Pencil, Check, X, BadgeCheck, SlidersHorizontal, ChevronRight } from "lucide-react";
import { idadeEmAnos } from "@/lib/clinical/scores";

const SEXO_LABEL: Record<string, string> = { male: "Masculino", female: "Feminino" };

/**
 * MINHA CONTA — quem o paciente é e o que é dele.
 *
 * ── Divisão de responsabilidade (auditoria de setembro/2026) ───────────
 * Esta tela e /configuracoes se sobrepunham: dois nomes genéricos
 * ("Minha Conta" e "Configurações") para um paciente de 68 anos decidir
 * onde procurar. Passaram a responder perguntas diferentes:
 *   /conta         → cadastro, médico vinculado, dispositivos, privacidade
 *   /configuracoes → "Preferências": notificações, aparência, acessibilidade
 *
 * Nada foi removido: o que mudou é que cada função aparece em UM lugar, com
 * UM nome. O cartão no fim desta tela é só a ponte para as Preferências.
 */
export default function ContaPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { data: patient } = useCardioPatient();
  const salvar = useSalvarCardioPatient();
  const { professionals, isLoading: carregandoMedicos } = useMyProfessionals();

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [altura, setAltura] = useState("");

  useEffect(() => {
    if (!editando) {
      setNome(patient?.full_name ?? profile?.full_name ?? "");
      setTelefone(patient?.phone ?? profile?.phone ?? "");
      setAltura(patient?.height_cm != null ? String(patient.height_cm) : "");
    }
  }, [editando, patient, profile]);

  const idade = idadeEmAnos(patient?.birth_date ?? profile?.birth_date ?? null);

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("O nome não pode ficar em branco.");
      return;
    }
    try {
      await salvar.mutateAsync({
        full_name: nome.trim(),
        phone: telefone.trim() || null,
        height_cm: altura ? Number(altura) : null,
      });
      setEditando(false);
    } catch {
      // erro já mostrado pelo toastError dentro do hook
    }
  };

  const medicoAtivo = professionals.find((p) => p.status === "active");

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <PageHeader title="Minha conta" subtitle="Seus dados, sua equipe de cuidado e sua privacidade" />

      {/* Dados pessoais */}
      <SurfaceCard>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-medium tracking-tight text-foreground">Dados pessoais</h2>
          {!editando ? (
            <Button variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditando(false)} disabled={salvar.isPending}>
                <X className="h-4 w-4" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSalvar} disabled={salvar.isPending}>
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
              </Button>
            </div>
          )}
        </div>

        {editando ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} className="h-12 rounded-2xl text-base" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" className="h-12 rounded-2xl text-base" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Altura (cm)</Label>
              <Input value={altura} onChange={(e) => setAltura(e.target.value)} type="number" inputMode="numeric" className="h-12 rounded-2xl text-base" />
            </div>
          </div>
        ) : (
          <dl className="divide-y divide-border">
            {[
              { label: "Nome", value: nome || "—" },
              { label: "Idade", value: idade != null ? `${idade} anos` : "—" },
              { label: "Sexo biológico", value: patient?.sex ? SEXO_LABEL[patient.sex] : "—" },
              { label: "Altura", value: altura ? `${altura} cm` : "—" },
              { label: "Telefone", value: telefone || "—" },
              { label: "E-mail", value: user?.email ?? "—" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-medium text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </SurfaceCard>

      {/* Meu cardiologista */}
      <div>
        <h2 className="font-display text-lg font-medium tracking-tight text-foreground mb-3 px-1">Meu cardiologista</h2>
        {carregandoMedicos ? (
          <SurfaceCard><p className="text-sm text-muted-foreground">Carregando...</p></SurfaceCard>
        ) : medicoAtivo ? (
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                  {medicoAtivo.display_name}
                  {medicoAtivo.is_verified && <BadgeCheck className="h-4 w-4 text-primary shrink-0" />}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{medicoAtivo.clinic_name || "Cardiologista"}</p>
              </div>
            </div>
          </SurfaceCard>
        ) : (
          <LinkDoctorCard />
        )}
      </div>

      {/* Dispositivos */}
      <SurfaceCard variant="interactive" onClick={() => navigate("/pulseira")} ariaLabel="Meus dispositivos">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
            <Watch className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">Dispositivos</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pulseira, aparelho de pressão e balança</p>
          </div>
        </div>
      </SurfaceCard>

      {/* Privacidade e LGPD — casa única da exportação/exclusão de dados.
          O id ancora o link "/conta#privacidade" vindo das Preferências;
          scroll-mt compensa o cabeçalho fixo do AppShell. */}
      <div id="privacidade" className="scroll-mt-24">
        <DataPrivacySection />
      </div>

      {/* Ponte para as Preferências — atalho, não duplicata: nenhum ajuste de
          notificação ou de letra grande é executado nesta tela. */}
      <SurfaceCard variant="interactive" onClick={() => navigate("/configuracoes")} ariaLabel="Preferências do app">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
            <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-semibold text-foreground">Preferências</p>
            <p className="text-xs text-muted-foreground mt-0.5">Notificações, letra maior e mais contraste</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>
      </SurfaceCard>

      <Button variant="outline" className="w-full h-12 rounded-2xl" onClick={signOut}>
        <LogOut className="h-4 w-4" /> Sair da conta
      </Button>
    </div>
  );
}
