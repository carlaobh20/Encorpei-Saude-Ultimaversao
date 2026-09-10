/**
 * PulseiraPage — a tela do aparelho do paciente.
 *
 * A pergunta que esta tela responde, e é uma só: **os meus dados chegaram ao
 * meu médico?** Tudo o que não ajuda a responder isso desce para o bloco de
 * ajuda ou sai.
 *
 * Três decisões de produto que ficaram explícitas nesta reescrita:
 *
 * 1. **"Conectada" nunca é sinônimo de "dados chegando".** A versão anterior
 *    mostrava um badge "Ativa" e o batimento ao vivo — e não gravava nada. O
 *    paciente via o número pulsar e concluía que estava tudo certo. Agora o
 *    número grande da tela é a ÚLTIMA SINCRONIZAÇÃO BEM-SUCEDIDA, que só avança
 *    depois de uma gravação confirmada no banco (`useWearableSync`).
 * 2. **Nada de modelo presumido.** A ficha do aparelho veio de anúncio, não de
 *    manual (docs §4). A tela diz "o aparelho que você conectou" e mostra o nome
 *    que o próprio aparelho anunciou por Bluetooth. Nome de modelo e nome de app
 *    de fabricante não aparecem para o paciente.
 * 3. **Diagnóstico é ajuda, não tela principal.** Serviço GATT, UUID e firmware
 *    interessam a quem está depurando o primeiro aparelho, não a um senhor de 70
 *    anos às 8h da manhã. Foram para "Ajuda e detalhes do aparelho", recolhido.
 *
 * Regra do §6 que atravessa o arquivo: nenhuma frase aqui prescreve conduta, e
 * a pressão vinda da pulseira é sempre rotulada estimativa.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Watch, Bluetooth, BluetoothOff, HeartPulse, Upload, CheckCircle2,
  AlertTriangle, Info, Battery, ChevronDown, ChevronRight,
  ClipboardCopy, Circle, RefreshCw, CalendarClock, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useDevices } from "@/hooks/useCardioClinical";
import {
  useActivity, useBloodPressure, useHeartRate, useSleep, useSpo2,
} from "@/hooks/useCardioReadings";
import {
  useWearableSync, TIPO_ROTULO, type ResumoImportacao, type TipoImportado,
} from "@/hooks/useWearableSync";
import {
  conectarPulseira, bluetoothDisponivel, motivoIndisponivel, diagnosticarPulseira,
  type BleConnection, type WearableSample, type DiagnosticoPulseira,
} from "@/lib/wearable/bleClient";
import {
  importarCsv, CAMPO_ROTULO,
  type ResultadoImportacao, type CampoImportado,
} from "@/lib/wearable/importer";

// ── Estados da tela, em português de paciente ────────────────────────
//
// São excludentes e sempre visíveis: o paciente precisa saber em qual deles
// está sem interpretar ícone. "Atualizada" é o único que afirma que o dado
// chegou — e ele depende de gravação confirmada, não de conexão.

type EstadoPulseira =
  | "nao_conectada" | "conectando" | "sincronizando"
  | "atualizada" | "falhou" | "atrasada";

const ESTADO: Record<EstadoPulseira, {
  titulo: string;
  frase: string;
  variante: "normal" | "pendente" | "concluido" | "atencao" | "urgencia" | "informativo";
}> = {
  nao_conectada: {
    titulo: "Não conectada",
    frase: "O app ainda não recebeu nada deste aparelho.",
    variante: "normal",
  },
  conectando: {
    titulo: "Conectando",
    frase: "Procurando o aparelho. Deixe-o perto do celular.",
    variante: "informativo",
  },
  sincronizando: {
    titulo: "Sincronizando",
    frase: "Enviando suas medidas. Não feche esta tela.",
    variante: "informativo",
  },
  atualizada: {
    titulo: "Atualizada",
    frase: "Suas medidas foram salvas e seu médico consegue ver.",
    variante: "concluido",
  },
  falhou: {
    titulo: "Não deu certo",
    frase: "Nada foi enviado desta vez. Você pode tentar de novo.",
    variante: "atencao",
  },
  atrasada: {
    titulo: "Dados atrasados",
    frase: "Faz alguns dias que nada novo chega. Conecte ou importe o arquivo.",
    variante: "atencao",
  },
};

/** A partir de quantos dias sem gravação a tela chama o dado de atrasado. */
const DIAS_PARA_ATRASO = 3;

const fmtDataHora = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

const fmtDia = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const diasDesde = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;

/** Só conta como "chegou do aparelho" o que tem proveniência de aparelho. */
const doAparelho = (r: { source_type?: string | null }) =>
  r.source_type === "device" || r.source_type === "import";

const TIPOS: TipoImportado[] = ["batimentos", "oxigenacao", "pressao", "atividade", "sono"];

const ORDEM_CAMPOS: CampoImportado[] = [
  "recordedAt", "heartRate", "spo2", "systolic", "diastolic",
  "steps", "calories", "sleepMinutes", "deepMinutes", "lightMinutes",
];

export default function PulseiraPage() {
  const { devices, isLoading } = useDevices();
  const sync = useWearableSync();
  const hr = useHeartRate();
  const spo2 = useSpo2();
  const bp = useBloodPressure();
  const atividade = useActivity();
  const sono = useSleep();

  // ── Bluetooth ─────────────────────────────────────────────────────
  const [conectando, setConectando] = useState(false);
  const [conexao, setConexao] = useState<BleConnection | null>(null);
  const [amostra, setAmostra] = useState<WearableSample | null>(null);
  const [bateria, setBateria] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [gravadasNaSessao, setGravadasNaSessao] = useState(0);
  const [ultimaGravacao, setUltimaGravacao] = useState<string | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  // O callback do BLE é registrado uma vez, no momento de conectar, e vive até
  // a desconexão. Refs em vez de estado para ele não capturar valor velho.
  const idDoAparelhoRef = useRef<string | null>(null);
  const nomeDoAparelhoRef = useRef<string>("Pulseira");

  // ── Importação ────────────────────────────────────────────────────
  const [textoArquivo, setTextoArquivo] = useState<string | null>(null);
  const [previa, setPrevia] = useState<ResultadoImportacao | null>(null);
  const [mapaManual, setMapaManual] = useState<Partial<Record<CampoImportado, number>>>({});
  const [importando, setImportando] = useState(false);
  const [resumo, setResumo] = useState<ResumoImportacao | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Ajuda e detalhes ──────────────────────────────────────────────
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [diagnosticando, setDiagnosticando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoPulseira | null>(null);
  const [erroDiagnostico, setErroDiagnostico] = useState<string | null>(null);
  const [tecnicoAberto, setTecnicoAberto] = useState(false);

  useEffect(() => () => { conexao?.disconnect().catch(() => {}); }, [conexao]);

  const aparelho = devices.find((d) => d.category === "h59") ?? null;

  /**
   * Nome mostrado ao paciente. Nesta ordem: o que o aparelho anunciou agora, o
   * que ficou salvo de uma conexão anterior, e só então um genérico. Em nenhum
   * ponto entra nome de modelo — a ficha não está confirmada (docs §4).
   */
  const nomeVisivel =
    conexao?.deviceName ?? aparelho?.display_name ?? "O aparelho que você conectou";

  /** Última sincronização bem-sucedida: gravação confirmada, não conexão. */
  const ultimaSync = ultimaGravacao ?? aparelho?.last_sync_at ?? null;

  const estado: EstadoPulseira = useMemo(() => {
    if (conectando) return "conectando";
    if (importando || sync.progresso.fase || encerrando) return "sincronizando";
    if (erro) return "falhou";
    if (conexao) return gravadasNaSessao > 0 ? "atualizada" : "sincronizando";
    if (!ultimaSync) return "nao_conectada";
    return diasDesde(ultimaSync) > DIAS_PARA_ATRASO ? "atrasada" : "atualizada";
  }, [conectando, importando, sync.progresso.fase, encerrando, erro, conexao, gravadasNaSessao, ultimaSync]);

  const info = ESTADO[estado];

  /** O que chegou nos últimos 7 dias, por tipo — só o que veio de aparelho. */
  const chegou = useMemo(() => {
    const corte = Date.now() - 7 * 86_400_000;
    const recente = (iso?: string | null) => !!iso && new Date(iso).getTime() >= corte;
    return [
      { rotulo: "batimentos", n: hr.readings.filter((r) => doAparelho(r) && recente(r.recorded_at)).length },
      { rotulo: "oxigenação", n: spo2.readings.filter((r) => doAparelho(r) && recente(r.recorded_at)).length },
      { rotulo: "pressão (estimativa)", n: bp.readings.filter((r) => doAparelho(r) && recente(r.recorded_at)).length },
      { rotulo: "dias de passos", n: atividade.records.filter((r) => doAparelho(r) && recente(r.activity_date)).length },
      { rotulo: "noites de sono", n: sono.records.filter((r) => doAparelho(r) && recente(r.sleep_date)).length },
    ].filter((x) => x.n > 0);
  }, [hr.readings, spo2.readings, bp.readings, atividade.records, sono.records]);

  // ── Conectar ──────────────────────────────────────────────────────

  const conectar = async () => {
    const impedimento = motivoIndisponivel();
    if (impedimento) { setErro(impedimento); return; }
    setErro(null);
    setConectando(true);
    setGravadasNaSessao(0);
    sync.reiniciarThrottle();

    try {
      const con = await conectarPulseira({
        onSample: (s) => {
          setAmostra(s);
          // Throttle e modo demo ficam dentro do hook: aqui só tentamos.
          sync
            .gravarAmostra(s, { deviceId: idDoAparelhoRef.current, deviceName: nomeDoAparelhoRef.current })
            .then(async (gravou) => {
              if (!gravou) return;
              const quando = new Date().toISOString();
              setGravadasNaSessao((n) => n + 1);
              setUltimaGravacao(quando);
              try { await sync.marcarSincronizacao(idDoAparelhoRef.current, quando); } catch { /* o dado já entrou */ }
            })
            .catch(() => {
              // Falha de rede no meio da sessão não derruba a tela: o hook
              // devolve o relógio do throttle e a próxima batida tenta de novo.
              setErro("Perdi a conexão com a internet no meio do envio. As próximas medidas continuam tentando.");
            });
        },
        onDisconnect: () => { setConexao(null); setAmostra(null); },
      });

      setConexao(con);
      nomeDoAparelhoRef.current = con.deviceName;

      // Registrar o aparelho ANTES de gravar leitura: `source_device_id` é
      // chave estrangeira. Se falhar, seguimos com id nulo — perder o vínculo
      // com o aparelho é ruim, perder a medida do paciente é pior.
      try {
        idDoAparelhoRef.current = await sync.registrarDispositivo({
          deviceName: con.deviceName,
          firmware: con.firmware,
          protocolo: "ble",
          externalId: con.deviceId,
          vitalTypes: ["heart_rate", "hrv"],
        });
      } catch {
        idDoAparelhoRef.current = null;
      }

      con.readBattery().then(setBateria).catch(() => {});
      toast.success("Aparelho conectado. Fique parado um minuto para a primeira medida ser salva.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui conectar. Tente de novo.");
    } finally {
      setConectando(false);
    }
  };

  /**
   * Encerrar salva a última amostra sem esperar o throttle — senão a sessão
   * termina jogando fora até um minuto de medida.
   */
  const encerrar = async () => {
    setEncerrando(true);
    try {
      const gravou = await sync
        .gravarUltimaAmostra({ deviceId: idDoAparelhoRef.current, deviceName: nomeDoAparelhoRef.current })
        .catch(() => false);
      if (gravou) {
        const quando = new Date().toISOString();
        setGravadasNaSessao((n) => n + 1);
        setUltimaGravacao(quando);
        try { await sync.marcarSincronizacao(idDoAparelhoRef.current, quando); } catch { /* já entrou */ }
      }
      await conexao?.disconnect();
      setConexao(null);
      setAmostra(null);
      toast.success(
        gravou || gravadasNaSessao > 0
          ? "Pronto. Suas medidas foram salvas."
          : "Aparelho desconectado. Nada foi salvo nesta sessão."
      );
    } finally {
      setEncerrando(false);
    }
  };

  // ── Importação de arquivo ─────────────────────────────────────────

  const escolherArquivo = () => fileRef.current?.click();

  const onArquivo = async (f?: File | null) => {
    if (!f) return;
    setErro(null);
    setResumo(null);
    setMapaManual({});
    const texto = await f.text();
    setTextoArquivo(texto);
    setPrevia(importarCsv(texto));
  };

  /** Reprocessa o arquivo com o mapeamento que o paciente confirmou. */
  const relerComMapa = useCallback(() => {
    if (!textoArquivo) return;
    setPrevia(importarCsv(textoArquivo, mapaManual));
  }, [textoArquivo, mapaManual]);

  const cancelarImportacao = () => {
    setPrevia(null);
    setTextoArquivo(null);
    setMapaManual({});
  };

  const confirmarImportacao = async () => {
    if (!previa || previa.linhas.length === 0) return;
    setImportando(true);
    setErro(null);
    try {
      const r = await sync.importar(previa.linhas, {
        deviceName: aparelho?.display_name ?? conexao?.deviceName ?? "Pulseira (arquivo importado)",
        protocolo: "import",
      });
      setResumo(r);
      if (r.importados > 0) setUltimaGravacao(new Date().toISOString());
      if (sync.demo) toast.info("Modo demo: nada foi salvo.");
      else if (r.importados > 0) toast.success("Arquivo importado. Seu médico já consegue ver.");
      else if (r.ignorados > 0) toast.info("Esse arquivo já tinha sido importado. Nada novo foi adicionado.");
      else toast.error("Não consegui salvar nada deste arquivo.");
      cancelarImportacao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui importar o arquivo. Tente de novo.");
    } finally {
      setImportando(false);
    }
  };

  // ── Diagnóstico (dentro da ajuda) ─────────────────────────────────

  const testarPulseira = async () => {
    const impedimento = motivoIndisponivel();
    if (impedimento) { setErroDiagnostico(impedimento); return; }
    setErroDiagnostico(null);
    setDiagnosticando(true);
    try {
      setDiagnostico(await diagnosticarPulseira());
      setTecnicoAberto(false);
    } catch (e) {
      setErroDiagnostico(e instanceof Error ? e.message : "Não consegui testar o aparelho. Tente de novo.");
    } finally {
      setDiagnosticando(false);
    }
  };

  const copiarDetalhesTecnicos = async () => {
    if (!diagnostico) return;
    const texto = [
      `Dispositivo: ${diagnostico.nome} (${diagnostico.id})`,
      `Firmware: ${diagnostico.firmware ?? "não informado"}`,
      `Bateria: ${diagnostico.bateria != null ? `${diagnostico.bateria}%` : "não informada"}`,
      "Serviços GATT encontrados:",
      ...diagnostico.servicos.map(
        (s) => `  - ${s.uuid} — ${s.nome} — ${s.caracteristicas} característica${s.caracteristicas === 1 ? "" : "s"} — ${s.suportado ? "usado pelo app" : "não usado pelo app"}`,
      ),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Detalhes técnicos copiados.");
    } catch {
      toast.error("Não consegui copiar. Anote pelo bloco de detalhes.");
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Pulseira" />
        <TabPageSkeleton />
      </div>
    );
  }

  const bateriaVisivel = bateria ?? diagnostico?.bateria ?? null;

  return (
    <div className="pb-10">
      <PageHeader title="Pulseira" subtitle="O aparelho que você usa no pulso" />

      {/* ══ Tela principal: estado, última sincronização, uma ação ══ */}
      <div className="mb-6">
        <SurfaceCard className="border-2 border-primary/20">
          <div className="flex items-start gap-3 mb-4">
            <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
              <Watch className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground truncate">{nomeVisivel}</p>
              <p className="text-xs text-muted-foreground">{info.frase}</p>
            </div>
            <StatusBadge variant={info.variante} className="shrink-0">{info.titulo}</StatusBadge>
          </div>

          {/* O número que importa: quando o dado chegou de verdade. */}
          <div className="rounded-2xl bg-cardio-50 p-4 mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
              Última vez que seus dados foram salvos
            </p>
            <p className="text-xl font-bold text-foreground leading-tight flex items-center gap-2 flex-wrap">
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              {fmtDataHora(ultimaSync) ?? "Ainda não recebi nada"}
            </p>
            {bateriaVisivel != null && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Battery className="h-3.5 w-3.5" /> Bateria do aparelho: {bateriaVisivel}%
              </p>
            )}
          </div>

          {/* O que chegou */}
          <div className="mb-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
              O que chegou nos últimos 7 dias
            </p>
            {chegou.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {chegou.map((c) => (
                  <span key={c.rotulo} className="text-xs rounded-full bg-muted px-2.5 py-1 text-foreground">
                    {c.n} {c.rotulo}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma medida nova nos últimos 7 dias.</p>
            )}
          </div>

          {/* Batimento ao vivo — informação da sessão, não prova de envio. */}
          {conexao && (
            <div className="rounded-2xl bg-muted/50 py-4 text-center mb-4">
              <HeartPulse className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-4xl font-bold text-foreground">{amostra?.bpm ?? "—"}</p>
              <p className="text-xs text-muted-foreground">batimentos por minuto, agora</p>
              <p className="text-xs text-muted-foreground mt-1">
                {gravadasNaSessao > 0
                  ? `${gravadasNaSessao} medida${gravadasNaSessao === 1 ? "" : "s"} salva${gravadasNaSessao === 1 ? "" : "s"} nesta sessão`
                  : "A primeira medida é salva depois de um minuto conectado"}
              </p>
            </div>
          )}

          {/* UMA ação principal. */}
          {!conexao ? (
            <Button size="xl" className="w-full gap-2" onClick={conectar} disabled={conectando}>
              {bluetoothDisponivel() ? <Bluetooth className="h-5 w-5 shrink-0" /> : <BluetoothOff className="h-5 w-5 shrink-0" />}
              <span className="truncate">{conectando ? "Conectando..." : "Conectar aparelho"}</span>
            </Button>
          ) : (
            <Button size="xl" className="w-full gap-2" onClick={encerrar} disabled={encerrando}>
              {encerrando ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
              <span className="truncate">{encerrando ? "Salvando..." : "Encerrar e salvar"}</span>
            </Button>
          )}

          {erro && (
            <p className="text-sm text-warning mt-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          {sync.demo && (
            <p className="text-xs text-muted-foreground mt-3">
              Você está no modo demonstração: nada é salvo de verdade.
            </p>
          )}
        </SurfaceCard>
      </div>

      {/* ══ Importar arquivo ═════════════════════════════════════════ */}
      <div className="mb-6">
        <SectionHeader title="Importar arquivo" subtitle="funciona no iPhone também" />
        <SurfaceCard>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ""; }}
          />

          {!previa ? (
            <>
              {/*
                Rótulo curto e `truncate`: em tela de 360 px o texto anterior
                ("Escolher arquivo do QWatch PRO") estourava a largura do botão —
                e ainda citava o app do fabricante como se fosse fato.
              */}
              <Button size="lg" variant="outline" className="w-full gap-2 px-4" onClick={escolherArquivo}>
                <Upload className="h-4 w-4 shrink-0" />
                <span className="truncate">Importar arquivo</span>
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Use o arquivo que o aplicativo do seu aparelho exporta. Você confere tudo antes de salvar.
              </p>
            </>
          ) : previa.precisaConfirmacao ? (
            /* ── Não reconhecemos as colunas: perguntar em vez de adivinhar ── */
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Preciso de uma ajuda com este arquivo</p>
              <p className="text-xs text-muted-foreground mb-3">
                Não consegui reconhecer as colunas sozinho. Diga o que é cada uma — se não houver, deixe em branco.
              </p>
              <div className="space-y-2 mb-3">
                {ORDEM_CAMPOS.map((campo) => (
                  <div key={campo} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-32 shrink-0">{CAMPO_ROTULO[campo]}</span>
                    <Select
                      value={mapaManual[campo] !== undefined ? String(mapaManual[campo]) : "nenhuma"}
                      onValueChange={(v) =>
                        setMapaManual((m) => {
                          const novo = { ...m };
                          if (v === "nenhuma") delete novo[campo];
                          else novo[campo] = Number(v);
                          return novo;
                        })
                      }
                    >
                      <SelectTrigger className="h-9 flex-1 min-w-0 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhuma">Não tem</SelectItem>
                        {previa.cabecalho.map((c, i) => (
                          <SelectItem key={`${c}-${i}`} value={String(i)}>
                            {c || `Coluna ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {previa.avisos.map((a) => (
                <p key={a} className="text-xs text-warning flex items-start gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {a}
                </p>
              ))}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button size="lg" className="flex-1 min-w-[140px]" onClick={relerComMapa} disabled={mapaManual.recordedAt === undefined}>
                  <span className="truncate">Ver o que vai entrar</span>
                </Button>
                <Button size="lg" variant="outline" onClick={cancelarImportacao}>Cancelar</Button>
              </div>
            </div>
          ) : (
            /* ── Prévia: o paciente vê antes de gravar ── */
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Confira antes de salvar</p>

              <div className="rounded-xl bg-muted/50 p-3 mb-3">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Período: {previa.periodo ? `${fmtDia(previa.periodo.inicio)} a ${fmtDia(previa.periodo.fim)}` : "não identificado"}
                </p>
                <ul className="space-y-0.5 text-sm text-foreground">
                  <li>{previa.contagem.batimentos} medidas de batimentos</li>
                  <li>{previa.contagem.oxigenacao} medidas de oxigenação</li>
                  <li>{previa.contagem.pressao} medidas de pressão (estimativa)</li>
                  <li>{previa.contagem.atividade} dias de passos</li>
                  <li>{previa.contagem.sono} noites de sono</li>
                </ul>
                {previa.ignoradas > 0 && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {previa.ignoradas} linha{previa.ignoradas === 1 ? "" : "s"} do arquivo não pôde ser lida.
                  </p>
                )}
              </div>

              {previa.exemplos.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">
                    Exemplos do que li
                  </p>
                  <ul className="space-y-1.5">
                    {previa.exemplos.map((ex, i) => (
                      <li key={`${ex.quando}-${i}`} className="rounded-xl bg-muted/50 px-3 py-2 text-sm text-foreground">
                        <span className="text-muted-foreground">{ex.quando}</span>
                        {ex.itens.length > 0 && " · "}
                        {ex.itens.map((it) => `${it.rotulo}: ${it.valor}`).join(" · ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {previa.colunasReconhecidas.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">
                  Colunas lidas: {previa.colunasReconhecidas.join(" · ")}
                </p>
              )}
              {previa.avisos.map((a) => (
                <p key={a} className="text-xs text-warning flex items-start gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {a}
                </p>
              ))}

              {sync.progresso.fase === "gravando" && sync.progresso.total > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Salvando {sync.progresso.feitos} de {sync.progresso.total}...
                </p>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  size="lg"
                  className="flex-1 min-w-[140px]"
                  onClick={confirmarImportacao}
                  disabled={importando || previa.linhas.length === 0}
                >
                  <span className="truncate">{importando ? "Salvando..." : "Salvar no meu histórico"}</span>
                </Button>
                <Button size="lg" variant="outline" onClick={cancelarImportacao} disabled={importando}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* ── Resumo do que entrou, por tipo ── */}
          {resumo && (
            <div className="mt-4 rounded-xl bg-muted/50 p-3">
              <p className="text-sm font-semibold text-foreground mb-2">Resultado da importação</p>
              <ul className="space-y-1 text-sm text-foreground">
                {TIPOS.map((t) => {
                  const c = resumo.porTipo[t];
                  if (c.importados + c.ignorados + c.falhas === 0) return null;
                  return (
                    <li key={t}>
                      <span className="font-medium">{TIPO_ROTULO[t]}:</span>{" "}
                      {c.importados} novo{c.importados === 1 ? "" : "s"}
                      {c.ignorados > 0 && ` · ${c.ignorados} já estava${c.ignorados === 1 ? "" : "m"} no app`}
                      {c.falhas > 0 && ` · ${c.falhas} não entrou`}
                    </li>
                  );
                })}
              </ul>
              {resumo.ignorados > 0 && resumo.importados === 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Você já tinha importado esse arquivo. Nada foi duplicado.
                </p>
              )}
              {resumo.falhas > 0 && (
                <p className="text-xs text-warning mt-2">
                  Algumas linhas não puderam ser salvas. Você pode tentar importar de novo — o que já entrou não se repete.
                </p>
              )}
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* ══ O que mede, o que estima ═════════════════════════════════ */}
      <div className="mb-6">
        <SectionHeader title="O que este aparelho mede — e o que ele estima" icon={Info} />
        <div className="space-y-3">
          <SurfaceCard className="bg-success-bg border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-success mb-1.5">Mede de verdade</p>
            <p className="text-sm text-foreground leading-relaxed">
              O sensor de luz no pulso mede seus batimentos e a oxigenação do sangue. O sensor de movimento conta
              passos, distância e o seu sono, pelo jeito que você se mexe na cama.
            </p>
          </SurfaceCard>
          <SurfaceCard className="bg-warning-bg border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-warning mb-1.5">Estima — não usar para decisão clínica</p>
            <p className="text-sm text-foreground leading-relaxed">
              A "pressão" que o aparelho mostra é um cálculo feito pelo mesmo sensor de luz do pulso, sem manguito e
              sem validação médica. O app marca essa leitura como estimativa: ela nunca entra na sua média de
              pressão nem dispara aviso. Para pressão de verdade, use sempre o aparelho de braço.
            </p>
          </SurfaceCard>
          <SurfaceCard className="bg-muted/50 border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Este aparelho não tem</p>
            <p className="text-sm text-foreground leading-relaxed">
              Eletrocardiograma (ECG), temperatura do corpo e glicemia. Se você viu esses termos no anúncio, saiba
              que este aparelho não faz essas medidas.
            </p>
          </SurfaceCard>
        </div>
      </div>

      {/* ══ Ajuda e detalhes do aparelho (recolhido) ═════════════════ */}
      <div>
        <SurfaceCard>
          <button
            type="button"
            onClick={() => setAjudaAberta((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {ajudaAberta ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
            <span className="text-sm font-semibold text-foreground">Ajuda e detalhes do aparelho</span>
          </button>

          {ajudaAberta && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                Cada aparelho desses vem de um lote diferente e nem todos falam a mesma língua. Este teste conecta
                uma vez e diz o que o seu, especificamente, consegue enviar para o app.
              </p>

              <Button size="lg" variant="outline" className="w-full gap-2 px-4" onClick={testarPulseira} disabled={diagnosticando}>
                <RefreshCw className={`h-4 w-4 shrink-0 ${diagnosticando ? "animate-spin" : ""}`} />
                <span className="truncate">{diagnosticando ? "Testando..." : "Testar meu aparelho"}</span>
              </Button>

              {erroDiagnostico && (
                <p className="text-sm text-warning mt-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {erroDiagnostico}
                </p>
              )}

              {diagnostico && (
                <div className="mt-4">
                  <div className="rounded-2xl bg-cardio-50 p-4 mb-4">
                    <p className="text-sm font-semibold text-foreground leading-relaxed">{diagnostico.resumo}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4 text-sm">
                    <div className="rounded-xl bg-muted/50 px-3 py-2 min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Nome do aparelho</p>
                      <p className="text-foreground font-medium truncate">{diagnostico.nome}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-3 py-2 min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Versão interna</p>
                      <p className="text-foreground font-medium truncate">{diagnostico.firmware ?? "não informada"}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 px-3 py-2 min-w-0">
                      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Bateria</p>
                      <p className="text-foreground font-medium flex items-center gap-1">
                        <Battery className="h-3.5 w-3.5 shrink-0" /> {diagnostico.bateria != null ? `${diagnostico.bateria}%` : "—"}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">O que foi encontrado</p>
                  <ul className="space-y-1.5 mb-4">
                    {diagnostico.servicos.map((s) => (
                      <li key={s.uuid} className="flex items-center gap-2 text-sm text-foreground">
                        <Circle className={`h-2.5 w-2.5 shrink-0 ${s.suportado ? "fill-success text-success" : "fill-muted-foreground text-muted-foreground"}`} />
                        <span className="flex-1 min-w-0">{s.nome}</span>
                        <span className={`text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${s.suportado ? "bg-success-bg text-success" : "bg-muted text-muted-foreground"}`}>
                          {s.suportado ? "o app usa" : "só pelo app do aparelho"}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => setTecnicoAberto((v) => !v)}
                    className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2"
                  >
                    {tecnicoAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Detalhes técnicos
                  </button>
                  {tecnicoAberto && (
                    <div className="rounded-xl bg-muted/50 p-3 mb-3 overflow-x-auto">
                      <p className="text-xs text-muted-foreground mb-2">
                        Para mandar ao fornecedor junto com o pedido do SDK.
                      </p>
                      <ul className="space-y-1 font-mono text-xs text-foreground">
                        {diagnostico.servicos.map((s) => (
                          <li key={s.uuid}>
                            {s.uuid} · {s.caracteristicas} característica{s.caracteristicas === 1 ? "" : "s"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <Button variant="outline" className="w-full gap-2 px-4" onClick={copiarDetalhesTecnicos}>
                    <ClipboardCopy className="h-4 w-4 shrink-0" />
                    <span className="truncate">Copiar detalhes técnicos</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
