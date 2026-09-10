/**
 * DETALHE DO PACIENTE — "a tela que economiza a consulta" (docs §2.7, §5).
 *
 * Cabeçalho + resumo clínico entre consultas + alvos vs. atual + gráficos +
 * medicações/titulação + exames + escores + anotações do médico. Tudo com
 * data e origem — é o que se vende ao cardiologista.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, MessageSquare, Pencil, Pill, FlaskConical, HeartPulse,
  Activity, Moon, Scale, ClipboardList, StickyNote, AlertTriangle, Info,
  TrendingUp, Gauge, Footprints, Salad, Smile, HelpCircle, UserCheck, Siren, Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ReferenceLine, Legend, Scatter, ComposedChart,
} from "recharts";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { PlanoMonitoramentoEditor } from "@/components/pro/PlanoMonitoramentoEditor";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

import { useCardioPatient, useTargets, useSalvarTargets } from "@/hooks/useCardioPatient";
import {
  useBloodPressure, useHeartRate, useWeight, useSleep, useActivity, useSpo2,
} from "@/hooks/useCardioReadings";
import { useCardioMedications, MED_CLASS_LABEL, MED_CLASS_MONITORAR } from "@/hooks/useCardioMedications";
import {
  useSymptoms, useLabResults, useCardioExams, useCardioAlerts, useRiskAssessment,
} from "@/hooks/useCardioClinical";
import { useProfessionalProfile, useCuidadoresDoPaciente } from "@/hooks/useProfessional";
import {
  useIdadeDoCoracao, useTempoNoAlvo, useCapacidade, useCaminhadas,
  useCheckins, useSodio, useQualidadeDeVida,
} from "@/hooks/useEngajamento";

import { RISK_LABEL, mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { avaliarMeta, RISK_CATEGORY_LABEL } from "@/lib/clinical/cardioTargets";
import {
  calcularIMC, classificarIMC, calcularTFG, idadeEmAnos, cha2ds2VascDoPaciente,
  hasBled, framinghamRisco10a,
} from "@/lib/clinical/scores";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import type { TipoTeste } from "@/lib/clinical/capacity";
import { DOMAIN_COLORS } from "@/theme/colors";
import type { RiskLevel, MedClass, CardioExamType, CardioMedication, WellbeingCheckin } from "@/types/cardio";

const RISK_BADGE_VARIANT: Record<RiskLevel, "urgencia" | "atencao" | "concluido"> = {
  red: "urgencia", yellow: "atencao", green: "concluido",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function relTime(iso?: string | null): string {
  if (!iso) return "sem registro";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "agora";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}
function chartDay(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const EXAM_TYPE_LABEL: Record<CardioExamType, string> = {
  ecg: "ECG de repouso", echocardiogram: "Ecocardiograma", stress_test: "Teste ergométrico",
  holter: "Holter 24h", abpm: "MAPA 24h", coronary_ct: "Angio-TC de coronárias",
  myocardial_spect: "Cintilografia miocárdica", cardiac_mri: "RM cardíaca",
  catheterization: "Cateterismo", carotid_doppler: "Doppler de carótidas",
};
const FIELD_LABEL: Record<string, string> = {
  ritmo: "Ritmo", fc: "FC", pr: "PR", qrs: "QRS", qtc: "QTc", alteracoes: "Alterações",
  fevi: "FEVE (%)", metodo: "Método", atrio_esquerdo: "AE (mm)", psap: "PSAP",
  disfuncao_diastolica: "Disfunção diastólica", strain_global: "Strain global",
  fc_media: "FC média", fc_min: "FC mín", fc_max: "FC máx", pausas: "Pausas",
  esv: "ESV", essv: "ESSV", tvns: "TVNS", fa_percentual: "% em FA",
  vasos: "Vasos", conduta: "Conduta", stents: "Stents",
};

const AREA_ICON: Record<string, typeof HeartPulse> = {
  pressao: HeartPulse, coracao: Activity, sono: Moon, atividade: Activity, metabolico: FlaskConical,
};

export default function ProPatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { profile: doctor } = useProfessionalProfile();

  const { data: patient, isLoading: loadingPatient } = useCardioPatient(patientId);
  const { risk, isLoading: loadingRisk } = useRiskAssessment(patientId);
  const { targets, ehSugestao } = useTargets(patientId);
  const salvarTargets = useSalvarTargets();

  const bp = useBloodPressure(patientId);
  const hr = useHeartRate(patientId);
  const weight = useWeight(patientId);
  const sleep = useSleep(patientId);
  const activity = useActivity(patientId);
  const spo2 = useSpo2(patientId);
  const { symptoms } = useSymptoms(patientId);
  const { labs, ultimoPorMarcador } = useLabResults(patientId);
  const { exams } = useCardioExams(patientId);
  const { alerts } = useCardioAlerts(patientId);
  const meds = useCardioMedications(patientId);

  const idadeCoracao = useIdadeDoCoracao(patientId);
  const tempoNoAlvo = useTempoNoAlvo(patientId);
  const capacidade = useCapacidade(patientId);
  const caminhadas = useCaminhadas(patientId);
  const checkins = useCheckins(patientId);
  const sodio = useSodio(patientId);
  const qualidadeDeVida = useQualidadeDeVida(patientId);
  const cuidadores = useCuidadoresDoPaciente(patientId);

  const [tab, setTab] = useState<"resumo" | "engajamento" | "medicacoes" | "exames" | "escores" | "notas">("resumo");
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [titrationMed, setTitrationMed] = useState<CardioMedication | null>(null);
  const [notes, setNotes] = useState<{ id: string; text: string; at: string }[]>([]);
  const [draftNote, setDraftNote] = useState("");

  const idade = idadeEmAnos(patient?.birth_date ?? null);
  const mrpa = useMemo(() => mediaMrpa(bp.readings, new Date(), 7), [bp.readings]);
  const mrpa14 = useMemo(() => mediaMrpa(bp.readings, new Date(), 14), [bp.readings]);
  const estimadasBp = useMemo(
    () => bp.readings.filter((r) => r.validation_status === "estimated").slice(0, 5),
    [bp.readings],
  );

  const pesoRecente = weight.readings.slice(0, 8);
  const varPeso = pesoRecente.length >= 2 ? pesoRecente[0].value - pesoRecente[pesoRecente.length - 1].value : null;

  const sintomasPeriodo = useMemo(
    () => symptoms.filter((s) => Date.now() - new Date(s.occurred_at).getTime() <= 21 * 86400000),
    [symptoms],
  );
  const examesNovos = useMemo(
    () => exams.filter((e) => e.performed_at && Date.now() - new Date(e.performed_at).getTime() <= 45 * 86400000),
    [exams],
  );
  const alertasPeriodo = useMemo(
    () => alerts.filter((a) => Date.now() - new Date(a.triggered_at).getTime() <= 21 * 86400000),
    [alerts],
  );
  const adesao14 = meds.adesao?.d14 ?? null;

  const resumoParagrafo = useMemo(() => {
    if (loadingRisk) return "";
    const partes: string[] = [];
    if (mrpa) partes.push(`pressão média de ${mrpa.systolic}/${mrpa.diastolic} mmHg em ${mrpa.n} medidas validadas nos últimos 7 dias`);
    else partes.push("sem medidas de pressão validadas suficientes para MRPA nos últimos 7 dias");
    if (varPeso != null) partes.push(`peso ${varPeso > 0 ? "subiu" : varPeso < 0 ? "caiu" : "manteve-se"} ${Math.abs(varPeso).toFixed(1)} kg no período`);
    if (adesao14 != null) partes.push(`adesão medicamentosa de ${Math.round(adesao14 * 100)}% em 14 dias`);
    if (sintomasPeriodo.length > 0) partes.push(`${sintomasPeriodo.length} sintoma${sintomasPeriodo.length > 1 ? "s" : ""} relatado${sintomasPeriodo.length > 1 ? "s" : ""}`);
    if (examesNovos.length > 0) partes.push(`${examesNovos.length} exame${examesNovos.length > 1 ? "s" : ""} novo${examesNovos.length > 1 ? "s" : ""}`);
    if (alertasPeriodo.length > 0) partes.push(`${alertasPeriodo.length} alerta${alertasPeriodo.length > 1 ? "s" : ""} disparado${alertasPeriodo.length > 1 ? "s" : ""}`);
    const frase = partes.length > 0
      ? `Nas últimas 3 semanas, ${patient?.full_name ?? "o paciente"} apresentou ${partes.join("; ")}.`
      : `Sem registros suficientes nas últimas 3 semanas para compor um resumo.`;
    return frase;
  }, [mrpa, varPeso, adesao14, sintomasPeriodo, examesNovos, alertasPeriodo, patient, loadingRisk]);

  // ── Escores ────────────────────────────────────────────────────────
  const cha2ds2vasc = patient && patient.history?.atrial_fibrillation ? cha2ds2VascDoPaciente(patient) : null;
  const anticoagulado = meds.ativas.some((m) => m.med_class === "anticoagulant");
  const hasBledScore = useMemo(() => {
    if (!patient || !anticoagulado) return null;
    const creat = ultimoPorMarcador.get("creatinine")?.value_num ?? null;
    return hasBled({
      hypertensionUncontrolled: !!patient.comorbidities?.hypertension,
      abnormalRenal: creat != null && creat > 1.5,
      abnormalLiver: false,
      stroke: !!patient.history?.stroke_tia,
      bleedingHistory: false,
      labileInr: false,
      elderly: (idade ?? 0) > 65,
      drugs: true,
      alcohol: (patient.alcohol_units_week ?? 0) > 14,
    });
  }, [patient, anticoagulado, ultimoPorMarcador, idade]);

  const imc = patient?.height_cm && weight.ultimo ? calcularIMC(weight.ultimo.value, patient.height_cm) : null;
  const tfg = useMemo(() => {
    const creat = ultimoPorMarcador.get("creatinine")?.value_num ?? null;
    if (!creat || idade == null || !patient?.sex) return null;
    return calcularTFG(creat, idade, patient.sex);
  }, [ultimoPorMarcador, idade, patient]);

  const prevencaoPrimaria = patient
    ? !(patient.history?.previous_mi || patient.history?.stable_angina || patient.history?.heart_failure
      || patient.history?.pci || patient.history?.cabg || patient.history?.stroke_tia || patient.history?.pad)
    : false;
  const framingham = useMemo(() => {
    if (!prevencaoPrimaria || !patient?.sex || idade == null) return null;
    const ct = ultimoPorMarcador.get("total_cholesterol")?.value_num ?? null;
    const hdlv = ultimoPorMarcador.get("hdl")?.value_num ?? null;
    const sistolica = mrpa14?.systolic ?? mrpa?.systolic ?? null;
    if (!ct || !hdlv || !sistolica) return null;
    return framinghamRisco10a({
      age: idade, sex: patient.sex, totalCholesterol: ct, hdl: hdlv, systolic: sistolica,
      treatedForHypertension: meds.ativas.some((m) => m.med_class === "acei" || m.med_class === "arb" || m.med_class === "ccb" || m.med_class === "thiazide"),
      smoker: patient.smoking_status === "current",
      diabetes: !!patient.comorbidities?.diabetes,
    });
  }, [prevencaoPrimaria, patient, idade, ultimoPorMarcador, mrpa14, mrpa, meds.ativas]);

  if (loadingPatient) {
    return <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 py-6"><TabPageSkeleton /></div>;
  }
  if (!patient) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 py-6">
        <EmptyState icon={AlertTriangle} title="Paciente não encontrado" description="Verifique o vínculo em Pacientes." variant="card" />
      </div>
    );
  }

  const TABS = [
    { key: "resumo" as const, label: "Resumo e alvos", icon: ClipboardList },
    { key: "engajamento" as const, label: "Engajamento", icon: TrendingUp },
    { key: "medicacoes" as const, label: "Medicações", icon: Pill },
    { key: "exames" as const, label: "Exames", icon: FlaskConical },
    { key: "escores" as const, label: "Escores", icon: HeartPulse },
    { key: "notas" as const, label: "Anotações", icon: StickyNote },
  ];

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title={patient.full_name}
        subtitle={[
          idade != null ? `${idade} anos` : null,
          patient.sex === "male" ? "masculino" : patient.sex === "female" ? "feminino" : null,
          patient.risk_category ? RISK_CATEGORY_LABEL[patient.risk_category] : null,
        ].filter(Boolean).join(" · ")}
        backLink="/pro/pacientes"
        action={
          <div className="flex items-center gap-2">
            {!loadingRisk && (
              <StatusBadge variant={RISK_BADGE_VARIANT[risk.level]}>{RISK_LABEL[risk.level]}</StatusBadge>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate(`/pro/mensagens?paciente=${patientId}`)}>
              <MessageSquare className="h-4 w-4" /> Mensagem
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground -mt-4 mb-5">
        Última atividade {relTime([bp.ultima?.recorded_at, hr.ultima?.recorded_at, weight.ultimo?.recorded_at].filter(Boolean).sort().reverse()[0] ?? null)}
        {patient.history && Object.values(patient.history).some(Boolean) && (
          <> · {[
            patient.history.heart_failure && `IC${patient.history.lvef ? ` FEVE ${patient.history.lvef}%` : ""}`,
            patient.history.atrial_fibrillation && "FA",
            patient.history.previous_mi && "pós-IAM",
            patient.comorbidities?.hypertension && "HAS",
            patient.comorbidities?.diabetes && "DM2",
          ].filter(Boolean).join(" · ")}</>
        )}
      </p>

      {/* Abas */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors shrink-0",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "resumo" && (
        <div className="space-y-6">
          {/* Resumo entre consultas */}
          <SurfaceCard variant="highlight">
            <SectionHeader title="Resumo entre consultas" icon={ClipboardList} subtitle="o que aconteceu desde o último registro relevante" />
            <p className="text-sm leading-relaxed text-foreground">{resumoParagrafo}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs">
              <div className="rounded-xl bg-card/70 p-2.5">
                <p className="text-muted-foreground">PA média (7d)</p>
                <p className="font-semibold text-sm tabular-nums">{mrpa ? `${mrpa.systolic}/${mrpa.diastolic}` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">{mrpa ? `n=${mrpa.n} · MRPA validado` : "sem medidas validadas"}</p>
              </div>
              <div className="rounded-xl bg-card/70 p-2.5">
                <p className="text-muted-foreground">Peso</p>
                <p className="font-semibold text-sm tabular-nums">{varPeso != null ? `${varPeso > 0 ? "+" : ""}${varPeso.toFixed(1)} kg` : "—"}</p>
                <p className="text-[10px] text-muted-foreground">últimos {pesoRecente.length} registros</p>
              </div>
              <div className="rounded-xl bg-card/70 p-2.5">
                <p className="text-muted-foreground">Adesão (14d)</p>
                <p className="font-semibold text-sm tabular-nums">{adesao14 != null ? `${Math.round(adesao14 * 100)}%` : "—"}</p>
              </div>
              <div className="rounded-xl bg-card/70 p-2.5">
                <p className="text-muted-foreground">Alertas (21d)</p>
                <p className="font-semibold text-sm tabular-nums">{alertasPeriodo.length}</p>
              </div>
            </div>
            {estimadasBp.length > 0 && (
              <p className="text-[11px] text-warning mt-3 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                {estimadasBp.length} leitura{estimadasBp.length > 1 ? "s" : ""} de PA por pulseira (estimativa) no período — não entram nessa média nem em alertas.
              </p>
            )}
          </SurfaceCard>

          {/* Plano de monitoramento — o que o paciente vai ser cobrado a registrar */}
          <PlanoMonitoramentoEditor patientUserId={patientId} professionalId={null} />

          {/* Alvos vs. atual */}
          <div>
            <SectionHeader
              title="Alvos vs. atual"
              subtitle={ehSugestao ? "sugestão por estrato de risco — ainda não confirmado" : `definidos em ${fmtDate(targets.updated_at)}`}
              action={<Button variant="outline" size="sm" onClick={() => setTargetsOpen(true)}><Pencil className="h-3.5 w-3.5" /> Editar metas</Button>}
            />
            <TargetsGrid targets={targets} mrpa={mrpa} restingHr={hr.repouso[0]?.bpm ?? null} weightNow={weight.ultimo?.value ?? null} ldl={ultimoPorMarcador.get("ldl")?.value_num ?? null} stepsAvg={activity.passosMedia} sleepHours={sleep.mediaMinutos != null ? sleep.mediaMinutos / 60 : null} />
          </div>

          {/* Gráficos */}
          <div>
            <SectionHeader title="Evolução" icon={Activity} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BpChart readings={bp.readings} targetSys={targets.bp_systolic_max} targetDia={targets.bp_diastolic_max} />
              <HrChart readings={hr.readings} min={targets.resting_hr_min} max={targets.resting_hr_max} />
              <WeightChart readings={weight.readings} dryWeight={targets.dry_weight_kg} />
              <SleepActivityChart sleep={sleep.records} activity={activity.records} />
            </div>
          </div>
        </div>
      )}

      {tab === "engajamento" && (
        <div className="space-y-6">
          <TempoNoAlvoCard tempoNoAlvo={tempoNoAlvo} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IdadeCoracaoCard dados={idadeCoracao} />
            <CapacidadeCard capacidade={capacidade} />
          </div>

          <TreinoZonaCard
            targets={targets}
            caminhadas={caminhadas}
            patientId={patientId}
            salvarTargets={salvarTargets}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <QualidadeDeVidaCard qol={qualidadeDeVida} />
            <SodioCard sodio={sodio} />
          </div>

          <ComoEstouCard checkins={checkins} />

          <CuidadorCard cuidadores={cuidadores} />
        </div>
      )}

      {tab === "medicacoes" && (
        <MedicationsSection meds={meds} onTitrate={setTitrationMed} />
      )}

      {tab === "exames" && (
        <ExamsSection labs={labs} exams={exams} ldlTarget={targets.ldl_max} />
      )}

      {tab === "escores" && (
        <ScoresSection
          patient={patient} idade={idade}
          cha2ds2vasc={cha2ds2vasc} hasBledScore={hasBledScore} anticoagulado={anticoagulado}
          imc={imc} pesoAtual={weight.ultimo?.value ?? null}
          tfg={tfg} prevencaoPrimaria={prevencaoPrimaria} framingham={framingham}
        />
      )}

      {tab === "notas" && (
        <SurfaceCard>
          <SectionHeader title="Anotações do médico" icon={StickyNote} subtitle="privadas — visíveis só para você" />
          <div className="flex gap-2 mb-4">
            <Textarea
              value={draftNote}
              onChange={(e) => setDraftNote(e.target.value)}
              placeholder="Anotação sobre a evolução, conduta, pendências…"
              className="min-h-[70px]"
            />
          </div>
          <Button
            size="sm"
            disabled={!draftNote.trim()}
            onClick={() => {
              setNotes((prev) => [{ id: crypto.randomUUID(), text: draftNote.trim(), at: new Date().toISOString() }, ...prev]);
              setDraftNote("");
              toast.info("Nota salva só nesta sessão — o app ainda não guarda anotações do médico no servidor.");
            }}
          >
            Salvar anotação
          </Button>
          <div className="mt-5 space-y-2.5">
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma anotação nesta sessão.</p>
            ) : notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-border bg-background p-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{n.text}</p>
                <p className="text-[10px] text-muted-foreground mt-1.5">{fmtDateTime(n.at)} · {doctor?.display_name ?? "você"}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      <TargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        targets={targets}
        onSave={(vals) => {
          if (!patientId) return;
          salvarTargets.mutate({ patientUserId: patientId, ...vals }, { onSuccess: () => setTargetsOpen(false) });
        }}
        saving={salvarTargets.isPending}
      />

      <TitrationDialog
        med={titrationMed}
        onClose={() => setTitrationMed(null)}
        onConfirm={(newDose, reason, blockedBy) => {
          if (!titrationMed || !patientId) return;
          meds.titular.mutate(
            { medicationId: titrationMed.id, patientUserId: patientId, previousDose: titrationMed.dose, newDose, reason, blockedBy },
            { onSuccess: () => setTitrationMed(null) },
          );
        }}
        saving={meds.titular.isPending}
      />
    </div>
  );
}

// ── Alvos vs. atual ──────────────────────────────────────────────────

function MetaRow({ meta, unit }: { meta: ReturnType<typeof avaliarMeta>; unit?: string }) {
  const tone = meta.status === "on_target" ? "text-success" : meta.status === "near" ? "text-warning" : meta.status === "off_target" ? "text-error" : "text-muted-foreground";
  const label = meta.status === "on_target" ? "No alvo" : meta.status === "near" ? "Próximo" : meta.status === "off_target" ? "Fora do alvo" : "Sem dado";
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{meta.label}</p>
      <p className="text-lg font-semibold tabular-nums mt-0.5">
        {meta.current != null ? `${meta.current}${unit ?? ""}` : "—"}
        <span className="text-xs text-muted-foreground font-normal"> / alvo {meta.lowerIsBetter ? "<" : ">"} {meta.target}{unit ?? ""}</span>
      </p>
      <p className={cn("text-[11px] font-medium mt-0.5", tone)}>{label}</p>
    </div>
  );
}

function TargetsGrid({ targets, mrpa, restingHr, weightNow, ldl, stepsAvg, sleepHours }: {
  targets: ReturnType<typeof useTargets>["targets"];
  mrpa: { systolic: number; diastolic: number; n: number } | null;
  restingHr: number | null; weightNow: number | null; ldl: number | null;
  stepsAvg: number | null; sleepHours: number | null;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetaRow meta={avaliarMeta("PA sistólica", mrpa?.systolic ?? null, targets.bp_systolic_max, "", true)} unit=" mmHg" />
      <MetaRow meta={avaliarMeta("PA diastólica", mrpa?.diastolic ?? null, targets.bp_diastolic_max, "", true)} unit=" mmHg" />
      <MetaRow meta={avaliarMeta("LDL", ldl, targets.ldl_max, "", true)} unit=" mg/dL" />
      <MetaRow meta={avaliarMeta("FC repouso", restingHr, targets.resting_hr_max, "", true)} unit=" bpm" />
      <MetaRow meta={avaliarMeta("Passos/dia", stepsAvg, targets.steps_per_day, "", false)} />
      <MetaRow meta={avaliarMeta("Sono", sleepHours != null ? +sleepHours.toFixed(1) : null, targets.sleep_hours, "", false)} unit="h" />
      {targets.dry_weight_kg != null && (
        <MetaRow meta={avaliarMeta("Peso (seco)", weightNow, targets.dry_weight_kg, "", true, 0.03)} unit=" kg" />
      )}
    </div>
  );
}

function TargetsDialog({ open, onOpenChange, targets, onSave, saving }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  targets: ReturnType<typeof useTargets>["targets"];
  onSave: (v: Partial<typeof targets>) => void; saving: boolean;
}) {
  const [form, setForm] = useState(targets);
  useMemo(() => setForm(targets), [targets]);
  const num = (v: string) => (v === "" ? null : Number(v));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar metas terapêuticas</DialogTitle>
          <DialogDescription>O paciente é avisado quando as metas mudam.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>PA sistólica alvo</Label><Input type="number" value={form.bp_systolic_max} onChange={(e) => setForm((f) => ({ ...f, bp_systolic_max: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>PA diastólica alvo</Label><Input type="number" value={form.bp_diastolic_max} onChange={(e) => setForm((f) => ({ ...f, bp_diastolic_max: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>LDL alvo (mg/dL)</Label><Input type="number" value={form.ldl_max} onChange={(e) => setForm((f) => ({ ...f, ldl_max: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>Peso seco (kg)</Label><Input type="number" value={form.dry_weight_kg ?? ""} onChange={(e) => setForm((f) => ({ ...f, dry_weight_kg: num(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>FC repouso mín.</Label><Input type="number" value={form.resting_hr_min} onChange={(e) => setForm((f) => ({ ...f, resting_hr_min: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>FC repouso máx.</Label><Input type="number" value={form.resting_hr_max} onChange={(e) => setForm((f) => ({ ...f, resting_hr_max: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>Passos/dia</Label><Input type="number" value={form.steps_per_day} onChange={(e) => setForm((f) => ({ ...f, steps_per_day: Number(e.target.value) }))} /></div>
          <div className="space-y-1"><Label>Sono (h)</Label><Input type="number" value={form.sleep_hours} onChange={(e) => setForm((f) => ({ ...f, sleep_hours: Number(e.target.value) }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>{saving ? "Salvando…" : "Salvar metas"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Gráficos ──────────────────────────────────────────────────────────

function BpChart({ readings, targetSys, targetDia }: { readings: ReturnType<typeof useBloodPressure>["readings"]; targetSys: number; targetDia: number }) {
  const data = useMemo(() => {
    const validas = [...readings].filter((r) => r.validation_status !== "estimated").reverse().slice(-30);
    return validas.map((r) => ({ dia: chartDay(r.recorded_at), sistolica: r.systolic, diastolica: r.diastolic }));
  }, [readings]);
  const temEstimadas = readings.some((r) => r.validation_status === "estimated");
  if (data.length === 0) return <SurfaceCard><p className="text-xs text-muted-foreground py-8 text-center">Sem medidas de pressão validadas.</p></SurfaceCard>;
  return (
    <SurfaceCard>
      <p className="text-xs font-semibold text-foreground mb-2">Pressão arterial (MRPA validado)</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 10", "dataMax + 10"]} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine y={targetSys} stroke={DOMAIN_COLORS.pressao} strokeDasharray="4 4" label={{ value: "alvo sist.", fontSize: 9, position: "insideTopLeft" }} />
          <ReferenceLine y={targetDia} stroke={DOMAIN_COLORS.pressao} strokeDasharray="2 2" label={{ value: "alvo diast.", fontSize: 9, position: "insideBottomLeft" }} />
          <Line type="monotone" dataKey="sistolica" stroke={DOMAIN_COLORS.pressao} strokeWidth={2} dot={{ r: 2 }} />
          <Line type="monotone" dataKey="diastolica" stroke={DOMAIN_COLORS.pressao} strokeOpacity={0.5} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      {temEstimadas && <p className="text-[10px] text-warning mt-1">Leituras estimadas por pulseira não aparecem aqui — ver seção de proveniência.</p>}
    </SurfaceCard>
  );
}

function HrChart({ readings, min, max }: { readings: ReturnType<typeof useHeartRate>["readings"]; min: number; max: number }) {
  const data = useMemo(() => {
    const repouso = readings.filter((r) => r.context === "resting").slice().reverse().slice(-30);
    return repouso.map((r) => ({ dia: chartDay(r.recorded_at), bpm: r.bpm }));
  }, [readings]);
  if (data.length === 0) return <SurfaceCard><p className="text-xs text-muted-foreground py-8 text-center">Sem frequência de repouso registrada.</p></SurfaceCard>;
  return (
    <SurfaceCard>
      <p className="text-xs font-semibold text-foreground mb-2">Frequência cardíaca de repouso</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 10", "dataMax + 10"]} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <ReferenceLine y={min} stroke={DOMAIN_COLORS.coracao} strokeDasharray="4 4" />
          <ReferenceLine y={max} stroke={DOMAIN_COLORS.coracao} strokeDasharray="4 4" />
          <Line type="monotone" dataKey="bpm" stroke={DOMAIN_COLORS.coracao} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-muted-foreground mt-1">HRV aparece aqui quando o dispositivo expuser o dado (docs §4).</p>
    </SurfaceCard>
  );
}

function WeightChart({ readings, dryWeight }: { readings: ReturnType<typeof useWeight>["readings"]; dryWeight?: number | null }) {
  const data = useMemo(() => readings.slice().reverse().slice(-30).map((r) => ({ dia: chartDay(r.recorded_at), peso: r.value })), [readings]);
  if (data.length === 0) return <SurfaceCard><p className="text-xs text-muted-foreground py-8 text-center">Sem peso registrado.</p></SurfaceCard>;
  return (
    <SurfaceCard>
      <p className="text-xs font-semibold text-foreground mb-2">Peso {dryWeight != null && "(com peso seco marcado)"}</p>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          {dryWeight != null && <ReferenceLine y={dryWeight} stroke={DOMAIN_COLORS.metabolico} strokeDasharray="4 4" label={{ value: "peso seco", fontSize: 9 }} />}
          <Line type="monotone" dataKey="peso" stroke={DOMAIN_COLORS.metabolico} strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    </SurfaceCard>
  );
}

function SleepActivityChart({ sleep, activity }: { sleep: ReturnType<typeof useSleep>["records"]; activity: ReturnType<typeof useActivity>["records"] }) {
  const data = useMemo(() => {
    const map = new Map<string, { dia: string; sonoH: number | null; passos: number | null }>();
    [...sleep].reverse().slice(-21).forEach((s) => {
      map.set(s.sleep_date, { dia: s.sleep_date.slice(5), sonoH: +(s.total_minutes / 60).toFixed(1), passos: null });
    });
    [...activity].reverse().slice(-21).forEach((a) => {
      const cur = map.get(a.activity_date) ?? { dia: a.activity_date.slice(5), sonoH: null, passos: null };
      cur.passos = a.steps ?? null;
      map.set(a.activity_date, cur);
    });
    return [...map.values()];
  }, [sleep, activity]);
  if (data.length === 0) return <SurfaceCard><p className="text-xs text-muted-foreground py-8 text-center">Sem dados de sono/atividade.</p></SurfaceCard>;
  return (
    <SurfaceCard>
      <p className="text-xs font-semibold text-foreground mb-2">Sono e atividade</p>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
          <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="sonoH" name="Sono (h)" fill={DOMAIN_COLORS.sono} radius={[3, 3, 0, 0]} />
          <Line yAxisId="r" type="monotone" dataKey="passos" name="Passos" stroke={DOMAIN_COLORS.atividade} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </SurfaceCard>
  );
}

// ── Medicações ────────────────────────────────────────────────────────

function MedicationsSection({ meds, onTitrate }: { meds: ReturnType<typeof useCardioMedications>; onTitrate: (m: CardioMedication) => void }) {
  const adesaoPorMed = useMemo(() => {
    const map = new Map<string, number | null>();
    const corte = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    for (const med of meds.ativas) {
      const janela = meds.intakes.filter((i) => i.medication_id === med.id && i.intake_date >= corte);
      map.set(med.id, janela.length ? janela.filter((i) => i.taken).length / janela.length : null);
    }
    return map;
  }, [meds.ativas, meds.intakes]);

  if (meds.ativas.length === 0) {
    return <EmptyState icon={Pill} title="Nenhuma medicação ativa" description="As prescrições cadastradas aparecem aqui." variant="card" />;
  }

  return (
    <div className="space-y-3">
      {meds.ativas.map((med) => {
        const adesao = adesaoPorMed.get(med.id);
        return (
          <SurfaceCard key={med.id}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{med.name}</p>
                  <Badge variant="soft">{MED_CLASS_LABEL[med.med_class as MedClass]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Dose atual <b className="text-foreground">{med.dose}</b>
                  {med.target_dose && <> · dose-alvo <b className="text-foreground">{med.target_dose}</b></>}
                  {" "}· desde {fmtDate(med.started_at)}
                </p>
                {MED_CLASS_MONITORAR[med.med_class as MedClass] && (
                  <p className="text-[11px] text-muted-foreground mt-1">Monitorar: {MED_CLASS_MONITORAR[med.med_class as MedClass]}</p>
                )}
                {med.titration_blocked_by && (
                  <p className="text-[11px] text-warning mt-1">Titulação interrompida: {med.titration_blocked_by}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Adesão (14d)</p>
                  <p className={cn("text-sm font-semibold tabular-nums", adesao != null && adesao < 0.8 && "text-warning")}>
                    {adesao != null ? `${Math.round(adesao * 100)}%` : "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onTitrate(med)}>Titular</Button>
              </div>
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );
}

function TitrationDialog({ med, onClose, onConfirm, saving }: {
  med: CardioMedication | null; onClose: () => void;
  onConfirm: (newDose: string, reason: string, blockedBy: string | null) => void; saving: boolean;
}) {
  const [newDose, setNewDose] = useState("");
  const [reason, setReason] = useState("");
  const [blockedBy, setBlockedBy] = useState("");
  useMemo(() => { if (med) { setNewDose(med.dose); setReason(""); setBlockedBy(""); } }, [med]);

  return (
    <Dialog open={!!med} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Titular {med?.name}</DialogTitle>
          <DialogDescription>
            Isso registra a mudança de dose e avisa o paciente. Nenhum texto do app prescreve — a decisão é sua.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Dose atual</Label>
            <Input value={med?.dose ?? ""} disabled />
          </div>
          <div className="space-y-1">
            <Label>Nova dose</Label>
            <Input value={newDose} onChange={(e) => setNewDose(e.target.value)} placeholder="Ex.: 100 mg" />
          </div>
          <div className="space-y-1">
            <Label>Motivo da mudança</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: PA acima do alvo em 3 medidas consecutivas" rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Se não vai subir agora: por que parou de titular?</Label>
            <Input value={blockedBy} onChange={(e) => setBlockedBy(e.target.value)} placeholder="Ex.: K+ 5,3 mEq/L, creatinina em alta" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!newDose.trim() || saving} onClick={() => onConfirm(newDose.trim(), reason.trim(), blockedBy.trim() || null)}>
            {saving ? "Salvando…" : "Confirmar titulação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Exames ────────────────────────────────────────────────────────────

function ExamsSection({ labs, exams, ldlTarget }: {
  labs: ReturnType<typeof useLabResults>["labs"]; exams: ReturnType<typeof useCardioExams>["exams"]; ldlTarget: number;
}) {
  const ldlHistorico = useMemo(() => labs.filter((l) => l.marker_key === "ldl").slice().reverse(), [labs]);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeader title="Laboratório" icon={FlaskConical} />
        {labs.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Sem exames de laboratório" description="Resultados coletados aparecem aqui com data e faixa de referência." variant="card" />
        ) : (
          <>
            {ldlHistorico.length > 0 && (
              <div className="mb-3">
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={ldlHistorico.map((l) => ({ data: fmtDate(l.collected_at), ldl: l.value_num }))} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <ReferenceLine y={ldlTarget} stroke={DOMAIN_COLORS.metabolico} strokeDasharray="4 4" label={{ value: `alvo ${ldlTarget}`, fontSize: 9 }} />
                    <Line type="monotone" dataKey="ldl" stroke={DOMAIN_COLORS.metabolico} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Marcador</th>
                    <th className="text-left px-3 py-2">Valor</th>
                    <th className="text-left px-3 py-2">Referência</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Coletado em</th>
                  </tr>
                </thead>
                <tbody>
                  {labs.map((l) => (
                    <tr key={l.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{l.marker_label}</td>
                      <td className="px-3 py-2 tabular-nums">{l.value_num ?? l.value_text ?? "—"} {l.unit ?? ""}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.reference_text ?? "—"}</td>
                      <td className="px-3 py-2">
                        {l.status && (
                          <StatusBadge variant={l.status === "critical" ? "urgencia" : l.status === "attention" ? "atencao" : "concluido"}>
                            {l.status === "critical" ? "Crítico" : l.status === "attention" ? "Atenção" : "Normal"}
                          </StatusBadge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(l.collected_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div>
        <SectionHeader title="Exames do coração" icon={HeartPulse} />
        {exams.length === 0 ? (
          <EmptyState icon={HeartPulse} title="Sem exames cardiológicos" description="ECG, ecocardiograma, Holter e outros aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-3">
            {exams.map((e) => (
              <SurfaceCard key={e.id}>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <p className="text-sm font-semibold text-foreground">{EXAM_TYPE_LABEL[e.exam_type]}</p>
                  <span className="text-xs text-muted-foreground">{fmtDate(e.performed_at)}{e.performed_by ? ` · ${e.performed_by}` : ""}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {Object.entries(e.findings).filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                    <div key={k}>
                      <p className="text-muted-foreground">{FIELD_LABEL[k] ?? k}</p>
                      <p className="font-medium text-foreground">{String(v)}</p>
                    </div>
                  ))}
                </div>
                {e.conclusion && <p className="text-sm text-foreground mt-2 italic">"{e.conclusion}"</p>}
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Escores ───────────────────────────────────────────────────────────

function ScoreCard({ title, score, calculatedNote }: { title: string; score: ReturnType<typeof cha2ds2VascDoPaciente>; calculatedNote: string }) {
  if (!score) return null;
  return (
    <SurfaceCard>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <span className="text-2xl font-bold tabular-nums text-primary">{score.score}<span className="text-xs text-muted-foreground font-normal">/{score.max}</span></span>
      </div>
      <p className="text-sm text-foreground">{score.interpretation}</p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {score.breakdown.map((b) => (
          <span key={b.item} className="text-[10px] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">{b.item} (+{b.points})</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1"><Info className="h-3 w-3" /> {calculatedNote} — apoio à decisão, não substitui julgamento clínico.</p>
    </SurfaceCard>
  );
}

function ScoresSection({ patient, idade, cha2ds2vasc, hasBledScore, anticoagulado, imc, pesoAtual, tfg, prevencaoPrimaria, framingham }: {
  patient: NonNullable<ReturnType<typeof useCardioPatient>["data"]>;
  idade: number | null;
  cha2ds2vasc: ReturnType<typeof cha2ds2VascDoPaciente>;
  hasBledScore: ReturnType<typeof hasBled> | null;
  anticoagulado: boolean;
  imc: number | null; pesoAtual: number | null;
  tfg: number | null;
  prevencaoPrimaria: boolean;
  framingham: ReturnType<typeof framinghamRisco10a>;
}) {
  const hoje = fmtDate(new Date().toISOString());
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {patient.history?.atrial_fibrillation && (
        cha2ds2vasc
          ? <ScoreCard title="CHA₂DS₂-VASc" score={cha2ds2vasc} calculatedNote={`Calculado em ${hoje}`} />
          : <SurfaceCard><p className="text-xs text-muted-foreground">CHA₂DS₂-VASc: faltam dados de idade para calcular.</p></SurfaceCard>
      )}
      {anticoagulado && hasBledScore && (
        <SurfaceCard>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">HAS-BLED</p>
            <span className="text-2xl font-bold tabular-nums text-primary">{hasBledScore.score}<span className="text-xs text-muted-foreground font-normal">/{hasBledScore.max}</span></span>
          </div>
          <p className="text-sm text-foreground">{hasBledScore.interpretation}</p>
          <p className="text-[10px] text-muted-foreground mt-2">Calculado em {hoje} com os campos disponíveis no cadastro — itens não coletados (sangramento prévio, INR lábil, função hepática) foram considerados ausentes. Apoio à decisão.</p>
        </SurfaceCard>
      )}
      {imc != null && (
        <SurfaceCard>
          <p className="text-sm font-semibold text-foreground mb-1">IMC</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{imc}</p>
          <p className="text-xs text-muted-foreground mt-1">{classificarIMC(imc)} · peso {pesoAtual} kg, altura {patient.height_cm} cm</p>
        </SurfaceCard>
      )}
      {tfg != null && (
        <SurfaceCard>
          <p className="text-sm font-semibold text-foreground mb-1">TFG estimada (CKD-EPI)</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{tfg}<span className="text-xs text-muted-foreground font-normal"> mL/min/1,73m²</span></p>
          <p className="text-[10px] text-muted-foreground mt-2">Calculado em {hoje} a partir da creatinina mais recente. Apoio à decisão.</p>
        </SurfaceCard>
      )}
      {prevencaoPrimaria && (
        framingham
          ? (
            <SurfaceCard>
              <p className="text-sm font-semibold text-foreground mb-1">Framingham (risco global 10 anos)</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{framingham.score}%</p>
              <p className="text-xs text-foreground mt-1">{framingham.interpretation}</p>
              <p className="text-[10px] text-muted-foreground mt-2">Calculado em {hoje} · prevenção primária. Apoio à decisão.</p>
            </SurfaceCard>
          )
          : <SurfaceCard><p className="text-xs text-muted-foreground">Framingham: faltam colesterol total, HDL ou PA sistólica para calcular.</p></SurfaceCard>
      )}
      {!patient.history?.atrial_fibrillation && !anticoagulado && imc == null && tfg == null && !prevencaoPrimaria && (
        <EmptyState icon={HeartPulse} title="Nenhum escore aplicável" description="Escores aparecem conforme o cadastro clínico do paciente (FA, anticoagulação, prevenção primária)." variant="card" />
      )}
    </div>
  );
}

// ── Engajamento ───────────────────────────────────────────────────────
// docs/ENGAJAMENTO-CARDIO.md — Tempo no Alvo + Idade do Coração + Capacidade
// são a espinha do app do paciente; aqui o médico vê os mesmos números,
// com densidade e jargão de médico, e a única decisão clínica que essas
// telas escondem do sistema — a faixa de treino — é prescrita por ele.

function TempoNoAlvoCard({ tempoNoAlvo }: { tempoNoAlvo: ReturnType<typeof useTempoNoAlvo> }) {
  const { mes, semana, serie, isLoading } = tempoNoAlvo;
  const chartData = useMemo(
    () => serie.map((s) => ({ semana: chartDay(s.semana), percentual: s.percentual })),
    [serie],
  );
  return (
    <SurfaceCard variant="highlight">
      <SectionHeader
        title="Tempo no Alvo"
        icon={Target}
        subtitle="percentual de medidas de pressão dentro do alvo — o mesmo número que o paciente vê"
      />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-6 mb-4">
            <div>
              <p className="text-xs text-muted-foreground">Mês (30 dias)</p>
              <p className="text-3xl font-bold tabular-nums text-primary">
                {mes.percentual != null ? `${mes.percentual}%` : "—"}
              </p>
              {mes.variacao != null && (
                <p className={cn("text-[11px] font-medium", mes.variacao >= 0 ? "text-success" : "text-error")}>
                  {mes.variacao >= 0 ? "+" : ""}{mes.variacao} p.p. vs. mês anterior
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Semana</p>
              <p className="text-xl font-semibold tabular-nums">{semana.percentual != null ? `${semana.percentual}%` : "—"}</p>
              <p className="text-[10px] text-muted-foreground">{semana.total} medida{semana.total === 1 ? "" : "s"} validada{semana.total === 1 ? "" : "s"}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{mes.frase}</p>
          {chartData.some((d) => d.percentual != null) ? (
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="percentual" fill={DOMAIN_COLORS.pressao} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground">Sem série semanal suficiente ainda.</p>
          )}
        </>
      )}
    </SurfaceCard>
  );
}

function IdadeCoracaoCard({ dados }: { dados: ReturnType<typeof useIdadeDoCoracao> }) {
  const { resultado, aplicavel, motivo, faltando, historico, projecao, isLoading } = dados;
  const historicoData = useMemo(
    () => [...historico].reverse().map((h) => ({ data: fmtDate(h.calculado_em), idade: h.idade_coracao })),
    [historico],
  );

  return (
    <SurfaceCard>
      <SectionHeader title="Idade do Coração" icon={HeartPulse} subtitle="estimativa de risco cardiovascular — Framingham" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : !aplicavel ? (
        <div className="rounded-xl bg-secondary/50 p-3">
          <p className="text-xs text-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {motivo}
          </p>
        </div>
      ) : !resultado ? (
        <p className="text-xs text-muted-foreground">
          Faltam dados para calcular: {faltando.join(", ")}.
        </p>
      ) : (
        <>
          <div className="flex items-end gap-4 mb-2">
            <div>
              <p className="text-3xl font-bold tabular-nums text-primary">{resultado.idadeDoCoracao}<span className="text-sm font-normal text-muted-foreground"> anos</span></p>
              <p className={cn("text-[11px] font-medium", resultado.diferenca > 0 ? "text-error" : resultado.diferenca < 0 ? "text-success" : "text-muted-foreground")}>
                {resultado.diferenca > 0 ? `+${resultado.diferenca}` : resultado.diferenca} vs. idade real ({resultado.idadeReal})
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Risco Framingham 10a: <b className="text-foreground">{resultado.riscoPercentual}%</b></p>
              {projecao != null && <p>Projeção com pressão no alvo: <b className="text-foreground">{projecao} anos</b></p>}
            </div>
          </div>
          {resultado.fatores.length > 0 && (
            <div className="flex flex-wrap gap-1.5 my-2">
              {resultado.fatores.map((f) => (
                <span key={f.chave} className="text-[10px] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">
                  {f.rotulo}: até -{f.anosQuePodeGanhar}a
                </span>
              ))}
            </div>
          )}
          {historicoData.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={historicoData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="idade" stroke={DOMAIN_COLORS.coracao} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" /> Estimativa populacional de prevenção primária — calculada em {fmtDate(resultado.calculadoEm)}. Não vale para quem já tem doença coronariana, cerebrovascular ou IC estabelecida.
          </p>
        </>
      )}
    </SurfaceCard>
  );
}

const NOME_TESTE: Record<TipoTeste, string> = {
  walk_6min: "Caminhada de 6 min",
  sit_to_stand_30s: "Sentar-e-levantar 30s",
  hr_recovery: "Recuperação da FC 1 min",
};

function CapacidadeCard({ capacidade }: { capacidade: ReturnType<typeof useCapacidade> }) {
  const { testes, evolucao, isLoading } = capacidade;
  const recentes = useMemo(
    () => [...testes].sort((a, b) => +new Date(b.realizado_em) - +new Date(a.realizado_em)).slice(0, 8),
    [testes],
  );

  return (
    <SurfaceCard>
      <SectionHeader title="Capacidade funcional" icon={Gauge} subtitle="6MWT · sentar-e-levantar · recuperação da FC" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : testes.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum teste de capacidade registrado.</p>
      ) : (
        <>
          <div className="space-y-1.5 mb-3 text-xs">
            {(["walk_6min", "sit_to_stand_30s", "hr_recovery"] as TipoTeste[]).map((tipo) => {
              const ev = evolucao[tipo === "walk_6min" ? "caminhada" : tipo === "sit_to_stand_30s" ? "sentarLevantar" : "recuperacao"];
              return ev.atual != null ? (
                <p key={tipo} className="text-foreground"><b>{NOME_TESTE[tipo]}:</b> {ev.frase}</p>
              ) : null;
            })}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-2.5 py-1.5">Teste</th>
                  <th className="text-left px-2.5 py-1.5">Valor</th>
                  <th className="text-left px-2.5 py-1.5">Borg</th>
                  <th className="text-left px-2.5 py-1.5">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((t) => (
                  <tr key={t.id} className="border-t border-border">
                    <td className="px-2.5 py-1.5 font-medium text-foreground">{NOME_TESTE[t.tipo]}</td>
                    <td className="px-2.5 py-1.5 tabular-nums">
                      {t.valor} {t.tipo === "walk_6min" ? "m" : t.tipo === "sit_to_stand_30s" ? "rep." : "bpm"}
                    </td>
                    <td className="px-2.5 py-1.5 tabular-nums text-muted-foreground">{t.borg ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-muted-foreground">{fmtDate(t.realizado_em)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <Info className="h-3 w-3 shrink-0" /> A caminhada de 6 min feita em casa é estimativa (percurso e passos autoinformados) — não substitui o teste no corredor do consultório.
          </p>
        </>
      )}
    </SurfaceCard>
  );
}

function TreinoZonaCard({ targets, caminhadas, patientId, salvarTargets }: {
  targets: ReturnType<typeof useTargets>["targets"];
  caminhadas: ReturnType<typeof useCaminhadas>;
  patientId: string | undefined;
  salvarTargets: ReturnType<typeof useSalvarTargets>;
}) {
  const [min, setMin] = useState(targets.training_hr_min != null ? String(targets.training_hr_min) : "");
  const [max, setMax] = useState(targets.training_hr_max != null ? String(targets.training_hr_max) : "");
  useMemo(() => {
    setMin(targets.training_hr_min != null ? String(targets.training_hr_min) : "");
    setMax(targets.training_hr_max != null ? String(targets.training_hr_max) : "");
  }, [targets.training_hr_min, targets.training_hr_max]);

  const { sessoes, zona, daSemana, minutosSemana } = caminhadas;
  const segundosSemana = daSemana.reduce((s, x) => s + x.duracao_segundos, 0);
  const segundosNaZonaSemana = daSemana.reduce((s, x) => s + (x.segundos_na_zona ?? 0), 0);
  const pctNaZona = zona.definidaPeloMedico && segundosSemana > 0
    ? Math.round((segundosNaZonaSemana / segundosSemana) * 100)
    : null;

  // Referência simples baseada na FC de repouso alvo, só como texto de apoio — a decisão é do médico.
  const sugestaoTexto = targets.resting_hr_min != null && targets.resting_hr_max != null
    ? `Como referência (não é prescrição): faixas de treino leve a moderado costumam ficar entre ${Math.round(targets.resting_hr_max * 1.1)} e ${Math.round(targets.resting_hr_max * 1.4)} bpm — ajuste ao caso clínico.`
    : "Sem FC de repouso alvo cadastrada para sugerir uma referência.";

  const canSave = min.trim() !== "" && max.trim() !== "" && Number(min) > 0 && Number(max) > Number(min);

  return (
    <SurfaceCard variant="highlight">
      <SectionHeader
        title="Prescrever faixa de treino da caminhada guiada"
        icon={Footprints}
        subtitle="docs/ENGAJAMENTO-CARDIO.md §6.3 — só o médico define isso"
      />
      <p className="text-xs text-foreground mb-3">
        {zona.definidaPeloMedico
          ? `Faixa vigente: ${zona.min}–${zona.max} bpm.`
          : "Nenhuma faixa definida ainda. Sem ela, a caminhada guiada do paciente roda livre — o app mostra os batimentos, mas não avisa se ele está acima ou abaixo de nada."}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end mb-3">
        <div className="space-y-1">
          <Label>FC mínima (bpm)</Label>
          <Input type="number" value={min} onChange={(e) => setMin(e.target.value)} placeholder="Ex.: 90" />
        </div>
        <div className="space-y-1">
          <Label>FC máxima (bpm)</Label>
          <Input type="number" value={max} onChange={(e) => setMax(e.target.value)} placeholder="Ex.: 110" />
        </div>
        <Button
          disabled={!canSave || !patientId || salvarTargets.isPending}
          onClick={() => {
            if (!patientId) return;
            salvarTargets.mutate({ patientUserId: patientId, training_hr_min: Number(min), training_hr_max: Number(max) });
          }}
        >
          {salvarTargets.isPending ? "Salvando…" : "Salvar faixa"}
        </Button>
        {(targets.training_hr_min != null || targets.training_hr_max != null) && (
          <Button
            variant="outline"
            disabled={!patientId || salvarTargets.isPending}
            onClick={() => {
              if (!patientId) return;
              salvarTargets.mutate({ patientUserId: patientId, training_hr_min: null, training_hr_max: null });
            }}
          >
            Remover faixa
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground mb-4">{sugestaoTexto}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-border pt-3">
        <div>
          <p className="text-muted-foreground">Sessões registradas</p>
          <p className="font-semibold text-sm tabular-nums">{sessoes.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Minutos na semana</p>
          <p className="font-semibold text-sm tabular-nums">{minutosSemana} min</p>
        </div>
        <div>
          <p className="text-muted-foreground">% do tempo na faixa (semana)</p>
          <p className="font-semibold text-sm tabular-nums">{pctNaZona != null ? `${pctNaZona}%` : "—"}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}

function QualidadeDeVidaCard({ qol }: { qol: ReturnType<typeof useQualidadeDeVida> }) {
  const { respostas, ultima, variacao, isLoading } = qol;
  const chartData = useMemo(
    () => [...respostas].reverse().map((r) => ({ data: fmtDate(r.respondido_em), score: r.score })),
    [respostas],
  );
  return (
    <SurfaceCard>
      <SectionHeader title="Qualidade de vida" icon={Smile} subtitle="questionário mensal, derivado do KCCQ · 0–100, maior é melhor" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : !ultima ? (
        <p className="text-xs text-muted-foreground">Paciente ainda não respondeu o questionário.</p>
      ) : (
        <>
          <div className="flex items-end gap-4 mb-3">
            <div>
              <p className="text-2xl font-bold tabular-nums text-primary">{ultima.score}</p>
              <p className="text-[10px] text-muted-foreground">respondido em {fmtDate(ultima.respondido_em)}</p>
            </div>
            {variacao != null && (
              <p className={cn("text-[11px] font-medium", variacao >= 0 ? "text-success" : "text-error")}>
                {variacao >= 0 ? "+" : ""}{variacao} pontos desde a resposta anterior
              </p>
            )}
          </div>
          {chartData.length > 1 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={chartData} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="data" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <RTooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke={DOMAIN_COLORS.sono} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </SurfaceCard>
  );
}

function SodioCard({ sodio }: { sodio: ReturnType<typeof useSodio> }) {
  const { registros, alvo, mediaSemana, isLoading } = sodio;
  const tendencia = useMemo(() => {
    if (registros.length === 0) return null;
    const dias = [...new Set(registros.map((r) => r.dia))].sort();
    if (dias.length < 4) return null;
    const meio = Math.floor(dias.length / 2);
    const somaDia = (dia: string) => registros.filter((r) => r.dia === dia).reduce((s, r) => s + r.sodio_mg, 0);
    const primeiraMetade = dias.slice(0, meio).map(somaDia).filter((v) => v > 0);
    const segundaMetade = dias.slice(meio).map(somaDia).filter((v) => v > 0);
    if (primeiraMetade.length === 0 || segundaMetade.length === 0) return null;
    const media1 = primeiraMetade.reduce((a, b) => a + b, 0) / primeiraMetade.length;
    const media2 = segundaMetade.reduce((a, b) => a + b, 0) / segundaMetade.length;
    return media2 - media1;
  }, [registros]);

  return (
    <SurfaceCard>
      <SectionHeader title="Sódio" icon={Salad} subtitle="autorrelato por refeição — estimativa, não pesagem" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : mediaSemana == null ? (
        <p className="text-xs text-muted-foreground">Sem registros de sódio nos últimos 7 dias.</p>
      ) : (
        <>
          <p className="text-2xl font-bold tabular-nums text-primary">{mediaSemana}<span className="text-xs font-normal text-muted-foreground"> mg/dia (média 7d)</span></p>
          <p className="text-[10px] text-muted-foreground mb-2">referência {alvo} mg/dia</p>
          {tendencia != null && (
            <p className={cn("text-[11px] font-medium", tendencia > 100 ? "text-warning" : tendencia < -100 ? "text-success" : "text-muted-foreground")}>
              Tendência: {tendencia > 0 ? "+" : ""}{Math.round(tendencia)} mg/dia entre a primeira e a segunda metade do período.
            </p>
          )}
        </>
      )}
    </SurfaceCard>
  );
}

const DESFECHO_BADGE: Record<WellbeingCheckin["desfecho"], "urgencia" | "atencao" | "concluido"> = {
  emergencia: "urgencia", avisar_medico: "atencao", registrar: "concluido",
};
const DESFECHO_LABEL: Record<WellbeingCheckin["desfecho"], string> = {
  emergencia: "Emergência (192)", avisar_medico: "Avisar médico", registrar: "Registrado",
};

function ComoEstouCard({ checkins }: { checkins: ReturnType<typeof useCheckins> }) {
  const { checkins: lista, isLoading } = checkins;
  const ordenados = useMemo(
    () => [...lista].sort((a, b) => +new Date(b.ocorrido_em) - +new Date(a.ocorrido_em)),
    [lista],
  );
  return (
    <SurfaceCard>
      <SectionHeader title="Como estou agora" icon={HelpCircle} subtitle="triagens de sintoma que o paciente registrou, com desfecho e observação" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : ordenados.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum check-in registrado.</p>
      ) : (
        <div className="space-y-2">
          {ordenados.map((c) => (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border p-3",
                c.desfecho === "emergencia" ? "border-error-bg bg-error-bg/40" : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  {c.desfecho === "emergencia" && <Siren className="h-3.5 w-3.5 text-error shrink-0" />}
                  <StatusBadge variant={DESFECHO_BADGE[c.desfecho]}>{DESFECHO_LABEL[c.desfecho]}</StatusBadge>
                </div>
                <span className="text-[11px] text-muted-foreground">{fmtDateTime(c.ocorrido_em)}</span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-foreground">
                {c.como_se_sente != null && <span>Como se sentia: <b>{c.como_se_sente}/10</b></span>}
                {c.alarmes.length > 0 && <span>Sinais marcados: <b>{c.alarmes.join(", ")}</b></span>}
              </div>
              {c.observacao && <p className="text-xs text-muted-foreground mt-1 italic">"{c.observacao}"</p>}
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}

function CuidadorCard({ cuidadores }: { cuidadores: ReturnType<typeof useCuidadoresDoPaciente> }) {
  const { cuidadores: lista, temCuidador, isLoading } = cuidadores;
  return (
    <SurfaceCard>
      <SectionHeader title="Cuidador" icon={UserCheck} subtitle="quem acompanha este paciente em casa — convidado e revogável só pelo paciente" />
      {isLoading ? (
        <p className="text-xs text-muted-foreground py-4">Carregando…</p>
      ) : !temCuidador ? (
        <p className="text-xs text-muted-foreground">Nenhum cuidador ativo vinculado a este paciente.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{c.caregiver_nome}</p>
                {c.parentesco && <p className="text-[11px] text-muted-foreground">{c.parentesco}</p>}
              </div>
              <Badge variant="soft">Ativo desde {fmtDate(c.aceito_em)}</Badge>
            </div>
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
