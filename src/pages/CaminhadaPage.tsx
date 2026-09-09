/**
 * CaminhadaPage — caminhada guiada + testes de capacidade.
 *
 * docs/ENGAJAMENTO-CARDIO.md §2.3 e §3 · contrato: a faixa de esforço vem do
 * médico (`zonaDeTreino`) — sem faixa definida, a sessão roda livre e o app
 * não inventa intensidade. Nenhum teste em casa substitui o do consultório.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Timer, HeartPulse, Bluetooth, AlertTriangle, Pause, Play,
  Square, ClipboardList, History as HistoryIcon, ArmchairIcon, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useCaminhadas, useCapacidade } from "@/hooks/useEngajamento";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { useWeight } from "@/hooks/useCardioReadings";
import { idadeEmAnos } from "@/lib/clinical/scores";
import {
  estadoNaZona, TEXTO_ZONA, MOTIVOS_PARA_PARAR, distanciaPrevista6min,
  referenciaSentarLevantar, lerRecuperacaoFc, type TipoTeste, type EstadoZona,
} from "@/lib/clinical/capacity";
import {
  conectarPulseira, bluetoothDisponivel, motivoIndisponivel, type BleConnection,
} from "@/lib/wearable/bleClient";
import type { WalkSession } from "@/types/cardio";

type Aba = "guiada" | "testes";

const ZONA_COR: Record<EstadoZona, string> = {
  dentro: "text-success",
  abaixo: "text-primary",
  acima: "text-error",
  sem_alvo: "text-muted-foreground",
};

function fmtMMSS(totalSegundos: number): string {
  const m = Math.floor(totalSegundos / 60);
  const s = totalSegundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Pulseira ao vivo (compartilhado pelas duas abas) ─────────────────

function usePulseiraAoVivo() {
  const [conectando, setConectando] = useState(false);
  const [conexao, setConexao] = useState<BleConnection | null>(null);
  const [bpm, setBpm] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => () => { conexao?.disconnect().catch(() => {}); }, [conexao]);

  const conectar = async () => {
    const impedimento = motivoIndisponivel();
    if (impedimento) { setErro(impedimento); return; }
    setErro(null);
    setConectando(true);
    try {
      const con = await conectarPulseira({
        onSample: (s) => setBpm(s.bpm),
        onDisconnect: () => { setConexao(null); setBpm(null); },
      });
      setConexao(con);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui conectar. Tente de novo.");
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    await conexao?.disconnect();
    setConexao(null);
    setBpm(null);
  };

  return { conectando, conectado: !!conexao, bpm, erro, conectar, desconectar };
}

// ── Aba: caminhada guiada ─────────────────────────────────────────────

type FaseSessao = "pre" | "ativa" | "pausada" | "fim";

function AbaCaminhadaGuiada() {
  const { zona, sessoes, daSemana, minutosSemana, isLoading, salvar } = useCaminhadas();
  const pulseira = usePulseiraAoVivo();

  const [fase, setFase] = useState<FaseSessao>("pre");
  const [segundos, setSegundos] = useState(0);
  const [segundosNaZona, setSegundosNaZona] = useState(0);
  const [borg, setBorg] = useState<number | null>(null);

  const estado = estadoNaZona(pulseira.bpm, zona);
  const estadoRef = useRef(estado);
  useEffect(() => { estadoRef.current = estado; }, [estado]);

  useEffect(() => {
    if (fase !== "ativa") return;
    const id = window.setInterval(() => {
      setSegundos((s) => s + 1);
      if (estadoRef.current === "dentro") setSegundosNaZona((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [fase]);

  const iniciar = () => {
    setSegundos(0);
    setSegundosNaZona(0);
    setBorg(null);
    setFase("ativa");
  };

  const salvarSessao = () => {
    salvar.mutate({
      iniciada_em: new Date(Date.now() - segundos * 1000).toISOString(),
      duracao_segundos: segundos,
      segundos_na_zona: segundosNaZona,
      fc_media: pulseira.bpm ?? null,
      borg,
      interrompida: false,
    });
    setFase("pre");
  };

  if (isLoading) return <TabPageSkeleton />;

  return (
    <div>
      {!zona.definidaPeloMedico && (
        <SurfaceCard className="bg-warning-bg border-0 mb-5">
          <p className="text-sm text-foreground leading-relaxed flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            {zona.aviso}
          </p>
        </SurfaceCard>
      )}
      {zona.definidaPeloMedico && (
        <SurfaceCard className="bg-cardio-50 border-0 mb-5">
          <p className="text-sm text-foreground">{zona.aviso}</p>
        </SurfaceCard>
      )}

      {fase === "pre" && (
        <>
          <SectionHeader title="Pare a caminhada e procure atendimento se sentir" />
          <SurfaceCard className="mb-5">
            <ul className="space-y-2">
              {MOTIVOS_PARA_PARAR.map((m) => (
                <li key={m} className="flex items-start gap-2.5 text-sm text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-error mt-2 shrink-0" />
                  {m}
                </li>
              ))}
            </ul>
          </SurfaceCard>
          <Button size="xl" className="w-full gap-2" onClick={iniciar}>
            <Play className="h-5 w-5" /> Iniciar caminhada
          </Button>
        </>
      )}

      {(fase === "ativa" || fase === "pausada") && (
        <>
          <SurfaceCard className="text-center py-8 mb-5">
            <p className="text-xs font-medium text-muted-foreground mb-1">Tempo de caminhada</p>
            <p className="text-5xl font-bold text-foreground tabular-nums">{fmtMMSS(segundos)}</p>
            {fase === "pausada" && <p className="text-xs text-warning font-semibold mt-2">Pausada</p>}
          </SurfaceCard>

          <SurfaceCard className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">Batimentos</span>
              </div>
              {!pulseira.conectado ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={pulseira.conectar} disabled={pulseira.conectando}>
                  <Bluetooth className="h-3.5 w-3.5" /> {pulseira.conectando ? "Conectando..." : "Conectar pulseira"}
                </Button>
              ) : (
                <span className="text-xs text-success font-semibold">Conectada</span>
              )}
            </div>
            <p className="text-4xl font-bold text-foreground text-center tabular-nums">{pulseira.bpm ?? "—"}</p>
            <p className={cn("text-sm font-semibold text-center mt-2", ZONA_COR[estado])}>{TEXTO_ZONA[estado]}</p>
            {pulseira.erro && <p className="text-xs text-warning mt-2 text-center">{pulseira.erro}</p>}
            {zona.definidaPeloMedico && (
              <p className="text-xs text-muted-foreground text-center mt-3">
                {Math.floor(segundosNaZona / 60)}m{(segundosNaZona % 60).toString().padStart(2, "0")}s dentro da faixa nesta sessão
              </p>
            )}
          </SurfaceCard>

          <div className="flex gap-3">
            {fase === "ativa" ? (
              <Button size="xl" variant="outline" className="flex-1 gap-2" onClick={() => setFase("pausada")}>
                <Pause className="h-5 w-5" /> Pausar
              </Button>
            ) : (
              <Button size="xl" variant="outline" className="flex-1 gap-2" onClick={() => setFase("ativa")}>
                <Play className="h-5 w-5" /> Retomar
              </Button>
            )}
            <Button size="xl" className="flex-1 gap-2 bg-error hover:opacity-90" onClick={() => setFase("fim")}>
              <Square className="h-5 w-5" /> Encerrar
            </Button>
          </div>
        </>
      )}

      {fase === "fim" && (
        <SurfaceCard className="mb-5">
          <p className="text-sm font-semibold text-foreground mb-1">Caminhada de {fmtMMSS(segundos)}</p>
          <SectionHeader title="Como foi o esforço?" subtitle="0 = nenhum · 10 = máximo" />
          <div className="grid grid-cols-6 gap-2 mb-5">
            {Array.from({ length: 11 }, (_, n) => n).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setBorg(n)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-bold transition-colors",
                  borg === n ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Button size="xl" className="w-full" disabled={salvar.isPending} onClick={salvarSessao}>
            {salvar.isPending ? "Salvando..." : "Salvar caminhada"}
          </Button>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-2 gap-3 mt-6 mb-6">
        <SurfaceCard className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Minutos esta semana</p>
          <p className="text-2xl font-bold text-foreground">{minutosSemana}</p>
        </SurfaceCard>
        <SurfaceCard className="text-center">
          <p className="text-xs text-muted-foreground mb-1">Sessões esta semana</p>
          <p className="text-2xl font-bold text-foreground">{daSemana.length}</p>
        </SurfaceCard>
      </div>

      <SectionHeader title="Histórico de caminhadas" icon={HistoryIcon} />
      {sessoes.length === 0 ? (
        <EmptyState icon={Footprints} title="Nenhuma caminhada ainda" description="Suas sessões aparecem aqui." variant="card" />
      ) : (
        <div className="space-y-2.5">
          {sessoes.slice(0, 8).map((s: WalkSession) => (
            <SurfaceCard key={s.id} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{fmtMMSS(s.duracao_segundos)} · {fmtDia(s.iniciada_em)}</p>
                {s.zona_min != null && s.zona_max != null && (
                  <p className="text-xs text-muted-foreground">
                    {s.segundos_na_zona != null ? `${Math.round(s.segundos_na_zona / 60)} min na faixa` : `Faixa ${s.zona_min}–${s.zona_max} bpm`}
                  </p>
                )}
              </div>
              {s.borg != null && (
                <span className="text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 bg-cardio-50 text-primary shrink-0">
                  Esforço {s.borg}/10
                </span>
              )}
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Aba: testes de capacidade ─────────────────────────────────────────

function Teste6Min({ onFeito }: { onFeito: () => void }) {
  const { evolucao, registrar } = useCapacidade();
  const { data: patient } = useCardioPatient();
  const peso = useWeight();

  const [fase, setFase] = useState<"instrucoes" | "andando" | "medir" | "feito">("instrucoes");
  const [restante, setRestante] = useState(360);
  const [metros, setMetros] = useState("");

  useEffect(() => {
    if (fase !== "andando") return;
    if (restante <= 0) { setFase("medir"); return; }
    const id = window.setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [fase, restante]);

  const idade = idadeEmAnos(patient?.birth_date);
  const previsto =
    patient?.sex && idade != null && patient.height_cm && peso.ultimo?.value
      ? distanciaPrevista6min(patient.sex, idade, patient.height_cm, peso.ultimo.value)
      : null;

  const salvar = () => {
    const valor = Number(metros);
    if (!valor) return;
    registrar.mutate({ tipo: "walk_6min", valor }, { onSuccess: () => setFase("feito") });
  };

  if (fase === "instrucoes") {
    return (
      <SurfaceCard>
        <p className="text-sm text-foreground leading-relaxed mb-4">
          Ande no seu ritmo mais rápido confortável, em um terreno plano, por 6 minutos.
          Pode diminuir o passo ou parar se precisar — depois retome se der.
        </p>
        <Button size="xl" className="w-full" onClick={() => { setRestante(360); setFase("andando"); }}>
          Iniciar os 6 minutos
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "andando") {
    return (
      <SurfaceCard className="text-center py-8">
        <Timer className="h-6 w-6 text-primary mx-auto mb-2" />
        <p className="text-5xl font-bold text-foreground tabular-nums">{fmtMMSS(restante)}</p>
        <p className="text-xs text-muted-foreground mt-2">tempo restante</p>
        <Button size="lg" variant="outline" className="mt-6" onClick={() => setFase("medir")}>
          Terminei antes
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "medir") {
    return (
      <SurfaceCard>
        <Label htmlFor="metros6" className="text-sm text-foreground font-semibold">Quantos metros você andou?</Label>
        <p className="text-xs text-muted-foreground mt-1 mb-3">
          Não sabe o exato? Conte os passos e multiplique por cerca de 0,7 metro, ou use o mapa do celular.
        </p>
        <Input
          id="metros6" inputMode="numeric" placeholder="ex.: 420" value={metros}
          onChange={(e) => setMetros(e.target.value.replace(/\D/g, ""))}
          className="h-14 text-2xl font-bold text-center mb-4"
        />
        {previsto != null && (
          <p className="text-xs text-muted-foreground mb-4">
            A referência para o seu perfil é cerca de {previsto} m — é uma média de população, não uma meta. Feito em casa, esse teste é uma
            estimativa e não substitui o teste no consultório.
          </p>
        )}
        {previsto == null && (
          <p className="text-xs text-muted-foreground mb-4">
            Feito em casa, esse teste é uma estimativa e não substitui o teste no consultório.
          </p>
        )}
        <Button size="xl" className="w-full" disabled={!metros || registrar.isPending} onClick={salvar}>
          {registrar.isPending ? "Salvando..." : "Salvar resultado"}
        </Button>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-sm text-foreground leading-relaxed mb-4">{evolucao.caminhada.frase}</p>
      <Button variant="outline" className="w-full" onClick={onFeito}>Voltar</Button>
    </SurfaceCard>
  );
}

function TesteSentarLevantar({ onFeito }: { onFeito: () => void }) {
  const { evolucao, registrar } = useCapacidade();
  const { data: patient } = useCardioPatient();
  const idade = idadeEmAnos(patient?.birth_date);
  const referencia = patient?.sex && idade != null ? referenciaSentarLevantar(patient.sex, idade) : null;

  const [fase, setFase] = useState<"instrucoes" | "contando" | "feito">("instrucoes");
  const [restante, setRestante] = useState(30);
  const [contagem, setContagem] = useState(0);

  useEffect(() => {
    if (fase !== "contando") return;
    if (restante <= 0) { setFase("feito"); return; }
    const id = window.setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [fase, restante]);

  const salvar = () => {
    registrar.mutate({ tipo: "sit_to_stand_30s", valor: contagem });
  };

  if (fase === "instrucoes") {
    return (
      <SurfaceCard>
        <p className="text-sm text-foreground leading-relaxed mb-4">
          Sente em uma cadeira firme, sem apoiar as mãos. Quando começar, levante e sente o máximo de vezes que conseguir em 30 segundos.
        </p>
        <Button size="xl" className="w-full" onClick={() => { setRestante(30); setContagem(0); setFase("contando"); }}>
          Iniciar os 30 segundos
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "contando") {
    return (
      <SurfaceCard className="text-center py-6">
        <p className="text-4xl font-bold text-foreground tabular-nums mb-1">{restante}s</p>
        <p className="text-xs text-muted-foreground mb-5">tempo restante</p>
        <p className="text-6xl font-bold text-primary tabular-nums mb-4">{contagem}</p>
        <Button size="xl" className="w-full h-20 text-2xl" onClick={() => setContagem((c) => c + 1)}>
          + 1 (levantei)
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "feito" && !registrar.isSuccess) {
    return (
      <SurfaceCard>
        <p className="text-sm font-semibold text-foreground mb-1">Você fez {contagem} repetições.</p>
        {referencia && (
          <p className="text-xs text-muted-foreground mb-4">
            A faixa de referência para sua idade e sexo costuma ser de {referencia.min} a {referencia.max} repetições.
          </p>
        )}
        <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={salvar}>
          {registrar.isPending ? "Salvando..." : "Salvar resultado"}
        </Button>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-sm text-foreground leading-relaxed mb-4">{evolucao.sentarLevantar.frase}</p>
      <Button variant="outline" className="w-full" onClick={onFeito}>Voltar</Button>
    </SurfaceCard>
  );
}

function TesteRecuperacaoFc({ onFeito }: { onFeito: () => void }) {
  const { evolucao, registrar } = useCapacidade();
  const pulseira = usePulseiraAoVivo();

  const [fase, setFase] = useState<"pico" | "esperando" | "final" | "feito">("pico");
  const [fcPico, setFcPico] = useState("");
  const [fcFinal, setFcFinal] = useState("");
  const [restante, setRestante] = useState(60);

  useEffect(() => {
    if (fase !== "esperando") return;
    if (restante <= 0) { setFase("final"); return; }
    const id = window.setTimeout(() => setRestante((r) => r - 1), 1000);
    return () => window.clearTimeout(id);
  }, [fase, restante]);

  const usarPulseiraPico = () => { if (pulseira.bpm) setFcPico(String(pulseira.bpm)); };
  const usarPulseiraFinal = () => { if (pulseira.bpm) setFcFinal(String(pulseira.bpm)); };

  const queda = fcPico && fcFinal ? Number(fcPico) - Number(fcFinal) : null;
  const leitura = queda != null ? lerRecuperacaoFc(queda) : null;

  const salvar = () => {
    if (queda == null) return;
    registrar.mutate({ tipo: "hr_recovery", valor: queda, fc_pico: Number(fcPico), fc_final: Number(fcFinal) });
  };

  const cartaoPulseira = (
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-muted-foreground">Pulseira: {pulseira.bpm ?? "—"} bpm</span>
      {!pulseira.conectado ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={pulseira.conectar} disabled={pulseira.conectando}>
          <Bluetooth className="h-3.5 w-3.5" /> Conectar
        </Button>
      ) : null}
    </div>
  );

  if (fase === "pico") {
    return (
      <SurfaceCard>
        <p className="text-sm text-foreground leading-relaxed mb-3">
          Logo depois de fazer algum esforço (a própria caminhada guiada serve), registre seus batimentos.
        </p>
        {cartaoPulseira}
        <Label htmlFor="fcpico" className="text-xs text-muted-foreground">Batimentos agora</Label>
        <div className="flex gap-2 mt-1 mb-4">
          <Input
            id="fcpico" inputMode="numeric" placeholder="ex.: 128" value={fcPico}
            onChange={(e) => setFcPico(e.target.value.replace(/\D/g, ""))}
            className="h-14 text-2xl font-bold text-center flex-1"
          />
          {pulseira.conectado && <Button variant="outline" onClick={usarPulseiraPico}>Usar pulseira</Button>}
        </div>
        <Button size="xl" className="w-full" disabled={!fcPico} onClick={() => { setRestante(60); setFase("esperando"); }}>
          Começar a contar 1 minuto
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "esperando") {
    return (
      <SurfaceCard className="text-center py-8">
        <Timer className="h-6 w-6 text-primary mx-auto mb-2" />
        <p className="text-5xl font-bold text-foreground tabular-nums">{restante}s</p>
        <p className="text-xs text-muted-foreground mt-2">fique parado, sem se esforçar</p>
      </SurfaceCard>
    );
  }

  if (fase === "final") {
    return (
      <SurfaceCard>
        <p className="text-sm text-foreground leading-relaxed mb-3">Agora registre seus batimentos de novo.</p>
        {cartaoPulseira}
        <Label htmlFor="fcfinal" className="text-xs text-muted-foreground">Batimentos agora, 1 minuto depois</Label>
        <div className="flex gap-2 mt-1 mb-4">
          <Input
            id="fcfinal" inputMode="numeric" placeholder="ex.: 104" value={fcFinal}
            onChange={(e) => setFcFinal(e.target.value.replace(/\D/g, ""))}
            className="h-14 text-2xl font-bold text-center flex-1"
          />
          {pulseira.conectado && <Button variant="outline" onClick={usarPulseiraFinal}>Usar pulseira</Button>}
        </div>
        {leitura && (
          <SurfaceCard className={cn("mb-4", leitura.tom === "bom" ? "bg-success-bg" : "bg-warning-bg", "border-0")}>
            <p className={cn("text-sm font-semibold mb-1", leitura.tom === "bom" ? "text-success" : "text-warning")}>{leitura.rotulo}</p>
            <p className="text-sm text-foreground">{leitura.texto}</p>
          </SurfaceCard>
        )}
        <Button size="xl" className="w-full" disabled={!fcFinal || registrar.isPending} onClick={() => { salvar(); setFase("feito"); }}>
          {registrar.isPending ? "Salvando..." : "Salvar resultado"}
        </Button>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-sm text-foreground leading-relaxed mb-4">{evolucao.recuperacao.frase}</p>
      <Button variant="outline" className="w-full" onClick={onFeito}>Voltar</Button>
    </SurfaceCard>
  );
}

const TESTES: { tipo: TipoTeste; titulo: string; descricao: string; icon: typeof Footprints }[] = [
  { tipo: "walk_6min", titulo: "Caminhada de 6 minutos", descricao: "Quanto você consegue andar em 6 minutos.", icon: Footprints },
  { tipo: "sit_to_stand_30s", titulo: "Sentar e levantar", descricao: "Quantas vezes você levanta em 30 segundos.", icon: ArmchairIcon },
  { tipo: "hr_recovery", titulo: "Recuperação dos batimentos", descricao: "Quanto seu coração desacelera após o esforço.", icon: Activity },
];

function AbaTestes() {
  const { testes, isLoading } = useCapacidade();
  const [ativo, setAtivo] = useState<TipoTeste | null>(null);

  if (isLoading) return <TabPageSkeleton />;

  if (ativo === "walk_6min") return <Teste6Min onFeito={() => setAtivo(null)} />;
  if (ativo === "sit_to_stand_30s") return <TesteSentarLevantar onFeito={() => setAtivo(null)} />;
  if (ativo === "hr_recovery") return <TesteRecuperacaoFc onFeito={() => setAtivo(null)} />;

  return (
    <div>
      <SectionHeader title="Escolha um teste" icon={ClipboardList} />
      <div className="space-y-2.5 mb-6">
        {TESTES.map((t) => (
          <SurfaceCard key={t.tipo} onClick={() => setAtivo(t.tipo)} className="text-left hover:shadow-md transition-shadow" ariaLabel={t.titulo}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <t.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{t.titulo}</p>
                <p className="text-xs text-muted-foreground">{t.descricao}</p>
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>

      <SectionHeader title="Últimos resultados" />
      {testes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum teste ainda" description="Faça um teste para começar a acompanhar sua evolução." variant="card" />
      ) : (
        <div className="space-y-2.5">
          {testes.slice(0, 8).map((t) => {
            const info = TESTES.find((x) => x.tipo === t.tipo);
            const unidade = t.tipo === "walk_6min" ? "m" : t.tipo === "sit_to_stand_30s" ? "rep." : "bpm";
            return (
              <SurfaceCard key={t.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{info?.titulo}</p>
                  <p className="text-xs text-muted-foreground">{fmtDia(t.realizado_em)}</p>
                </div>
                <span className="text-lg font-bold text-foreground shrink-0">{t.valor} {unidade}</span>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────

export default function CaminhadaPage() {
  const [aba, setAba] = useState<Aba>("guiada");

  return (
    <div className="pb-10">
      <PageHeader title="Caminhada" subtitle="Sessão guiada e testes de capacidade" />

      <div className="grid grid-cols-2 gap-2 mb-6 p-1 rounded-2xl bg-secondary">
        <button
          type="button"
          onClick={() => setAba("guiada")}
          className={cn(
            "h-11 rounded-xl text-sm font-semibold transition-colors",
            aba === "guiada" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          Caminhada guiada
        </button>
        <button
          type="button"
          onClick={() => setAba("testes")}
          className={cn(
            "h-11 rounded-xl text-sm font-semibold transition-colors",
            aba === "testes" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          )}
        >
          Testes de capacidade
        </button>
      </div>

      {aba === "guiada" ? <AbaCaminhadaGuiada /> : <AbaTestes />}

      {!bluetoothDisponivel() && (
        <p className="text-xs text-muted-foreground mt-6 text-center">
          Este navegador não conecta com a pulseira por Bluetooth — os testes e a caminhada funcionam com valores manuais.
        </p>
      )}
    </div>
  );
}
