/**
 * PACIENTES — lista completa da carteira: busca por nome, filtro por risco
 * e por status do vínculo, ordenação, ações (abrir / encerrar vínculo) e
 * convites pendentes com código visível.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Users, ChevronRight, Copy, Check, UserX, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InviteCodeDialog } from "@/components/pro/InviteCodeDialog";
import { useProfessionalPatients, type FilaItem } from "@/hooks/useProfessional";
import { RISK_LABEL } from "@/lib/clinical/cardioRiskEngine";
import type { RiskLevel } from "@/types/cardio";

type RiskFilter = "todos" | RiskLevel;
type StatusFilter = "todos" | "active" | "pending";
type SortKey = "risco" | "nome" | "atividade";

const RISK_BADGE_VARIANT: Record<RiskLevel, "urgencia" | "atencao" | "concluido"> = {
  red: "urgencia", yellow: "atencao", green: "concluido",
};
const RISK_ORDER: Record<RiskLevel, number> = { red: 0, yellow: 1, green: 2 };

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

export default function ProPatientsPage() {
  const navigate = useNavigate();
  const { patients, isLoading, desvincular } = useProfessionalPatients();

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [sort, setSort] = useState<SortKey>("risco");
  const [copied, setCopied] = useState<string | null>(null);
  const [encerrarAlvo, setEncerrarAlvo] = useState<FilaItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = patients.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (p.status === "active" && riskFilter !== "todos" && p.risk !== riskFilter) return false;
      if (q && !p.full_name.toLowerCase().includes(q) && !(p.inviteCode ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "nome") return a.full_name.localeCompare(b.full_name);
      if (sort === "atividade") {
        const ta = a.lastReadingAt ? new Date(a.lastReadingAt).getTime() : 0;
        const tb = b.lastReadingAt ? new Date(b.lastReadingAt).getTime() : 0;
        return tb - ta;
      }
      // risco: pendentes ao fim
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return RISK_ORDER[a.risk] - RISK_ORDER[b.risk];
    });
    return list;
  }, [patients, search, riskFilter, statusFilter, sort]);

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  const confirmarEncerrar = () => {
    if (!encerrarAlvo) return;
    desvincular.mutate(encerrarAlvo.link_id, {
      onSuccess: () => { toast.success("Vínculo encerrado."); setEncerrarAlvo(null); },
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Pacientes"
        subtitle={`${patients.filter((p) => p.status === "active").length} ativos · ${patients.filter((p) => p.status === "pending").length} convites pendentes`}
        action={<InviteCodeDialog />}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2.5 mb-5">
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 h-10 flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código de convite…"
            className="border-0 bg-transparent focus-visible:ring-0 px-1 h-8"
          />
        </div>
        {(["todos", "active", "pending"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 h-10 rounded-xl text-xs font-semibold border transition-colors",
              statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-border-strong",
            )}
          >
            {s === "todos" ? "Todos" : s === "active" ? "Ativos" : "Convite pendente"}
          </button>
        ))}
        {(["todos", "red", "yellow", "green"] as RiskFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={cn(
              "px-3 h-10 rounded-xl text-xs font-semibold border transition-colors",
              riskFilter === r ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-border-strong",
            )}
          >
            {r === "todos" ? "Qualquer risco" : RISK_LABEL[r]}
          </button>
        ))}
        <button
          onClick={() => setSort((s) => (s === "risco" ? "nome" : s === "nome" ? "atividade" : "risco"))}
          className="px-3 h-10 rounded-xl text-xs font-semibold border border-border bg-card text-muted-foreground hover:border-border-strong inline-flex items-center gap-1.5"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sort === "risco" ? "Ordenar: risco" : sort === "nome" ? "Ordenar: nome" : "Ordenar: última atividade"}
        </button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={patients.length === 0 ? "Nenhum paciente ainda" : "Nada encontrado"}
          description={patients.length === 0 ? "Convide seu primeiro paciente para começar." : "Ajuste a busca ou os filtros."}
          variant="card"
        />
      ) : (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {filtered.map((p, i) => (
            <div
              key={p.link_id}
              className={cn("flex items-center gap-3 p-4", i < filtered.length - 1 && "border-b border-border")}
            >
              <div className="h-10 w-10 shrink-0 rounded-full grid place-items-center text-white text-xs font-semibold bg-gradient-to-br from-primary to-cardio-dark">
                {p.status === "pending" ? "⋯" : initials(p.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground truncate">{p.full_name}</span>
                  {p.status === "active" ? (
                    <span className={cn("shrink-0")}>
                      <StatusBadge variant={RISK_BADGE_VARIANT[p.risk]}>{RISK_LABEL[p.risk]}</StatusBadge>
                    </span>
                  ) : (
                    <StatusBadge variant="pendente">Convite pendente</StatusBadge>
                  )}
                </div>
                {p.status === "active" ? (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {p.condition || "—"} · última atividade {fmtDate(p.lastReadingAt)}
                    {p.openAlerts > 0 && <span className="text-error font-medium"> · {p.openAlerts} alerta{p.openAlerts > 1 ? "s" : ""}</span>}
                  </p>
                ) : (
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    Código: <span className="font-mono font-semibold text-foreground">{p.inviteCode ?? "—"}</span>
                    {p.inviteCode && (
                      <button onClick={() => copy(p.inviteCode!)} className="text-primary hover:text-cardio-dark">
                        {copied === p.inviteCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.status === "active" ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/pro/pacientes/${p.patient_user_id}`)}>
                      Abrir <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)}>
                      <UserX className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-error" onClick={() => setEncerrarAlvo(p)}>
                    Cancelar convite
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!encerrarAlvo} onOpenChange={(o) => !o && setEncerrarAlvo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {encerrarAlvo?.status === "active" ? "Encerrar vínculo?" : "Cancelar convite?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {encerrarAlvo?.status === "active"
                ? `${encerrarAlvo?.full_name} deixará de aparecer no seu painel. Esta ação não apaga os dados clínicos já registrados.`
                : "O código deixa de funcionar. Você pode gerar um novo convite quando quiser."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEncerrar} className="bg-error text-white hover:bg-error/90">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
