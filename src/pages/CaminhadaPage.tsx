/**
 * CaminhadaPage — caminhada guiada + testes de capacidade.
 *
 * docs/ENGAJAMENTO-CARDIO.md §2.3 e §3 · contrato: a faixa de esforço vem do
 * médico (`zonaDeTreino`) — sem faixa definida, a sessão roda livre e o app
 * não inventa intensidade. Nenhum teste em casa substitui o do consultório.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * A faixa de esforço, os avisos de `zonaDeTreino`, a lista de motivos para
 * parar, as referências dos testes e todas as frases de `capacity.ts` estão
 * intactos. Mudou:
 *
 *  · AS ABAS. Eram dois botões dentro de uma pílula cinza, sem papel de aba
 *    para leitor de tela e sem indicar qual estava ativa a não ser pelo
 *    fundo branco. Agora são `role="tab"` com `aria-selected`, e a aba ativa
 *    tem sublinhado além do fundo — cor sozinha não diz onde você está.
 *
 *  · O botão "Encerrar" era azul cheio pintado de vermelho (`bg-error`) ao
 *    lado de um "Pausar" secundário. Encerrar uma caminhada não é destrutivo
 *    e não é emergência: o vermelho desta tela pertence à lista de motivos
 *    para PARAR e procurar atendimento. Virou o primário normal.
 *
 *  · Os campos dos testes ganharam rótulo de 17px e o texto de referência
 *    saiu de 13px — é exatamente o número que o paciente precisa ler para
 *    entender que o teste em casa é estimativa.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Footprints, Timer, HeartPulse, Bluetooth, Pause, Play,
  Square, ClipboardList, History as HistoryIcon, ArmchairIcon, Activity,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, Formulario, Campo, AvisoDaTela,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { cronometro, duracaoCurta, diaCurto, numero } from "@/lib/formato";
import { useCaminhadas, useCapacidade } from "@/hooks/useEngajamento";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { useWeight } from "@/hooks/useCardioReadings";
import { idadeEmAnos } from "@/lib/clinical/scores";
import {
  estadoNaZona, TEXTO_ZONA, MOTIVOS_PARA_PARAR, distanciaPrevista6min,
  referenciaSentarLevantar, lerRecuperacaoFc, type TipoTeste, type EstadoZona,
} from "@/lib/clinical/capacity";
import {
  conectarPulseira, bluetoothDisponivel, motivoIndisponivel, classificarFalhaBluetooth, type BleConnection,
} from "@/lib/wearable/bleClient";
import type { WalkSession } from "@/types/cardio";

type Aba = "guiada" | "testes";

const ZONA_COR: Record<EstadoZona, string> = {
  dentro: "text-success",
  abaixo: "text-primary",
  acima: "text-error",
  sem_alvo: "text-muted-foreground",
};

/**
 * Cronômetro CORRENDO — "24:34" é certo aqui e só aqui: o número está mudando
 * na tela e o paciente lê como tempo decorrido.
 *
 * No histórico ele estava errado: "24:34 · 12/09" não é "24 minutos e 34
 * segundos, no dia 12" para quem lê — é uma hora do dia que não existe. Lá se
 * usa `duracaoCurta` ("24 min 34 s"), que não tem leitura alternativa.
 */
function fmtMMSS(totalSegundos: number): string {
  return cronometro(totalSegundos);
}

function fmtDia(iso: string): string {
  return diaCurto(iso) ?? "—";
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
      setErro(classificarFalhaBluetooth(e).mensagem);
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
        <AvisoDaTela tom="atencao" className="mb-5">{zona.aviso}</AvisoDaTela>
      )}
      {zona.definidaPeloMedico && (
        <SurfaceCard className="bg-cardio-50 border-0 mb-5">
          <p className="text-base text-foreground leading-relaxed">{zona.aviso}</p>
        </SurfaceCard>
      )}

      {fase === "pre" && (
        <>
          <TituloSecao titulo="Pare a caminhada e procure atendimento se sentir" />
          <SurfaceCard className="mb-5">
            <ul className="space-y-3">
              {MOTIVOS_PARA_PARAR.map((m) => (
                <li key={m} className="flex items-start gap-2.5 text-base text-foreground leading-relaxed">
                  <span className="h-2 w-2 rounded-full bg-error mt-2.5 shrink-0" aria-hidden />
                  {m}
                </li>
              ))}
            </ul>
          </SurfaceCard>
          <Button size="xl" className="w-full gap-2" onClick={iniciar}>
            <Play className="h-5 w-5" aria-hidden /> Iniciar caminhada
          </Button>
        </>
      )}

      {(fase === "ativa" || fase === "pausada") && (
        <>
          <SurfaceCard className="text-center py-8 mb-5">
            <p className="text-sm font-medium text-muted-foreground mb-1">Tempo de caminhada</p>
            <p className="text-5xl font-bold text-foreground tabular-nums">{fmtMMSS(segundos)}</p>
            {fase === "pausada" && <p className="text-base text-warning font-semibold mt-2">Pausada</p>}
          </SurfaceCard>

          <SurfaceCard className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-5 w-5 text-primary" aria-hidden />
                <span className="text-base font-semibold text-foreground">Batimentos</span>
              </div>
              {!pulseira.conectado ? (
                <Button variant="outline" className="gap-1.5" onClick={pulseira.conectar} disabled={pulseira.conectando}>
                  <Bluetooth className="h-4 w-4" aria-hidden /> {pulseira.conectando ? "Conectando..." : "Conectar pulseira"}
                </Button>
              ) : (
                <span className="text-base text-success font-semibold">Conectada</span>
              )}
            </div>
            <p className="text-4xl font-bold text-foreground text-center tabular-nums">{pulseira.bpm ?? "—"}</p>
            {/* O texto da zona acompanha a cor sempre — `TEXTO_ZONA` é o que
                informa; `ZONA_COR` só reforça. */}
            <p className={cn("text-base font-semibold text-center mt-2", ZONA_COR[estado])}>{TEXTO_ZONA[estado]}</p>
            {pulseira.erro && <p className="text-base text-warning mt-2 text-center leading-relaxed">{pulseira.erro}</p>}
            {zona.definidaPeloMedico && (
              <p className="text-sm text-muted-foreground text-center mt-3">
                {duracaoCurta(segundosNaZona)} dentro da faixa nesta sessão
              </p>
            )}
          </SurfaceCard>

          <div className="flex flex-wrap gap-3">
            {fase === "ativa" ? (
              <Button size="xl" variant="outline" className="flex-1 min-w-[140px] gap-2" onClick={() => setFase("pausada")}>
                <Pause className="h-5 w-5" aria-hidden /> Pausar
              </Button>
            ) : (
              <Button size="xl" variant="outline" className="flex-1 min-w-[140px] gap-2" onClick={() => setFase("ativa")}>
                <Play className="h-5 w-5" aria-hidden /> Retomar
              </Button>
            )}
            <Button size="xl" className="flex-1 min-w-[140px] gap-2" onClick={() => setFase("fim")}>
              <Square className="h-5 w-5" aria-hidden /> Encerrar
            </Button>
          </div>
        </>
      )}

      {fase === "fim" && (
        <SurfaceCard className="mb-5">
          <p className="text-base font-semibold text-foreground mb-1">Caminhada de {duracaoCurta(segundos)}</p>
          <TituloSecao titulo="Como foi o esforço?" subtitulo="0 = nenhum · 10 = máximo" />
          <div className="grid grid-cols-6 gap-2 mb-5">
            {Array.from({ length: 11 }, (_, n) => n).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={borg === n}
                aria-label={`${n} de 10`}
                onClick={() => setBorg(n)}
                className={cn(
                  "h-12 rounded-xl border text-base font-bold tabular-nums transition-colors",
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

      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3 mt-6 mb-6">
        <SurfaceCard className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Minutos esta semana</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{minutosSemana}</p>
        </SurfaceCard>
        <SurfaceCard className="text-center">
          <p className="text-sm text-muted-foreground mb-1">Sessões esta semana</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{daSemana.length}</p>
        </SurfaceCard>
      </div>

      {/* O selo "Esforço 4/10" aparecia sem dizer o que é 0 e o que é 10 — um
          número numa escala invisível. A escala é a mesma que a tela usa para
          PERGUNTAR ("0 = nenhum · 10 = máximo"); só faltava repeti-la onde a
          resposta é lida de volta, semanas depois. */}
      <TituloSecao
        titulo="Histórico de caminhadas"
        icone={HistoryIcon}
        subtitulo="o esforço é como você avaliou a caminhada: 0 é nenhum esforço, 10 é o máximo"
      />
      {sessoes.length === 0 ? (
        <EmptyState icon={Footprints} title="Nenhuma caminhada ainda" description="Suas sessões aparecem aqui." variant="card" />
      ) : (
        <div className="space-y-2.5">
          {sessoes.slice(0, 8).map((s: WalkSession) => (
            <SurfaceCard key={s.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground">{duracaoCurta(s.duracao_segundos)} · {fmtDia(s.iniciada_em)}</p>
                {s.zona_min != null && s.zona_max != null && (
                  <p className="text-sm text-muted-foreground">
                    {s.segundos_na_zona != null ? `${duracaoCurta(s.segundos_na_zona)} na faixa` : `Faixa ${s.zona_min}–${s.zona_max} bpm`}
                  </p>
                )}
              </div>
              {s.borg != null && (
                <span className="text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1 bg-cardio-50 text-primary shrink-0">
                  Esforço {s.borg} de 10
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
        <p className="text-base text-foreground leading-relaxed mb-4">
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
        <Timer className="h-6 w-6 text-primary mx-auto mb-2" aria-hidden />
        <p className="text-5xl font-bold text-foreground tabular-nums">{fmtMMSS(restante)}</p>
        <p className="text-sm text-muted-foreground mt-2">tempo restante</p>
        <Button size="xl" variant="outline" className="mt-6" onClick={() => setFase("medir")}>
          Terminei antes
        </Button>
      </SurfaceCard>
    );
  }

  if (fase === "medir") {
    return (
      <SurfaceCard>
        <Formulario>
          <Campo
            rotulo="Quantos metros você andou?"
            para="metros6"
            ajuda="Não sabe o exato? Conte os passos e multiplique por cerca de 0,7 metro, ou use o mapa do celular."
          >
            <Input
              id="metros6" inputMode="numeric" placeholder="ex.: 420" value={metros}
              onChange={(e) => setMetros(e.target.value.replace(/\D/g, ""))}
              className="h-14 text-2xl font-bold text-center tabular-nums"
            />
          </Campo>
          {previsto != null && (
            <p className="text-sm text-muted-foreground my-4 leading-relaxed">
              A referência para o seu perfil é cerca de {previsto} m — é uma média de população, não uma meta. Feito em casa, esse teste é uma
              estimativa e não substitui o teste no consultório.
            </p>
          )}
          {previsto == null && (
            <p className="text-sm text-muted-foreground my-4 leading-relaxed">
              Feito em casa, esse teste é uma estimativa e não substitui o teste no consultório.
            </p>
          )}
          <Button size="xl" className="w-full" disabled={!metros || registrar.isPending} onClick={salvar}>
            {registrar.isPending ? "Salvando..." : "Salvar resultado"}
          </Button>
        </Formulario>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-base text-foreground leading-relaxed mb-4">{evolucao.caminhada.frase}</p>
      <Button variant="outline" size="lg" className="w-full" onClick={onFeito}>Voltar</Button>
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
        <p className="text-base text-foreground leading-relaxed mb-4">
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
        <p className="text-sm text-muted-foreground mb-5">tempo restante</p>
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
        <p className="text-base font-semibold text-foreground mb-1">Você fez {contagem} repetições.</p>
        {referencia && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
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
      <p className="text-base text-foreground leading-relaxed mb-4">{evolucao.sentarLevantar.frase}</p>
      <Button variant="outline" size="lg" className="w-full" onClick={onFeito}>Voltar</Button>
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
    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <span className="text-sm text-muted-foreground">Pulseira: {pulseira.bpm ?? "—"} bpm</span>
      {!pulseira.conectado ? (
        <Button variant="outline" className="gap-1.5" onClick={pulseira.conectar} disabled={pulseira.conectando}>
          <Bluetooth className="h-4 w-4" aria-hidden /> Conectar
        </Button>
      ) : null}
    </div>
  );

  if (fase === "pico") {
    return (
      <SurfaceCard>
        <p className="text-base text-foreground leading-relaxed mb-3">
          Logo depois de fazer algum esforço (a própria caminhada guiada serve), registre seus batimentos.
        </p>
        {cartaoPulseira}
        <Formulario>
          <Campo rotulo="Batimentos agora" para="fcpico">
            <div className="flex flex-wrap gap-2">
              <Input
                id="fcpico" inputMode="numeric" placeholder="ex.: 128" value={fcPico}
                onChange={(e) => setFcPico(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-2xl font-bold text-center flex-1 min-w-[140px] tabular-nums"
              />
              {pulseira.conectado && <Button variant="outline" size="lg" onClick={usarPulseiraPico}>Usar pulseira</Button>}
            </div>
          </Campo>
          <Button size="xl" className="w-full mt-4" disabled={!fcPico} onClick={() => { setRestante(60); setFase("esperando"); }}>
            Começar a contar 1 minuto
          </Button>
        </Formulario>
      </SurfaceCard>
    );
  }

  if (fase === "esperando") {
    return (
      <SurfaceCard className="text-center py-8">
        <Timer className="h-6 w-6 text-primary mx-auto mb-2" aria-hidden />
        <p className="text-5xl font-bold text-foreground tabular-nums">{restante}s</p>
        <p className="text-sm text-muted-foreground mt-2">fique parado, sem se esforçar</p>
      </SurfaceCard>
    );
  }

  if (fase === "final") {
    return (
      <SurfaceCard>
        <p className="text-base text-foreground leading-relaxed mb-3">Agora registre seus batimentos de novo.</p>
        {cartaoPulseira}
        <Formulario>
          <Campo rotulo="Batimentos agora, 1 minuto depois" para="fcfinal">
            <div className="flex flex-wrap gap-2">
              <Input
                id="fcfinal" inputMode="numeric" placeholder="ex.: 104" value={fcFinal}
                onChange={(e) => setFcFinal(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-2xl font-bold text-center flex-1 min-w-[140px] tabular-nums"
              />
              {pulseira.conectado && <Button variant="outline" size="lg" onClick={usarPulseiraFinal}>Usar pulseira</Button>}
            </div>
          </Campo>
          {leitura && (
            <SurfaceCard className={cn("my-4 border-0", leitura.tom === "bom" ? "bg-success-bg" : "bg-warning-bg")}>
              <p className={cn("text-base font-semibold mb-1", leitura.tom === "bom" ? "text-success" : "text-warning")}>{leitura.rotulo}</p>
              <p className="text-base text-foreground leading-relaxed">{leitura.texto}</p>
            </SurfaceCard>
          )}
          <Button size="xl" className="w-full" disabled={!fcFinal || registrar.isPending} onClick={() => { salvar(); setFase("feito"); }}>
            {registrar.isPending ? "Salvando..." : "Salvar resultado"}
          </Button>
        </Formulario>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-base text-foreground leading-relaxed mb-4">{evolucao.recuperacao.frase}</p>
      <Button variant="outline" size="lg" className="w-full" onClick={onFeito}>Voltar</Button>
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
      <TituloSecao titulo="Escolha um teste" icone={ClipboardList} />
      <div className="space-y-2.5 mb-6">
        {TESTES.map((t) => (
          <SurfaceCard key={t.tipo} onClick={() => setAtivo(t.tipo)} className="text-left hover:shadow-md transition-shadow" ariaLabel={t.titulo}>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <t.icon className="h-5 w-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground break-words">{t.titulo}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.descricao}</p>
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>

      <TituloSecao titulo="Últimos resultados" />
      {testes.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nenhum teste ainda" description="Faça um teste para começar a acompanhar sua evolução." variant="card" />
      ) : (
        <div className="space-y-2.5">
          {testes.slice(0, 8).map((t) => {
            const info = TESTES.find((x) => x.tipo === t.tipo);
            const unidade = t.tipo === "walk_6min" ? "m" : t.tipo === "sit_to_stand_30s" ? "rep." : "bpm";
            return (
              <SurfaceCard key={t.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground break-words">{info?.titulo}</p>
                  <p className="text-sm text-muted-foreground">{fmtDia(t.realizado_em)}</p>
                </div>
                <span className="text-lg font-bold text-foreground tabular-nums shrink-0">{numero(t.valor)} {unidade}</span>
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
    <TelaPaciente>
      <PageHeader title="Caminhada" subtitle="Sessão guiada e testes de capacidade" />

      {/* Abas de verdade: `role="tab"` com `aria-selected`, e a ativa marcada
          por sublinhado ALÉM do fundo — fundo branco sobre cinza claro é
          diferença de cor, e diferença de cor sozinha não diz onde você está. */}
      <div role="tablist" aria-label="Seções da caminhada" className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-secondary">
        {([
          { chave: "guiada" as const, rotulo: "Caminhada guiada" },
          { chave: "testes" as const, rotulo: "Testes de capacidade" },
        ]).map((t) => (
          <button
            key={t.chave}
            type="button"
            role="tab"
            aria-selected={aba === t.chave}
            onClick={() => setAba(t.chave)}
            className={cn(
              "min-h-[48px] rounded-xl px-2 text-base font-semibold transition-colors motion-reduce:transition-none",
              aba === t.chave
                ? "bg-card text-foreground shadow-sm underline underline-offset-4 decoration-2 decoration-primary"
                : "text-muted-foreground"
            )}
          >
            {t.rotulo}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {aba === "guiada" ? <AbaCaminhadaGuiada /> : <AbaTestes />}
      </div>

      {!bluetoothDisponivel() && (
        <p className="text-sm text-muted-foreground text-center leading-relaxed">
          Este navegador não conecta com a pulseira por Bluetooth — os testes e a caminhada funcionam com valores manuais.
        </p>
      )}
    </TelaPaciente>
  );
}
