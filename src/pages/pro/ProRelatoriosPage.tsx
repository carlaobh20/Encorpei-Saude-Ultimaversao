/**
 * RELATÓRIOS — geração do relatório do paciente: seleção de paciente e
 * período, prévia (mesmo conteúdo do "resumo entre consultas", com origem
 * e data de cada número) e impressão/PDF via window.print() com CSS de
 * impressão. Sem bibliotecas novas.
 */
import { useMemo, useState } from "react";
import { FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfessionalPatients, useProfessionalProfile } from "@/hooks/useProfessional";
import { useCardioPatient, useTargets } from "@/hooks/useCardioPatient";
import { useBloodPressure, useWeight } from "@/hooks/useCardioReadings";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useSymptoms, useLabResults, useCardioExams, useCardioAlerts } from "@/hooks/useCardioClinical";
import {
  useIdadeDoCoracao, useCapacidade, useCaminhadas, useCheckins, useSodio, useQualidadeDeVida,
} from "@/hooks/useEngajamento";
import { mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { RISK_CATEGORY_LABEL } from "@/lib/clinical/cardioTargets";
import { idadeEmAnos } from "@/lib/clinical/scores";
import { calcularTempoNoAlvo } from "@/lib/clinical/timeInRange";
import { evolucaoCapacidade } from "@/lib/clinical/capacity";
import { mediaSemanal } from "@/lib/clinical/sodio";
import type { WellbeingCheckin } from "@/types/cardio";

const DESFECHO_LABEL_REL: Record<WellbeingCheckin["desfecho"], string> = {
  emergencia: "Emergência (192)", avisar_medico: "Avisar médico", registrar: "Registrado",
};

type Periodo = 14 | 30 | 90;

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export default function ProRelatoriosPage() {
  const { patients, isLoading } = useProfessionalPatients();
  const { profile } = useProfessionalProfile();
  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);

  const [patientId, setPatientId] = useState<string>("");
  const [periodo, setPeriodo] = useState<Periodo>(30);

  const { data: patient } = useCardioPatient(patientId || undefined);
  const { targets } = useTargets(patientId || undefined);
  const bp = useBloodPressure(patientId || undefined);
  const weight = useWeight(patientId || undefined);
  const meds = useCardioMedications(patientId || undefined);
  const { symptoms } = useSymptoms(patientId || undefined);
  const { labs } = useLabResults(patientId || undefined);
  const { exams } = useCardioExams(patientId || undefined);
  const { alerts } = useCardioAlerts(patientId || undefined);
  const idadeCoracao = useIdadeDoCoracao(patientId || undefined);
  const capacidade = useCapacidade(patientId || undefined);
  const caminhadas = useCaminhadas(patientId || undefined);
  const checkins = useCheckins(patientId || undefined);
  const sodio = useSodio(patientId || undefined);
  const qol = useQualidadeDeVida(patientId || undefined);

  const idade = idadeEmAnos(patient?.birth_date ?? null);
  const corte = Date.now() - periodo * 86400000;

  const mrpa = useMemo(() => mediaMrpa(bp.readings, new Date(), periodo), [bp.readings, periodo]);
  const tempoNoAlvoPeriodo = useMemo(
    () => calcularTempoNoAlvo(bp.readings, targets, periodo),
    [bp.readings, targets, periodo],
  );
  const evolucaoCaminhada = useMemo(() => evolucaoCapacidade(capacidade.testes, "walk_6min"), [capacidade.testes]);
  const evolucaoSentarLevantar = useMemo(() => evolucaoCapacidade(capacidade.testes, "sit_to_stand_30s"), [capacidade.testes]);
  const evolucaoRecuperacao = useMemo(() => evolucaoCapacidade(capacidade.testes, "hr_recovery"), [capacidade.testes]);
  const sessoesPeriodo = useMemo(
    () => caminhadas.sessoes.filter((s) => new Date(s.iniciada_em).getTime() >= corte),
    [caminhadas.sessoes, corte],
  );
  const minutosCaminhadaPeriodo = Math.round(sessoesPeriodo.reduce((s, x) => s + x.duracao_segundos, 0) / 60);
  const checkinsPeriodo = useMemo(
    () => checkins.checkins.filter((c) => new Date(c.ocorrido_em).getTime() >= corte)
      .sort((a, b) => +new Date(b.ocorrido_em) - +new Date(a.ocorrido_em)),
    [checkins.checkins, corte],
  );
  const sodioMediaPeriodo = useMemo(
    () => mediaSemanal(sodio.registros, periodo),
    [sodio.registros, periodo],
  );
  const qolPeriodo = useMemo(
    () => qol.respostas.filter((r) => new Date(r.respondido_em).getTime() >= corte),
    [qol.respostas, corte],
  );
  const pesoPeriodo = useMemo(
    () => weight.readings.filter((r) => new Date(r.recorded_at).getTime() >= corte),
    [weight.readings, corte],
  );
  const varPeso = pesoPeriodo.length >= 2 ? pesoPeriodo[0].value - pesoPeriodo[pesoPeriodo.length - 1].value : null;
  const sintomasPeriodo = useMemo(
    () => symptoms.filter((s) => new Date(s.occurred_at).getTime() >= corte),
    [symptoms, corte],
  );
  const examesPeriodo = useMemo(
    () => exams.filter((e) => e.performed_at && new Date(e.performed_at).getTime() >= corte),
    [exams, corte],
  );
  const alertasPeriodo = useMemo(
    () => alerts.filter((a) => new Date(a.triggered_at).getTime() >= corte),
    [alerts, corte],
  );
  const adesao = periodo <= 14 ? meds.adesao?.d14 : periodo <= 30 ? meds.adesao?.d30 : meds.adesao?.d30;

  const nomePaciente = ativos.find((p) => p.patient_user_id === patientId)?.full_name ?? patient?.full_name;

  return (
    <div className="mx-auto w-full max-w-[900px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: none !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader title="Relatórios" subtitle="Gere o resumo clínico do paciente para prontuário ou convênio" />

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Select value={patientId} onValueChange={setPatientId}>
            <SelectTrigger className="h-10 w-64"><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
            <SelectContent>
              {ativos.map((p) => <SelectItem key={p.patient_user_id} value={p.patient_user_id}>{p.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(periodo)} onValueChange={(v) => setPeriodo(Number(v) as Periodo)}>
            <SelectTrigger className="h-10 w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          {patientId && (
            <Button onClick={() => window.print()} className="ml-auto">
              <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
            </Button>
          )}
        </div>

        {!patientId && !isLoading && (
          <EmptyState icon={FileText} title="Selecione um paciente" description="Escolha um paciente ativo e um período para gerar a prévia do relatório." variant="card" />
        )}
      </div>

      {patientId && patient && (
        <div className="print-sheet rounded-2xl border border-border bg-card p-8">
          <div className="flex items-start justify-between border-b border-border pb-4 mb-4">
            <div>
              <h1 className="font-display text-xl font-semibold text-foreground">Relatório de acompanhamento — Encorpei Cardio</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {nomePaciente} {idade != null && `· ${idade} anos`} · período: últimos {periodo} dias
              </p>
            </div>
            {patient.risk_category && (
              <span className="text-xs font-semibold rounded-full bg-primary/10 text-primary px-3 py-1">{RISK_CATEGORY_LABEL[patient.risk_category]}</span>
            )}
          </div>

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">Resumo do período</h2>
          <p className="text-sm text-foreground leading-relaxed mb-4">
            {mrpa
              ? `Pressão arterial média de ${mrpa.systolic}/${mrpa.diastolic} mmHg (n=${mrpa.n} medidas validadas por manguito).`
              : "Sem medidas de pressão validadas por manguito suficientes no período."}
            {" "}
            {varPeso != null && `Peso variou ${varPeso > 0 ? "+" : ""}${varPeso.toFixed(1)} kg (de ${fmtDate(pesoPeriodo[pesoPeriodo.length - 1]?.recorded_at)} a ${fmtDate(pesoPeriodo[0]?.recorded_at)}). `}
            {adesao != null && `Adesão medicamentosa de ${Math.round(adesao * 100)}% no período. `}
            {sintomasPeriodo.length > 0 && `${sintomasPeriodo.length} sintoma(s) relatado(s). `}
            {alertasPeriodo.length > 0 && `${alertasPeriodo.length} alerta(s) disparado(s) pelo sistema.`}
          </p>

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2 mt-5">Alvos terapêuticos</h2>
          <table className="w-full text-sm mb-4">
            <tbody>
              <tr className="border-b border-border"><td className="py-1 text-muted-foreground">PA alvo</td><td className="py-1 text-right font-medium">{"<"} {targets.bp_systolic_max}/{targets.bp_diastolic_max} mmHg</td></tr>
              <tr className="border-b border-border"><td className="py-1 text-muted-foreground">LDL alvo</td><td className="py-1 text-right font-medium">{"<"} {targets.ldl_max} mg/dL</td></tr>
              <tr className="border-b border-border"><td className="py-1 text-muted-foreground">FC repouso alvo</td><td className="py-1 text-right font-medium">{targets.resting_hr_min}–{targets.resting_hr_max} bpm</td></tr>
              {targets.dry_weight_kg != null && <tr><td className="py-1 text-muted-foreground">Peso seco</td><td className="py-1 text-right font-medium">{targets.dry_weight_kg} kg</td></tr>}
            </tbody>
          </table>

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">Medicações ativas</h2>
          {meds.ativas.length === 0 ? <p className="text-sm text-muted-foreground mb-4">Nenhuma medicação ativa.</p> : (
            <ul className="text-sm mb-4 space-y-1">
              {meds.ativas.map((m) => <li key={m.id}>{m.name} — {m.dose}{m.target_dose ? ` (alvo ${m.target_dose})` : ""}</li>)}
            </ul>
          )}

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">Exames no período</h2>
          {examesPeriodo.length === 0 && labs.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">Nenhum exame novo no período.</p>
          ) : (
            <ul className="text-sm mb-4 space-y-1">
              {examesPeriodo.map((e) => <li key={e.id}>{e.exam_type} — {fmtDate(e.performed_at)}{e.conclusion ? `: ${e.conclusion}` : ""}</li>)}
              {labs.slice(0, 5).map((l) => <li key={l.id}>{l.marker_label}: {l.value_num ?? l.value_text} {l.unit} ({fmtDate(l.collected_at)})</li>)}
            </ul>
          )}

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">Engajamento e camada preventiva</h2>
          <table className="w-full text-sm mb-2">
            <tbody>
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Medidas de PA na meta no período</td>
                <td className="py-1 text-right font-medium">
                  {tempoNoAlvoPeriodo.percentual != null ? `${tempoNoAlvoPeriodo.percentual}% (n=${tempoNoAlvoPeriodo.total})` : "sem medidas suficientes"}
                </td>
              </tr>
              {idadeCoracao.aplicavel && idadeCoracao.resultado && (
                <tr className="border-b border-border">
                  <td className="py-1 text-muted-foreground">Idade do Coração</td>
                  <td className="py-1 text-right font-medium">
                    {idadeCoracao.resultado.idadeDoCoracao} anos ({idadeCoracao.resultado.diferenca > 0 ? "+" : ""}{idadeCoracao.resultado.diferenca} vs. idade real) — calculada em {fmtDate(idadeCoracao.resultado.calculadoEm)}
                  </td>
                </tr>
              )}
              {!idadeCoracao.aplicavel && idadeCoracao.motivo && (
                <tr className="border-b border-border">
                  <td className="py-1 text-muted-foreground">Idade do Coração</td>
                  <td className="py-1 text-right font-medium text-muted-foreground">não aplicável — {idadeCoracao.motivo}</td>
                </tr>
              )}
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Caminhada de 6 min (evolução)</td>
                <td className="py-1 text-right font-medium">{evolucaoCaminhada.frase}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Sentar-e-levantar 30s (evolução)</td>
                <td className="py-1 text-right font-medium">{evolucaoSentarLevantar.frase}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Recuperação da FC 1 min (evolução)</td>
                <td className="py-1 text-right font-medium">{evolucaoRecuperacao.frase}</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Adesão às caminhadas</td>
                <td className="py-1 text-right font-medium">
                  {sessoesPeriodo.length} sessão(ões), {minutosCaminhadaPeriodo} min no período
                  {caminhadas.zona.definidaPeloMedico ? ` — faixa prescrita ${caminhadas.zona.min}–${caminhadas.zona.max} bpm` : " — sem faixa prescrita (sessão livre)"}
                </td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-1 text-muted-foreground">Qualidade de vida (KCCQ simplificado)</td>
                <td className="py-1 text-right font-medium">
                  {qol.ultima ? `${qol.ultima.score}/100 em ${fmtDate(qol.ultima.respondido_em)}${qolPeriodo.length > 1 ? ` (${qolPeriodo.length} respostas no período)` : ""}` : "sem resposta registrada"}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Sódio — média do período</td>
                <td className="py-1 text-right font-medium">
                  {sodioMediaPeriodo != null ? `${sodioMediaPeriodo} mg/dia (referência ${sodio.alvo} mg/dia)` : "sem registros de sódio no período"}
                </td>
              </tr>
            </tbody>
          </table>

          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2 mt-4">Como estou agora — check-ins do período</h2>
          {checkinsPeriodo.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">Nenhum check-in de sintoma no período.</p>
          ) : (
            <ul className="text-sm mb-4 space-y-1">
              {checkinsPeriodo.map((c) => (
                <li key={c.id}>
                  {fmtDate(c.ocorrido_em)} — {DESFECHO_LABEL_REL[c.desfecho]}
                  {c.como_se_sente != null ? ` · como se sentia: ${c.como_se_sente}/10` : ""}
                  {c.observacao ? ` · "${c.observacao}"` : ""}
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-muted-foreground mt-6 pt-4 border-t border-border">
            Gerado em {new Date().toLocaleString("pt-BR")} por {profile?.display_name ?? "profissional"}
            {profile?.registration_number ? ` — CRM ${profile.registration_number}/${profile.registration_state}` : ""}.
            Documento de apoio clínico; a decisão terapêutica é sempre do médico responsável.
          </p>
        </div>
      )}
    </div>
  );
}
