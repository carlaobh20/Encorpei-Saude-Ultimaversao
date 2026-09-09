import { useState } from "react";
import { Loader2, Phone, Stethoscope, Clock3, Building2, Info, Users, Ticket, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import {
  useAdminProfessionals,
  useApproveProfessional,
  useRejectProfessional,
} from "@/hooks/useAdminProfessionals";
import {
  useAdminProfessionalMetrics,
  useAdminProfessionalPatients,
  type ProfessionalMetrics,
} from "@/hooks/useAdminProfessionalMetrics";
import type { ProfessionalProfile } from "@/hooks/useProfessional";

type ProfessionalApprovalStatus = "pending" | "approved" | "rejected";
/**
 * Colunas que o formulário de cadastro do médico grava mas que não estão no
 * schema base — ficam opcionais aqui até virarem migração.
 */
type ProfessionalProfileFull = ProfessionalProfile & {
  phone?: string | null;
  active_patients_today?: number | null;
  monthly_followups?: number | null;
  years_experience?: number | null;
  how_heard?: string | null;
};
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const STATUS_LABEL: Record<ProfessionalApprovalStatus, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
};
const STATUS_TONE: Record<ProfessionalApprovalStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
};
const HOW_HEARD_LABEL: Record<string, string> = {
  indicacao: "Indicação de colega",
  redes_sociais: "Redes sociais",
  evento: "Evento / congresso",
  outro: "Outro",
};

function InfoRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-white/70">
      <Icon className="h-3.5 w-3.5 text-white/40 shrink-0" strokeWidth={1.75} />
      <span className="text-white/40">{label}:</span> {value}
    </div>
  );
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.75} />
      <span className="text-[13px] font-semibold text-white">{value}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

const PATIENT_LINK_STATUS_LABEL: Record<string, string> = {
  pending: "Convite pendente",
  active: "Ativo",
  paused: "Pausado",
  ended: "Encerrado",
};

function PatientsList({ professionalId, open }: { professionalId: string; open: boolean }) {
  const { data: patients = [], isLoading, isError } = useAdminProfessionalPatients(professionalId, open);

  if (!open) return null;

  return (
    <div className="border-t border-white/10 pt-3 space-y-2">
      {isLoading && (
        <div className="flex items-center gap-2 text-white/50 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando pacientes...
        </div>
      )}
      {isError && <p className="text-[12px] text-red-300">Não foi possível carregar as pacientes.</p>}
      {!isLoading && !isError && patients.length === 0 && (
        <p className="text-[12px] text-white/40">Nenhuma paciente vinculada ainda.</p>
      )}
      {patients.map((p) => (
        <div key={p.patient_user_id} className="flex items-center justify-between gap-3 text-[12.5px]">
          <span className="text-white/80 truncate">{p.full_name}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-white/40">
              {p.started_at
                ? new Date(p.started_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                : "—"}
            </span>
            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
              {PATIENT_LINK_STATUS_LABEL[p.status] ?? p.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

function DoctorCard({ item, metrics }: { item: ProfessionalProfileFull; metrics?: ProfessionalMetrics }) {
  const approve = useApproveProfessional();
  const reject = useRejectProfessional();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [showPatients, setShowPatients] = useState(false);

  const invitesGenerated = metrics?.invites_generated ?? 0;
  const invitesUsed = metrics?.invites_used ?? 0;
  const activePatients = metrics?.active_patients ?? 0;
  const conversionPct = invitesGenerated > 0 ? Math.round((invitesUsed / invitesGenerated) * 100) : null;

  const confirmReject = () => {
    if (!reason.trim()) return;
    reject.mutate({ id: item.id, reason }, { onSuccess: () => setRejecting(false) });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{item.display_name}</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[item.approval_status]}`}>
              {STATUS_LABEL[item.approval_status]}
            </span>
          </div>
          <p className="text-[11.5px] text-white/40 mt-1">
            CRM {item.registration_number}/{item.registration_state}
            {" · "}
            {new Date(item.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {item.phone && <InfoRow icon={Phone} label="Telefone" value={item.phone} />}
        {item.clinic_name && <InfoRow icon={Building2} label="Clínica" value={item.clinic_name} />}
        {item.active_patients_today != null && (
          <InfoRow icon={Stethoscope} label="Pacientes hoje" value={String(item.active_patients_today)} />
        )}
        {item.monthly_followups != null && (
          <InfoRow icon={Clock3} label="Acompanhamentos/mês" value={String(item.monthly_followups)} />
        )}
        {item.years_experience != null && (
          <InfoRow icon={Info} label="Experiência" value={`${item.years_experience} anos`} />
        )}
        {item.how_heard && (
          <InfoRow icon={Info} label="Como conheceu" value={HOW_HEARD_LABEL[item.how_heard] ?? item.how_heard} />
        )}
      </div>

      <div className="border-t border-white/10 pt-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <MetricPill icon={Users} label="pacientes vinculadas" value={String(activePatients)} />
          <MetricPill icon={Ticket} label="convites gerados" value={String(invitesGenerated)} />
          <MetricPill icon={TrendingUp} label="convites usados" value={String(invitesUsed)} />
          <MetricPill icon={TrendingUp} label="conversão" value={conversionPct === null ? "—" : `${conversionPct}%`} />
        </div>
        <button
          type="button"
          onClick={() => setShowPatients((v) => !v)}
          className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
        >
          {showPatients ? "Ocultar pacientes" : `Ver pacientes (${activePatients})`}
          {showPatients ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <PatientsList professionalId={item.id} open={showPatients} />
      </div>

      {item.bio && <p className="text-[12.5px] text-white/60 whitespace-pre-wrap border-t border-white/10 pt-2">{item.bio}</p>}

      {item.approval_status === "rejected" && item.rejection_reason && (
        <p className="text-[12px] text-red-300 bg-red-500/10 rounded-xl p-2.5">Motivo da recusa: {item.rejection_reason}</p>
      )}

      {item.approval_status !== "approved" && !rejecting && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(item.id)}>
            {approve.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aprovar"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
            Recusar
          </Button>
        </div>
      )}

      {item.approval_status === "approved" && (
        <div className="pt-1">
          <Button size="sm" variant="secondary" onClick={() => setRejecting(true)}>
            Revogar acesso
          </Button>
        </div>
      )}

      {rejecting && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo — o médico vai ver essa mensagem"
            rows={2}
            className="bg-white/5 border-white/10 text-white text-xs placeholder:text-white/30"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" disabled={reject.isPending || !reason.trim()} onClick={confirmReject}>
              {reject.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar recusa"}
            </Button>
            <Button size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5" onClick={() => { setRejecting(false); setReason(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDoctorsPage() {
  const [statusFilter, setStatusFilter] = useState<ProfessionalApprovalStatus | "all">("pending");
  const { data: items = [], isLoading, isError, error } = useAdminProfessionals(statusFilter);
  const { data: metricsByProfessional } = useAdminProfessionalMetrics();

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[760px] mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Médicos</h1>
          <p className="text-sm text-white/50 mt-1">Cadastros aguardando aprovação e histórico.</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="h-9 w-[150px] bg-white/5 border-white/10 text-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Recusados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Não foi possível carregar os médicos. {(error as any)?.message}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <p className="text-sm text-white/40">Nenhum médico {statusFilter === "pending" ? "pendente" : "aqui"} no momento.</p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <DoctorCard key={item.id} item={item} metrics={metricsByProfessional?.get(item.id)} />
        ))}
      </div>
    </div>
  );
}
