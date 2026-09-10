/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MARCA DA CLÍNICA — white label do lado do médico.
 *
 * O que ele configura aqui aparece no app dos pacientes DELE: cabeçalho,
 * tela de convite e cabeçalho dos relatórios. O ícone do app instalado
 * continua sendo o da plataforma — ver useMarcaClinica.ts para o porquê.
 */

import { useEffect, useRef, useState } from "react";
import { Upload, Check } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfessionalProfile } from "@/hooks/useProfessional";
import { getDevBypass } from "@/contexts/DevBypass";

const CORES = ["#C8102E", "#B91C1C", "#0F766E", "#1D4ED8", "#7C3AED", "#0F172A"];

export default function ProMarcaPage() {
  const { user } = useAuth();
  const { profile, refetch } = useProfessionalProfile() as any;
  const demo = !!getDevBypass();
  const fileRef = useRef<HTMLInputElement>(null);

  const [clinica, setClinica] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [site, setSite] = useState("");
  const [cor, setCor] = useState<string>(CORES[0]);
  const [logo, setLogo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setClinica(profile.clinic_name ?? "");
    setSubtitulo(profile.clinic_subtitle ?? "");
    setTelefone(profile.clinic_phone ?? "");
    setEndereco(profile.clinic_address ?? "");
    setSite(profile.clinic_site ?? "");
    setCor(profile.clinic_brand_color ?? CORES[0]);
    setLogo(profile.clinic_logo_url ?? null);
  }, [profile]);

  async function subirLogo(file: File) {
    if (demo) { toast.info("No modo demonstração o envio fica só na tela."); setLogo(URL.createObjectURL(file)); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A imagem precisa ter menos de 2 MB."); return; }
    const ext = file.name.split(".").pop() || "png";
    const path = `${user!.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("clinic-logos").upload(path, file, { upsert: true });
    if (error) { toast.error("Não consegui enviar a imagem."); return; }
    const { data } = supabase.storage.from("clinic-logos").getPublicUrl(path);
    setLogo(data.publicUrl);
    toast.success("Logo enviada. Não esqueça de salvar.");
  }

  async function salvar() {
    setSalvando(true);
    try {
      if (demo) { toast.success("Salvo (demonstração)."); return; }
      const { error } = await (supabase as any)
        .from("professional_profiles")
        .update({
          clinic_name: clinica.trim() || null,
          clinic_subtitle: subtitulo.trim() || null,
          clinic_phone: telefone.trim() || null,
          clinic_address: endereco.trim() || null,
          clinic_site: site.trim() || null,
          clinic_brand_color: cor,
          clinic_logo_url: logo,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
      await refetch?.();
      toast.success("Marca atualizada. Seus pacientes já vão ver.");
    } catch {
      toast.error("Não consegui salvar agora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <PageHeader
        title="Marca da clínica"
        subtitle="Como sua clínica aparece no aplicativo dos seus pacientes."
      />

      <SurfaceCard>
        <p className="text-sm font-medium mb-3">Logo</p>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-xl border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
            {logo ? <img src={logo} alt="Logo" className="h-full w-full object-contain" />
                  : <span className="text-xs text-muted-foreground">sem logo</span>}
          </div>
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && subirLogo(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" /> Enviar imagem
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              PNG ou SVG, quadrada, até 2 MB. Fundo transparente fica melhor.
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Nome da clínica</span>
          <Input value={clinica} onChange={(e) => setClinica(e.target.value)} placeholder="Marcelo Puzzi" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Linha de apoio</span>
          <Input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} placeholder="Cardiologista Intervencionista" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Telefone</span>
          <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(41) 0000-0000" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Endereço</span>
          <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} className="mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Site</span>
          <Input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" className="mt-1" />
        </label>
      </SurfaceCard>

      <SurfaceCard>
        <p className="text-sm font-medium mb-3">Cor de destaque</p>
        <div className="flex flex-wrap gap-2">
          {CORES.map((c) => (
            <button
              key={c}
              onClick={() => setCor(c)}
              style={{ background: c }}
              className="h-10 w-10 rounded-full flex items-center justify-center ring-offset-2 ring-offset-background"
              aria-label={`Cor ${c}`}
            >
              {cor === c ? <Check className="h-5 w-5 text-white" strokeWidth={3} /> : null}
            </button>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard>
        <p className="text-sm font-medium mb-2">Como o paciente vai ver</p>
        <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-2">
          {logo ? <img src={logo} alt="" className="h-8 w-8 rounded-md object-contain" /> : null}
          <div className="leading-tight">
            <p className="text-[13px] font-semibold">{clinica || "Nome da clínica"}</p>
            {subtitulo ? <p className="text-[10px] text-muted-foreground">{subtitulo}</p> : null}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          O ícone do aplicativo instalado no celular continua sendo o da plataforma —
          um aplicativo tem um ícone só por endereço. Dentro dele, a assinatura é sua.
        </p>
      </SurfaceCard>

      <Button onClick={salvar} disabled={salvando} className="w-full h-12">
        {salvando ? "Salvando…" : "Salvar marca"}
      </Button>
    </div>
  );
}
