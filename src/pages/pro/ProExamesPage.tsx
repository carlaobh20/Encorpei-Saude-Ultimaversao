/**
 * EXAMES — visão de exames de toda a carteira: pendências (LDL fora do alvo,
 * NT-proBNP alterado etc.) e resultados recentes por paciente, com filtro
 * por tipo de exame. Cada paciente é consultado individualmente pelos hooks
 * cardio (não há endpoint agregado) — aceitável no tamanho de carteira de
 * um cardiologista.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, HeartPulse, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfessionalPatients } from "@/hooks/useProfessional";
import { useLabResults, useCardioExams } from "@/hooks/useCardioClinical";
import type { CardioExamType } from "@/types/cardio";

const EXAM_TYPE_LABEL: Record<CardioExamType, string> = {
  ecg: "ECG de repouso", echocardiogram: "Ecocardiograma", stress_test: "Teste ergométrico",
  holter: "Holter 24h", abpm: "MAPA 24h", coronary_ct: "Angio-TC de coronárias",
  myocardial_spect: "Cintilografia miocárdica", cardiac_mri: "RM cardíaca",
  catheterization: "Cateterismo", carotid_doppler: "Doppler de carótidas",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

/** Um paciente = uma "linha" de hooks — carteira de cardiologista costuma caber em memória sem paginação. */
function usePatientExamRow(patientUserId: string) {
  const { labs } = useLabResults(patientUserId);
  const { exams } = useCardioExams(patientUserId);
  return { labs, exams };
}

function PatientExamBlock({ patientUserId, patientName, typeFilter, onOpen }: {
  patientUserId: string; patientName: string; typeFilter: "todos" | CardioExamType | "labs";
  onOpen: () => void;
}) {
  const { labs, exams } = usePatientExamRow(patientUserId);

  const pendencias = useMemo(() => labs.filter((l) => l.status === "attention" || l.status === "critical"), [labs]);
  const examesFiltrados = useMemo(
    () => (typeFilter === "todos" || typeFilter === "labs" ? exams : exams.filter((e) => e.exam_type === typeFilter)),
    [exams, typeFilter],
  );
  const labsFiltrados = typeFilter === "todos" || typeFilter === "labs" ? labs.slice(0, 4) : [];

  if (pendencias.length === 0 && examesFiltrados.length === 0 && (typeFilter !== "todos" || labs.length === 0)) return null;

  return (
    <div className="rounded-2xl bg-card border border-border p-4 mb-3">
      <button onClick={onOpen} className="flex items-center justify-between w-full mb-2 text-left">
        <span className="text-sm font-semibold text-foreground">{patientName}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>

      {pendencias.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendencias.map((l) => (
            <span key={l.id} className={cn(
              "inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 font-medium",
              l.status === "critical" ? "bg-error-bg text-error" : "bg-warning-bg text-warning",
            )}>
              <AlertTriangle className="h-3 w-3" /> {l.marker_label} {l.value_num ?? l.value_text} {l.unit}
            </span>
          ))}
        </div>
      )}

      {labsFiltrados.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Últimos laboratoriais ({fmtDate(labsFiltrados[0]?.collected_at)}): {labsFiltrados.map((l) => `${l.marker_label} ${l.value_num ?? l.value_text}${l.unit ?? ""}`).join(" · ")}
        </p>
      )}

      {examesFiltrados.length > 0 && (
        <div className="mt-2 space-y-1">
          {examesFiltrados.slice(0, 3).map((e) => (
            <p key={e.id} className="text-xs text-foreground">
              <span className="font-medium">{EXAM_TYPE_LABEL[e.exam_type]}</span> · {fmtDate(e.performed_at)}
              {e.conclusion && <span className="text-muted-foreground"> — {e.conclusion}</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProExamesPage() {
  const navigate = useNavigate();
  const { patients, isLoading } = useProfessionalPatients();
  const [typeFilter, setTypeFilter] = useState<"todos" | CardioExamType | "labs">("todos");

  const ativos = useMemo(() => patients.filter((p) => p.status === "active"), [patients]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader title="Exames" subtitle="Pendências e resultados recentes de toda a carteira" />

      <div className="flex items-center gap-2 mb-5">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
          <SelectTrigger className="h-9 w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="labs">Laboratório</SelectItem>
            {(Object.keys(EXAM_TYPE_LABEL) as CardioExamType[]).map((k) => (
              <SelectItem key={k} value={k}>{EXAM_TYPE_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : ativos.length === 0 ? (
        <EmptyState icon={HeartPulse} title="Nenhum paciente ativo" description="Exames aparecem aqui assim que houver pacientes vinculados." variant="card" />
      ) : (
        <div>
          <SectionHeader title="Por paciente" subtitle={`${ativos.length} paciente${ativos.length === 1 ? "" : "s"}`} />
          {ativos.map((p) => (
            <PatientExamBlock
              key={p.patient_user_id}
              patientUserId={p.patient_user_id}
              patientName={p.full_name}
              typeFilter={typeFilter}
              onOpen={() => navigate(`/pro/pacientes/${p.patient_user_id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
