import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useBloodPressure, useWeight } from "@/hooks/useCardioReadings";
import { useMedicoVinculado } from "@/hooks/useMarcaClinica";
import { getDevBypass } from "@/contexts/DevBypass";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SurfaceCard, StatCard, StatusBadge } from "@/components/shell";
import { TelaPaciente, TituloSecao } from "@/components/shell";
import { DataPrivacySection } from "@/components/DataPrivacySection";
import { LinkDoctorCard } from "@/components/LinkDoctorCard";
import { ConsentimentosSection } from "@/components/paciente/ConsentimentosSection";
import { Button } from "@/components/ui/button";
import {
  Stethoscope, Watch, LogOut, BadgeCheck, SlidersHorizontal, ChevronRight,
  Camera, Users, Pencil,
} from "lucide-react";
import { calcularIMC, idadeEmAnos } from "@/lib/clinical/scores";
import {
  SEXO_LABEL, iniciais, rotulosComorbidades, rotulosHistoria, alergiasEmLista,
} from "@/lib/cadastroPaciente";

const TAMANHO_MAX_FOTO = 2 * 1024 * 1024;

/**
 * MINHA CONTA — perfil do paciente (espírito do PatientHub, shell deste app).
 *
 * ── Divisão de responsabilidade ───────────────────────────────────────
 *   /conta         → quem eu sou, ficha clínica, equipe, privacidade
 *   /configuracoes → notificações, aparência, acessibilidade
 *
 * Editar cadastro reabre o wizard em /onboarding?editar=1 — não um formulário
 * só de nome/telefone/altura.
 */
export default function ContaPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profile, updateProfile } = useProfile();
  const { data: patient } = useCardioPatient();
  const { ativas } = useCardioMedications();
  const { ultimo: ultimoPeso } = useWeight();
  const { ultima: ultimaPa } = useBloodPressure();
  const { medico: medicoAtivo, isLoading: carregandoMedicos } = useMedicoVinculado();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  const emailVisivel = getDevBypass()?.email ?? user?.email ?? "—";
  const nome = patient?.full_name ?? profile?.full_name ?? "";
  const idade = idadeEmAnos(patient?.birth_date ?? profile?.birth_date ?? null);
  const sexo = patient?.sex ?? profile?.sex ?? null;
  const altura = patient?.height_cm ?? profile?.height_cm ?? null;
  const pesoKg = ultimoPeso?.value ?? null;
  const imc = pesoKg && altura ? calcularIMC(pesoKg, altura) : null;
  const cadastroAberto = !profile?.onboarding_completed;
  const foto = profile?.avatar_url;
  const alergias = alergiasEmLista(patient?.allergies);
  const condicoes = [...rotulosComorbidades(patient?.comorbidities), ...rotulosHistoria(patient?.history)];
  const remedios = ativas.map((m) => (m.dose ? `${m.name} ${m.dose}` : m.name));

  const handleFoto = async (file: File | undefined) => {
    if (!file || !user) return;
    if (getDevBypass()) {
      toast.info("Modo demo: nada é salvo.");
      return;
    }
    if (file.size > TAMANHO_MAX_FOTO) {
      toast.error("A foto precisa ter no máximo 2 MB.");
      return;
    }
    setEnviandoFoto(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) {
        toast.info("Não foi possível enviar a foto agora. Continuamos com as iniciais.");
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await updateProfile.mutateAsync({ avatar_url: `${data.publicUrl}?t=${Date.now()}` });
    } catch {
      toast.info("Não foi possível enviar a foto agora. Continuamos com as iniciais.");
    } finally {
      setEnviandoFoto(false);
    }
  };

  return (
    <TelaPaciente>
      <PageHeader title="Minha conta" subtitle="Seus dados, sua equipe de cuidado e sua privacidade" />

      <SurfaceCard>
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => inputFoto.current?.click()}
            disabled={enviandoFoto}
            className="relative h-16 w-16 rounded-2xl bg-primary text-primary-foreground grid place-items-center text-xl font-semibold shrink-0 overflow-hidden"
            aria-label="Alterar foto"
          >
            {foto ? (
              <img src={foto} alt="" className="h-full w-full object-cover" />
            ) : (
              iniciais(nome)
            )}
            <span className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-xl bg-card text-primary grid place-items-center">
              <Camera className="h-3.5 w-3.5" aria-hidden />
            </span>
          </button>
          <input
            ref={inputFoto}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => { void handleFoto(e.target.files?.[0]); e.target.value = ""; }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-medium tracking-tight text-foreground">{nome || "Paciente"}</h2>
              <StatusBadge variant={cadastroAberto ? "pendente" : "concluido"}>
                {cadastroAberto ? "Cadastro em aberto" : "Acompanhamento ativo"}
              </StatusBadge>
            </div>
            <p className="text-base text-muted-foreground mt-1">
              {[idade != null ? `${idade} anos` : null, sexo ? SEXO_LABEL[sexo] : null]
                .filter(Boolean)
                .join(" · ") || "Complete seu cadastro"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 break-words">{emailVisivel}</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate("/onboarding?editar=1")}>
              <Pencil className="h-4 w-4" aria-hidden /> Editar cadastro
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Peso" value={pesoKg != null ? `${pesoKg} kg` : "—"} />
        <StatCard label="Altura" value={altura != null ? `${altura} cm` : "—"} />
        <StatCard label="IMC" value={imc != null ? String(imc) : "—"} />
        <StatCard
          label="Última pressão"
          value={ultimaPa ? `${ultimaPa.systolic}/${ultimaPa.diastolic}` : "—"}
        />
      </div>

      {(alergias.length > 0 || condicoes.length > 0 || remedios.length > 0) && (
        <div className="space-y-3">
          {alergias.length > 0 && (
            <SurfaceCard>
              <p className="text-xs font-semibold uppercase tracking-wider text-error mb-2">Alergias</p>
              <div className="flex flex-wrap gap-1.5">
                {alergias.map((a) => (
                  <span key={a} className="inline-flex min-h-[36px] items-center rounded-full bg-error-bg px-3 text-sm font-medium text-error">
                    {a}
                  </span>
                ))}
              </div>
            </SurfaceCard>
          )}
          {condicoes.length > 0 && (
            <SurfaceCard>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Condições</p>
              <div className="flex flex-wrap gap-1.5">
                {condicoes.map((c) => (
                  <span key={c} className="inline-flex min-h-[36px] items-center rounded-full bg-secondary px-3 text-sm font-medium text-foreground">
                    {c}
                  </span>
                ))}
              </div>
            </SurfaceCard>
          )}
          {remedios.length > 0 && (
            <SurfaceCard>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Remédios</p>
              <div className="flex flex-wrap gap-1.5">
                {remedios.map((r) => (
                  <span key={r} className="inline-flex min-h-[36px] items-center rounded-full bg-cardio-50 px-3 text-sm font-medium text-cardio-dark">
                    {r}
                  </span>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
      )}

      <section>
        <TituloSecao titulo="Meu médico" />
        {carregandoMedicos ? (
          <SurfaceCard><p className="text-base text-muted-foreground">Carregando...</p></SurfaceCard>
        ) : medicoAtivo ? (
          <SurfaceCard>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-foreground truncate flex items-center gap-1.5">
                  {medicoAtivo.nome}
                  {medicoAtivo.verificado && <BadgeCheck className="h-5 w-5 text-primary shrink-0" aria-label="Perfil verificado" />}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">{medicoAtivo.clinica || "Cardiologista"}</p>
              </div>
            </div>
          </SurfaceCard>
        ) : (
          <LinkDoctorCard />
        )}
      </section>

      <SurfaceCard variant="interactive" onClick={() => navigate("/cuidadores")} ariaLabel="Quem cuida de mim">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
            <Users className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-base font-semibold text-foreground">Quem cuida de mim</p>
            <p className="text-sm text-muted-foreground mt-0.5">Familiares e cuidadores com acesso</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
        </div>
      </SurfaceCard>

      <SurfaceCard variant="interactive" onClick={() => navigate("/pulseira")} ariaLabel="Meus dispositivos">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
            <Watch className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-base font-semibold text-foreground">Dispositivos</p>
            <p className="text-sm text-muted-foreground mt-0.5">Pulseira, aparelho de pressão e balança</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
        </div>
      </SurfaceCard>

      <ConsentimentosSection />

      <div id="privacidade" className="scroll-mt-24">
        <DataPrivacySection />
      </div>

      <SurfaceCard variant="interactive" onClick={() => navigate("/configuracoes")} ariaLabel="Preferências do app">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
            <SlidersHorizontal className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-base font-semibold text-foreground">Preferências</p>
            <p className="text-sm text-muted-foreground mt-0.5">Notificações, letra maior e mais contraste</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
        </div>
      </SurfaceCard>

      <Button variant="outline" size="xl" className="w-full" onClick={signOut}>
        <LogOut className="h-5 w-5" aria-hidden /> Sair da conta
      </Button>
    </TelaPaciente>
  );
}
