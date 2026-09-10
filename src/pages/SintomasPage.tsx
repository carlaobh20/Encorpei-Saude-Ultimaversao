/**
 * SintomasPage — registrar sintoma.
 *
 * REGRA CRÍTICA (docs §2.3 e contrato regra 3): dor no peito em repouso com
 * duração acima de 10 minutos, ou desmaio, não vira registro para o médico
 * ver depois — a tela redireciona na hora para /emergencia.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  HeartCrack, Wind, Activity, Droplets, PersonStanding, Footprints,
  Stethoscope, BatteryLow, Gauge, ChevronLeft, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSymptoms } from "@/hooks/useCardioClinical";
import { classificarNyha, NYHA_DESCRICAO } from "@/lib/clinical/scores";
import type { SymptomType } from "@/types/cardio";

interface SymptomDef {
  type: SymptomType;
  label: string;
  icon: typeof HeartCrack;
}

const SINTOMAS: SymptomDef[] = [
  { type: "chest_pain", label: "Dor no peito", icon: HeartCrack },
  { type: "dyspnea", label: "Falta de ar", icon: Wind },
  { type: "palpitations", label: "Palpitação (coração disparado)", icon: Activity },
  { type: "edema", label: "Inchaço nas pernas", icon: Droplets },
  { type: "syncope", label: "Desmaio", icon: PersonStanding },
  { type: "presyncope", label: "Quase desmaiei", icon: PersonStanding },
  { type: "claudication", label: "Dor na perna ao andar", icon: Footprints },
  { type: "dry_cough", label: "Tosse seca", icon: Stethoscope },
  { type: "fatigue", label: "Cansaço fora do comum", icon: BatteryLow },
  { type: "dizziness", label: "Tontura", icon: Gauge },
];

function Botao({ pressionado, onClick, children }: { pressionado: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 px-4 rounded-xl border text-sm font-semibold transition-colors",
        pressionado ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export default function SintomasPage() {
  const navigate = useNavigate();
  const { registrar } = useSymptoms();
  const [selecionado, setSelecionado] = useState<SymptomType | null>(null);

  // Dor no peito
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [duracao, setDuracao] = useState("");
  const [gatilho, setGatilho] = useState<"effort" | "rest" | "emotion" | null>(null);
  const [irradiacao, setIrradiacao] = useState("");
  const [associados, setAssociados] = useState<string[]>([]);

  // Falta de ar
  const [repouso, setRepouso] = useState(false);
  const [esforcoLeve, setEsforcoLeve] = useState(false);
  const [atividadeHabitual, setAtividadeHabitual] = useState(false);
  const [travesseiros, setTravesseiros] = useState("1");
  const [dpn, setDpn] = useState(false);

  // Palpitação
  const [inicioSubito, setInicioSubito] = useState<boolean | null>(null);
  const [ritmoRegular, setRitmoRegular] = useState<boolean | null>(null);
  const [duracaoPalpitacao, setDuracaoPalpitacao] = useState("");

  // Inchaço
  const [localEdema, setLocalEdema] = useState<string | null>(null);
  const [cacifo, setCacifo] = useState<boolean | null>(null);
  const [periodo, setPeriodo] = useState<string | null>(null);

  // Claudicação
  const [distancia, setDistancia] = useState("");

  // Genérico (tontura, cansaço, tosse, presíncope)
  const [intensidade, setIntensidade] = useState("5");
  const [notas, setNotas] = useState("");

  const limpar = () => {
    setSelecionado(null);
    setLocal(""); setTipo(null); setDuracao(""); setGatilho(null); setIrradiacao(""); setAssociados([]);
    setRepouso(false); setEsforcoLeve(false); setAtividadeHabitual(false); setTravesseiros("1"); setDpn(false);
    setInicioSubito(null); setRitmoRegular(null); setDuracaoPalpitacao("");
    setLocalEdema(null); setCacifo(null); setPeriodo(null);
    setDistancia(""); setIntensidade("5"); setNotas("");
  };

  const toggleAssociado = (s: string) =>
    setAssociados((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const salvarESeguir = (qualifiers: Record<string, string | number | boolean>, duracaoMin: number | null) => {
    registrar.mutate({
      symptom_type: selecionado!,
      occurred_at: new Date().toISOString(),
      duration_minutes: duracaoMin,
      intensity: selecionado === "fatigue" ? Number(intensidade) : null,
      qualifiers,
      notes: notas.trim() || null,
    });
    toast.success("Registrado. Seu médico consegue ver.");
    limpar();
  };

  // ── Desmaio: emergência imediata, sem formulário, sem fila ──────────
  const escolher = (type: SymptomType) => {
    if (type === "syncope") {
      toast.error("Desmaio é emergência.");
      navigate("/emergencia");
      return;
    }
    setSelecionado(type);
  };

  const enviarDorNoPeito = () => {
    const min = duracao.trim() ? Number(duracao) : null;
    // REGRA CRÍTICA: dor em repouso não vira registro para depois.
    //
    // Duração DESCONHECIDA conta como longa, de propósito. O caso que essa
    // linha protege é o pior possível: alguém com dor torácica em repouso
    // que não sabe (ou não consegue) dizer há quanto tempo. Tratar o campo
    // vazio como "curta" é a única leitura que mata; tratá-lo como longa
    // custa, no máximo, uma tela de emergência a mais.
    if (gatilho === "rest" && (min == null || min > 10)) {
      navigate("/emergencia");
      return;
    }
    salvarESeguir(
      { local, tipo: tipo ?? "", gatilho: gatilho ?? "", irradiacao, associados: associados.join(", ") },
      min
    );
  };

  const nyhaClasse = classificarNyha({
    sintomaEmRepouso: repouso,
    sintomaEsforcoLeve: esforcoLeve,
    sintomaAtividadeHabitual: atividadeHabitual,
  });

  if (selecionado) {
    const def = SINTOMAS.find((s) => s.type === selecionado)!;
    return (
      <div className="pb-10">
        <PageHeader
          title={def.label}
          action={
            <Button variant="ghost" size="icon" onClick={limpar} aria-label="Voltar">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          }
        />

        {selecionado === "chest_pain" && (
          <SurfaceCard className="space-y-4">
            <SurfaceCard className="bg-warning-bg border-0">
              <p className="text-sm text-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                Se a dor está acontecendo agora, não passa e você está em repouso, não espere — vá direto para{" "}
                <button className="underline font-semibold" onClick={() => navigate("/emergencia")}>emergência</button>.
              </p>
            </SurfaceCard>
            <div>
              <Label className="text-xs text-muted-foreground">Onde dói</Label>
              <Input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="ex.: meio do peito" className="h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo de dor</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {["Aperto", "Queimação", "Pontada"].map((t) => (
                  <Botao key={t} pressionado={tipo === t} onClick={() => setTipo(t)}>{t}</Botao>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Há quanto tempo (minutos)</Label>
              <Input inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} className="h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quando começou</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <Botao pressionado={gatilho === "effort"} onClick={() => setGatilho("effort")}>Durante esforço</Botao>
                <Botao pressionado={gatilho === "rest"} onClick={() => setGatilho("rest")}>Em repouso</Botao>
                <Botao pressionado={gatilho === "emotion"} onClick={() => setGatilho("emotion")}>Com emoção/estresse</Botao>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">A dor vai para algum lugar (braço, costas, mandíbula)?</Label>
              <Input value={irradiacao} onChange={(e) => setIrradiacao(e.target.value)} className="h-11 mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sentiu junto com a dor</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {["Suor frio", "Náusea", "Falta de ar"].map((s) => (
                  <Botao key={s} pressionado={associados.includes(s)} onClick={() => toggleAssociado(s)}>{s}</Botao>
                ))}
              </div>
            </div>
            <Button size="xl" className="w-full" onClick={enviarDorNoPeito} disabled={registrar.isPending}>
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "dyspnea" && (
          <SurfaceCard className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Quando você sente falta de ar?</Label>
              <div className="flex flex-col gap-2 mt-1.5">
                <Botao pressionado={atividadeHabitual} onClick={() => setAtividadeHabitual((v) => !v)}>Em atividades do dia a dia (ex.: subir escada)</Botao>
                <Botao pressionado={esforcoLeve} onClick={() => setEsforcoLeve((v) => !v)}>Em esforços leves (ex.: andar em casa)</Botao>
                <Botao pressionado={repouso} onClick={() => setRepouso((v) => !v)}>Mesmo parado, sem fazer nada</Botao>
              </div>
            </div>
            <SurfaceCard className="bg-cardio-50 border-0">
              <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">Classificação (NYHA {nyhaClasse})</p>
              <p className="text-sm text-foreground">{NYHA_DESCRICAO[nyhaClasse]}</p>
            </SurfaceCard>
            <div>
              <Label className="text-xs text-muted-foreground">Quantos travesseiros usa para dormir sem faltar ar?</Label>
              <Input inputMode="numeric" value={travesseiros} onChange={(e) => setTravesseiros(e.target.value.replace(/\D/g, ""))} className="h-11 mt-1 w-24" />
            </div>
            <Botao pressionado={dpn} onClick={() => setDpn((v) => !v)}>Já acordei à noite sem conseguir respirar</Botao>
            <Button
              size="xl" className="w-full" disabled={registrar.isPending}
              onClick={() => salvarESeguir({ nyha: nyhaClasse, travesseiros: Number(travesseiros), dispneia_paroxistica_noturna: dpn }, null)}
            >
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "palpitations" && (
          <SurfaceCard className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Começou de repente ou foi piorando aos poucos?</Label>
              <div className="flex gap-2 mt-1.5">
                <Botao pressionado={inicioSubito === true} onClick={() => setInicioSubito(true)}>De repente</Botao>
                <Botao pressionado={inicioSubito === false} onClick={() => setInicioSubito(false)}>Aos poucos</Botao>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">O batimento estava regular ou desorganizado?</Label>
              <div className="flex gap-2 mt-1.5">
                <Botao pressionado={ritmoRegular === true} onClick={() => setRitmoRegular(true)}>Regular</Botao>
                <Botao pressionado={ritmoRegular === false} onClick={() => setRitmoRegular(false)}>Irregular</Botao>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Quanto tempo durou (minutos)</Label>
              <Input inputMode="numeric" value={duracaoPalpitacao} onChange={(e) => setDuracaoPalpitacao(e.target.value.replace(/\D/g, ""))} className="h-11 mt-1" />
            </div>
            <Button
              size="xl" className="w-full" disabled={registrar.isPending}
              onClick={() => salvarESeguir(
                { inicio_subito: !!inicioSubito, ritmo_regular: !!ritmoRegular },
                duracaoPalpitacao.trim() ? Number(duracaoPalpitacao) : null
              )}
            >
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "edema" && (
          <SurfaceCard className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Onde está inchado?</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {["Tornozelo", "Perna", "Abdome"].map((l) => (
                  <Botao key={l} pressionado={localEdema === l} onClick={() => setLocalEdema(l)}>{l}</Botao>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Se apertar com o dedo, fica marcado?</Label>
              <div className="flex gap-2 mt-1.5">
                <Botao pressionado={cacifo === true} onClick={() => setCacifo(true)}>Sim</Botao>
                <Botao pressionado={cacifo === false} onClick={() => setCacifo(false)}>Não</Botao>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Piora em que período?</Label>
              <div className="flex gap-2 mt-1.5">
                {["Manhã", "Fim do dia"].map((p) => (
                  <Botao key={p} pressionado={periodo === p} onClick={() => setPeriodo(p)}>{p}</Botao>
                ))}
              </div>
            </div>
            <Button
              size="xl" className="w-full" disabled={registrar.isPending}
              onClick={() => salvarESeguir({ local: localEdema ?? "", cacifo: !!cacifo, periodo: periodo ?? "" }, null)}
            >
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "presyncope" && (
          <SurfaceCard className="space-y-4">
            <SurfaceCard className="bg-warning-bg border-0">
              <p className="text-sm text-foreground">Se desmaiar de verdade, pare e procure emergência na hora.</p>
            </SurfaceCard>
            <div>
              <Label className="text-xs text-muted-foreground">Aconteceu fazendo o quê?</Label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {["Esforço", "Ao levantar rápido", "Ao urinar"].map((c) => (
                  <Botao key={c} pressionado={tipo === c} onClick={() => setTipo(c)}>{c}</Botao>
                ))}
              </div>
            </div>
            <Textarea placeholder="Sentiu algum aviso antes (tontura, visão escura, suor)?" value={notas} onChange={(e) => setNotas(e.target.value)} />
            <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({ contexto: tipo ?? "" }, null)}>
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "claudication" && (
          <SurfaceCard className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Quantos metros/quarteirões você anda até a dor aparecer?</Label>
              <Input value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder="ex.: 2 quarteirões" className="h-11 mt-1" />
            </div>
            <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({ distancia }, null)}>
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {selecionado === "dry_cough" && (
          <SurfaceCard className="space-y-4">
            <p className="text-sm text-muted-foreground">Tosse seca pode ser efeito de um dos seus remédios — vale contar ao médico.</p>
            <Textarea placeholder="Quando começou, o que piora ou melhora..." value={notas} onChange={(e) => setNotas(e.target.value)} />
            <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({}, null)}>
              Registrar
            </Button>
          </SurfaceCard>
        )}

        {(selecionado === "fatigue" || selecionado === "dizziness") && (
          <SurfaceCard className="space-y-4">
            {selecionado === "fatigue" && (
              <div>
                <Label className="text-xs text-muted-foreground">De 0 (nada) a 10 (muito forte), quanto cansaço?</Label>
                <Input inputMode="numeric" value={intensidade} onChange={(e) => setIntensidade(e.target.value.replace(/\D/g, ""))} className="h-14 mt-1 w-24 text-2xl font-bold text-center" />
              </div>
            )}
            <Textarea placeholder="Quer contar mais alguma coisa?" value={notas} onChange={(e) => setNotas(e.target.value)} />
            <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({}, null)}>
              Registrar
            </Button>
          </SurfaceCard>
        )}
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader title="Sintomas" subtitle="O que você está sentindo?" />
      <div className="grid grid-cols-2 gap-3">
        {SINTOMAS.map((s) => (
          <SurfaceCard key={s.type} onClick={() => escolher(s.type)} className="flex flex-col items-center text-center gap-2 py-6 cursor-pointer">
            <div className="h-11 w-11 rounded-full bg-cardio-50 grid place-items-center">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{s.label}</p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
