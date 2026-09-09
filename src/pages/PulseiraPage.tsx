/**
 * PulseiraPage — a pulseira H59.
 *
 * Conexão Bluetooth com FC ao vivo, importação de arquivo do app da
 * pulseira, e uma seção honesta sobre o que é medida real e o que é
 * estimativa (docs §4 — a PA da pulseira nunca decide nada clinicamente).
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Watch, Bluetooth, BluetoothOff, HeartPulse, Upload, CheckCircle2,
  AlertTriangle, Info, Battery, Stethoscope, ChevronDown, ChevronRight,
  ClipboardCopy, Circle,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useDevices } from "@/hooks/useCardioClinical";
import { useHeartRate, useSpo2 } from "@/hooks/useCardioReadings";
import { useBloodPressure } from "@/hooks/useCardioReadings";
import {
  conectarPulseira, bluetoothDisponivel, motivoIndisponivel, diagnosticarPulseira,
  type BleConnection, type WearableSample, type DiagnosticoPulseira,
} from "@/lib/wearable/bleClient";
import { importarCsv, type ResultadoImportacao } from "@/lib/wearable/importer";
import { linhasParaLeituras } from "@/lib/wearable/normalize";

export default function PulseiraPage() {
  const { user } = useAuth();
  const { devices, isLoading } = useDevices();
  const hr = useHeartRate();
  const spo2 = useSpo2();
  const bp = useBloodPressure();

  const [conectando, setConectando] = useState(false);
  const [conexao, setConexao] = useState<BleConnection | null>(null);
  const [amostra, setAmostra] = useState<WearableSample | null>(null);
  const [bateria, setBateria] = useState<number | null>(null);
  const [erroConexao, setErroConexao] = useState<string | null>(null);

  const [arquivo, setArquivo] = useState<ResultadoImportacao | null>(null);
  const [importando, setImportando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [diagnosticando, setDiagnosticando] = useState(false);
  const [diagnostico, setDiagnostico] = useState<DiagnosticoPulseira | null>(null);
  const [erroDiagnostico, setErroDiagnostico] = useState<string | null>(null);
  const [detalhesAbertos, setDetalhesAbertos] = useState(false);

  useEffect(() => () => { conexao?.disconnect().catch(() => {}); }, [conexao]);

  const conectar = async () => {
    const impedimento = motivoIndisponivel();
    if (impedimento) {
      setErroConexao(impedimento);
      return;
    }
    setErroConexao(null);
    setConectando(true);
    try {
      const con = await conectarPulseira({
        onSample: (s) => setAmostra(s),
        onDisconnect: () => { setConexao(null); setAmostra(null); },
      });
      setConexao(con);
      con.readBattery().then(setBateria).catch(() => {});
      toast.success(`Conectado a ${con.deviceName}.`);
    } catch (e) {
      setErroConexao(e instanceof Error ? e.message : "Não consegui conectar. Tente de novo.");
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    await conexao?.disconnect();
    setConexao(null);
    setAmostra(null);
  };

  const testarPulseira = async () => {
    const impedimento = motivoIndisponivel();
    if (impedimento) {
      setErroDiagnostico(impedimento);
      return;
    }
    setErroDiagnostico(null);
    setDiagnosticando(true);
    try {
      const resultado = await diagnosticarPulseira();
      setDiagnostico(resultado);
      setDetalhesAbertos(false);
    } catch (e) {
      setErroDiagnostico(e instanceof Error ? e.message : "Não consegui testar a pulseira. Tente de novo.");
    } finally {
      setDiagnosticando(false);
    }
  };

  const copiarDetalhesTecnicos = async () => {
    if (!diagnostico) return;
    const linhas = [
      `Dispositivo: ${diagnostico.nome} (${diagnostico.id})`,
      `Firmware: ${diagnostico.firmware ?? "não informado"}`,
      `Bateria: ${diagnostico.bateria != null ? `${diagnostico.bateria}%` : "não informada"}`,
      "Serviços GATT encontrados:",
      ...diagnostico.servicos.map(
        (s) => `  - ${s.uuid} — ${s.nome} — ${s.caracteristicas} característica${s.caracteristicas === 1 ? "" : "s"} — ${s.suportado ? "usado pelo app" : "não usado pelo app"}`,
      ),
    ];
    const texto = linhas.join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Detalhes técnicos copiados.");
    } catch {
      toast.error("Não consegui copiar. Copie manualmente pelo bloco de detalhes.");
    }
  };

  const escolherArquivo = () => fileRef.current?.click();

  const onArquivo = async (f?: File | null) => {
    if (!f) return;
    const texto = await f.text();
    const resultado = importarCsv(texto);
    setArquivo(resultado);
  };

  const confirmarImportacao = async () => {
    if (!arquivo || !user) return;
    setImportando(true);
    try {
      const leituras = linhasParaLeituras(arquivo.linhas, {
        patientUserId: user.id,
        deviceName: "Pulseira (importado)",
      });
      let salvos = 0;
      for (const l of leituras.heartRate.slice(0, 50)) {
        await hr.registrar.mutateAsync({ bpm: l.bpm, context: l.context ?? "resting", recorded_at: l.recorded_at });
        salvos++;
      }
      for (const l of leituras.spo2.slice(0, 50)) {
        await spo2.registrar.mutateAsync({ value: l.value, context: l.context ?? "spot" });
        salvos++;
      }
      for (const l of leituras.bloodPressure.slice(0, 50)) {
        await bp.registrar.mutateAsync({
          systolic: l.systolic, diastolic: l.diastolic, pulse: l.pulse ?? null,
          context: l.context, cuff_validated: false, recorded_at: l.recorded_at,
        });
        salvos++;
      }
      toast.success(`Importação concluída — ${salvos} leitura${salvos === 1 ? "" : "s"} adicionada${salvos === 1 ? "" : "s"}.`);
      setArquivo(null);
    } finally {
      setImportando(false);
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

  const pulseiraCadastrada = devices.find((d) => d.category === "h59");

  return (
    <div className="pb-10">
      <PageHeader title="Pulseira" subtitle="Sua pulseira H59 Max" />

      {/* ── Testar minha pulseira ────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Testar minha pulseira" icon={Stethoscope} subtitle="descubra o que este aparelho realmente faz" />
        <SurfaceCard className="border-2 border-primary/20">
          <Button
            size="xl"
            className="w-full gap-2"
            onClick={testarPulseira}
            disabled={diagnosticando}
          >
            {bluetoothDisponivel() ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
            {diagnosticando ? "Testando..." : "Descobrir o que minha pulseira faz"}
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
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Dispositivo</p>
                  <p className="text-foreground font-medium truncate">{diagnostico.nome}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-3 py-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Firmware</p>
                  <p className="text-foreground font-medium truncate">{diagnostico.firmware ?? "não informado"}</p>
                </div>
                <div className="rounded-xl bg-muted/50 px-3 py-2 flex items-center justify-between sm:block">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">Bateria</p>
                  <p className="text-foreground font-medium flex items-center gap-1">
                    <Battery className="h-3.5 w-3.5" /> {diagnostico.bateria != null ? `${diagnostico.bateria}%` : "—"}
                  </p>
                </div>
              </div>

              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">O que foi encontrado</p>
              <ul className="space-y-1.5 mb-4">
                {diagnostico.servicos.map((s) => (
                  <li key={s.uuid} className="flex items-center gap-2 text-sm text-foreground">
                    <Circle className={`h-2.5 w-2.5 shrink-0 ${s.suportado ? "fill-success text-success" : "fill-muted-foreground text-muted-foreground"}`} />
                    <span className="flex-1">{s.nome}</span>
                    <span className={`text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${s.suportado ? "bg-success-bg text-success" : "bg-muted text-muted-foreground"}`}>
                      {s.suportado ? "o app usa" : "precisa do app do fabricante"}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setDetalhesAbertos((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary mb-2"
              >
                {detalhesAbertos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Detalhes técnicos
              </button>
              {detalhesAbertos && (
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

              <Button variant="outline" className="w-full gap-2" onClick={copiarDetalhesTecnicos}>
                <ClipboardCopy className="h-4 w-4" /> Copiar detalhes técnicos
              </Button>
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* ── Estado do dispositivo ────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Status" icon={Watch} />
        <SurfaceCard>
          {pulseiraCadastrada ? (
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <Watch className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{pulseiraCadastrada.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {pulseiraCadastrada.last_sync_at
                    ? `Última sincronização: ${new Date(pulseiraCadastrada.last_sync_at).toLocaleString("pt-BR")}`
                    : "Nunca sincronizada"}
                </p>
              </div>
              <span className="text-[10.5px] font-bold uppercase tracking-wide rounded-full px-2.5 py-1 bg-success-bg text-success shrink-0">
                {pulseiraCadastrada.status === "active" ? "Ativa" : "Inativa"}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma pulseira cadastrada ainda.</p>
          )}
        </SurfaceCard>
      </div>

      {/* ── Conectar por Bluetooth ───────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Conectar agora" />
        <SurfaceCard>
          {!conexao ? (
            <>
              <Button
                size="xl"
                className="w-full gap-2"
                onClick={conectar}
                disabled={conectando}
              >
                {bluetoothDisponivel() ? <Bluetooth className="h-5 w-5" /> : <BluetoothOff className="h-5 w-5" />}
                {conectando ? "Conectando..." : "Conectar pulseira"}
              </Button>
              {erroConexao && (
                <p className="text-sm text-warning mt-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {erroConexao}
                </p>
              )}
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <p className="text-sm font-semibold text-foreground">Conectado a {conexao.deviceName}</p>
                </div>
                {bateria != null && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Battery className="h-3.5 w-3.5" /> {bateria}%</span>
                )}
              </div>
              <div className="rounded-2xl bg-cardio-50 py-6 text-center mb-4">
                <HeartPulse className="h-6 w-6 text-primary mx-auto mb-1" />
                <p className="text-4xl font-bold text-foreground">{amostra?.bpm ?? "—"}</p>
                <p className="text-xs text-muted-foreground">batimentos por minuto, ao vivo</p>
              </div>
              <Button variant="outline" className="w-full" onClick={desconectar}>Desconectar</Button>
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* ── Importar arquivo ─────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Importar do app da pulseira" subtitle="funciona no iPhone também" />
        <SurfaceCard>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => { onArquivo(e.target.files?.[0]); e.target.value = ""; }}
          />
          {!arquivo ? (
            <Button size="lg" variant="outline" className="w-full gap-2" onClick={escolherArquivo}>
              <Upload className="h-4 w-4 shrink-0" /> <span className="truncate">Escolher arquivo do QWatch PRO</span>
            </Button>
          ) : (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">
                {arquivo.linhas.length} leitura{arquivo.linhas.length === 1 ? "" : "s"} reconhecida{arquivo.linhas.length === 1 ? "" : "s"}
                {arquivo.ignoradas > 0 ? ` · ${arquivo.ignoradas} ignorada${arquivo.ignoradas === 1 ? "" : "s"}` : ""}
              </p>
              {arquivo.colunasReconhecidas.length > 0 && (
                <p className="text-xs text-muted-foreground mb-2">Colunas: {arquivo.colunasReconhecidas.join(", ")}</p>
              )}
              {arquivo.avisos.map((a) => (
                <p key={a} className="text-xs text-warning flex items-start gap-1.5 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {a}
                </p>
              ))}
              <div className="flex gap-2 mt-3">
                <Button size="lg" className="flex-1" onClick={confirmarImportacao} disabled={importando || arquivo.linhas.length === 0}>
                  {importando ? "Importando..." : "Confirmar importação"}
                </Button>
                <Button size="lg" variant="outline" onClick={() => setArquivo(null)}>Cancelar</Button>
              </div>
            </div>
          )}
        </SurfaceCard>
      </div>

      {/* ── O que é medida real, o que é estimativa ──────────────── */}
      <div>
        <SectionHeader title="O que esta pulseira mede — e o que ela estima" icon={Info} />
        <div className="space-y-3">
          <SurfaceCard className="bg-success-bg border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-success mb-1.5">Mede de verdade</p>
            <p className="text-sm text-foreground leading-relaxed">
              O sensor de luz no pulso mede seus batimentos e a oxigenação do sangue. O acelerômetro conta passos,
              distância e o seu sono, pelo seu movimento na cama.
            </p>
          </SurfaceCard>
          <SurfaceCard className="bg-warning-bg border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-warning mb-1.5">Estima — não usar para decisão clínica</p>
            <p className="text-sm text-foreground leading-relaxed">
              A "pressão" que a pulseira mostra é um cálculo feito pelo mesmo sensor de luz do pulso, sem manguito e
              sem validação médica. O app marca essa leitura como estimativa: ela nunca entra na sua média de
              pressão nem dispara alerta. Para pressão de verdade, use sempre o aparelho de braço.
            </p>
          </SurfaceCard>
          <SurfaceCard className="bg-muted/50 border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Esta pulseira não tem</p>
            <p className="text-sm text-foreground leading-relaxed">
              Eletrocardiograma (ECG), temperatura do corpo e glicemia. Se você viu esses termos no anúncio, saiba
              que este aparelho não faz essas medidas.
            </p>
          </SurfaceCard>
        </div>
      </div>

      {devices.length === 0 && (
        <div className="mt-6">
          <EmptyState icon={Watch} title="Nenhum dispositivo ainda" description="Conecte sua pulseira ou importe um arquivo para começar." variant="card" />
        </div>
      )}
    </div>
  );
}
