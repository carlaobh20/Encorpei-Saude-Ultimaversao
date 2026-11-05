import { HealthPlatformsPanel } from "@/components/hoje/HealthPlatformsPanel";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Smartphone, Watch } from "lucide-react";
import { PageHeader, SurfaceCard, TelaPaciente } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useWearableSync } from "@/hooks/useWearableSync";
import { importarAppleXml, importarContrato, prepararLinhas, type Plataforma, type PreviaSaude } from "@/lib/health/import";

export default function IntegracoesPage() {
  const { importar, progresso, demo } = useWearableSync();
  const [platform,setPlatform] = useState<Plataforma>("apple_health");
  const [preview,setPreview] = useState<PreviaSaude|null>(null);
  const [source,setSource] = useState("");
  const [desde,setDesde] = useState(new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const [ate,setAte] = useState(new Date().toISOString().slice(0,10));
  const [consent,setConsent] = useState(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const prepared = preview ? prepararLinhas(preview,source,desde,ate) : null;
  const label = platform === "apple_health" ? "Apple Saúde" : "Health Connect";
  async function ler(file?: File) {
    setPreview(null); setSource(""); setConsent(false); setMessage("");
    if (!file) return;
    setBusy(true);
    try {
      if (file.size>25*1024*1024) throw Error("Limite de 25 MB por arquivo nesta versão.");
      if (file.name.toLowerCase().endsWith(".zip")) throw Error("Descompacte o ZIP e selecione o arquivo export.xml.");
      const text=await file.text();
      const result=platform === "apple_health" ? importarAppleXml(text) : importarContrato(text);
      if (!result.samples.length) throw Error("Nenhum registro compatível foi encontrado.");
      setPreview(result); setSource(result.sources.length===1?result.sources[0]:"");
    } catch(e) { setMessage(e instanceof Error?e.message:"Não foi possível ler o arquivo."); }
    finally {setBusy(false);}
  }
  async function salvar() {
    if (!prepared?.linhas.length || !consent || demo || busy || desde>ate) return;
    setBusy(true); setMessage("");
    try {
      const result=await importar(prepared.linhas,{deviceName:`${label} · ${source}`,category:platform,protocolo:"import",vitalTypes:[...new Set(preview!.samples.filter(a=>a.source===source).map(a=>a.type))]});
      setMessage(`${result.importados} registros salvos; ${result.ignorados} já existentes ou ignorados; ${result.falhas} falhas.${result.falhas ? " Alguns dados não foram salvos. Você pode tentar novamente." : ""}`);
      if (!result.falhas) { setPreview(null); setConsent(false); }
    } catch {setMessage("Não foi possível salvar. Confira sua conexão e tente novamente.");}
    finally {setBusy(false);}
  }
  return <TelaPaciente>
    <PageHeader title="Aparelhos e plataformas" subtitle="Seus dados de saúde, com a origem identificada" backLink="/configuracoes" />
    <HealthPlatformsPanel />
    <div className="grid gap-3 sm:grid-cols-3 mt-5">
      {[{icon:Heart,title:"Apple Saúde e Watch",text:"Importe registros exportados pelo Apple Saúde. Sincronização automática requer integração nativa no iPhone."},
        {icon:Smartphone,title:"Health Connect · Android",text:"Leitura preparada para a versão nativa, após ativação no servidor. O app do relógio precisa compartilhar os dados com o Health Connect."},
        {icon:Watch,title:"Outros aparelhos",text:"A compatibilidade depende dos dados que o fabricante disponibiliza. Um relógio conectado não garante acesso a todas as medidas."}].map(({icon:Icon,title,text})=><SurfaceCard key={title} className="p-4"><Icon className="h-5 w-5 text-primary mb-3" aria-hidden/><h2 className="text-base font-semibold">{title}</h2><p className="text-sm text-muted-foreground mt-2">{text}</p></SurfaceCard>)}
    </div>
    <SurfaceCard className="p-5 space-y-4 mt-5">
      <h2 className="text-lg font-semibold">Importar meus dados</h2>
      <p className="text-sm text-muted-foreground">Nesta versão: batimentos, oxigenação, passos, calorias ativas e duração do sono, quando presentes no arquivo. Nenhuma medida ausente é inventada. Importar um arquivo não ativa sincronização automática.</p>
      <label className="block text-sm font-medium">Origem do arquivo<select className="mt-2 w-full rounded-xl border border-input bg-background p-3" value={platform} disabled={busy} onChange={e=>{setPlatform(e.target.value as Plataforma);setPreview(null);setMessage("");setConsent(false);}}><option value="apple_health">Apple Saúde · export.xml</option><option value="health_connect">Integração Android · JSON padronizado</option></select></label>
      <p className="text-sm text-muted-foreground">{platform==="apple_health"?"No iPhone: Saúde → foto do perfil → Exportar Todos os Dados de Saúde. Descompacte o arquivo e selecione export.xml. Limite: 25 MB e 100 mil registros." : "Entrada destinada a um adaptador Android que gere o formato Encorpei. Não aceita o backup comum do Health Connect. A leitura nativa requer instalação e ativação do servidor; envio com o app fechado ainda não está disponível."}</p>
      <label className="block text-sm font-medium">Escolher arquivo<input key={platform} type="file" accept={platform==="apple_health"?".xml":".json"} disabled={busy} onChange={e=>void ler(e.target.files?.[0])} className="block w-full mt-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-3 file:text-foreground" /></label>
      {preview && <div className="space-y-4 border-t border-border pt-4">
        <label className="block text-sm font-medium">Aparelho ou aplicativo de origem<select className="w-full mt-2 rounded-xl border border-input bg-background p-3" value={source} disabled={busy} onChange={e=>{setSource(e.target.value);setConsent(false);}}><option value="">Selecione uma origem</option>{preview.sources.map(s=><option key={s}>{s}</option>)}</select></label>
        <p className="text-sm text-muted-foreground">Escolha uma origem por vez para evitar somar celular e relógio. Dias de atividade já salvos não são substituídos.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[{label:"De",value:desde,set:setDesde},{label:"Até",value:ate,set:setAte}].map(f=><label key={f.label} className="text-sm">{f.label}<input type="date" value={f.value} disabled={busy} onChange={e=>f.set(e.target.value)} className="block w-full min-w-0 mt-1 p-3 rounded-xl border border-input bg-background" /></label>)}</div>
        <p className="text-sm">{prepared?.linhas.length ?? 0} registros preparados para o período. {preview.ignored} amostras inválidas, duplicadas ou não suportadas no arquivo. {prepared?.ignored ?? 0} amostras descartadas na seleção por sobreposição ou dia incompleto.</p>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)} className="mt-1"/>Confirmo que estes dados são meus e quero adicioná-los ao meu histórico, disponível ao médico vinculado.</label>
        <Button onClick={()=>void salvar()} disabled={busy||demo||!consent||!source||!desde||!ate||desde>ate||!prepared?.linhas.length}>{busy?`Salvando ${progresso.feitos}/${progresso.total}`:"Salvar no meu histórico"}</Button>
      </div>}
      {demo && <p className="text-sm text-muted-foreground">Demonstração: a prévia funciona, mas nenhum dado é salvo.</p>}
      <p role="status" aria-live="polite" className="text-sm">{message || (busy?"Processando…":"")}</p>
    </SurfaceCard>
    <p className="text-sm text-muted-foreground mt-4">As medidas importadas preservam a origem e não são consideradas clinicamente validadas apenas por virem de um relógio.</p>
    <Link to="/pulseira" className="inline-block text-primary underline mt-4">Pulseira H59MAX, Bluetooth e CSV</Link>
  </TelaPaciente>;
}
