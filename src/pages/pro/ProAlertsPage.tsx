/**
 * ALERTAS — fila de trabalho, não caixa de entrada.
 *
 * Duas mudanças estruturais em relação à versão anterior:
 *
 * 1. RISCO CLÍNICO ≠ ATRASO OPERACIONAL. Antes, "adesão < 80%" e "sem dados"
 *    disputavam a mesma lista com "PA em crise" e "ritmo irregular". O efeito
 *    prático de misturar é conhecido: a lista incha de coisa administrativa, o
 *    médico aprende que a maioria dos alertas não exige nada dele, e passa a
 *    ignorar a lista inteira — inclusive a linha que importava. Agora são duas
 *    seções, com contagens próprias. As duas exigem trabalho; só uma exige
 *    trabalho DO MÉDICO.
 *
 * 2. FLUXO em vez de "lido/dispensado". Aberto → em avaliação → contato
 *    realizado → resolvido, com responsável e justificativa. "Dispensado" sem
 *    justificativa era o buraco de rastreabilidade: numa revisão de evento
 *    adverso, a pergunta é "o alerta disparou — o que foi feito?", e a resposta
 *    era um booleano.
 *
 * `is_read`/`is_dismissed` continuam existindo (o gatilho da migração os mantém
 * coerentes), então o badge do shell e o app do paciente não mudam.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell, Archive, AlertTriangle, Clock, Info, Siren, HeartPulse, ClipboardList,
  UserCheck, PhoneCall, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { ListSkeleton } from "@/components/shell/Skeletons";
import { AppModal } from "@/components/shell/AppModal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  useProfessionalAlerts, useProfessionalPatients, fluxoDoAlerta,
  LABEL_WORKFLOW, type AlertWorkflowStatus, type AlertaComFluxo,
} from "@/hooks/useProfessional";
import { tempoRelativo } from "@/hooks/useCarteiraIndicadores";
import type { Severity } from "@/types/cardio";

type Filter = "abertos" | "todos";

const SEVERITY_META: Record<Severity, { label: string; icon: typeof Bell; tone: string; bg: string }> = {
  emergency: { label: "Emergência", icon: Siren, tone: "text-error", bg: "bg-error-bg" },
  critical: { label: "Crítico", icon: AlertTriangle, tone: "text-error", bg: "bg-error-bg" },
  warning: { label: "Atenção", icon: Clock, tone: "text-warning", bg: "bg-warning-bg" },
  info: { label: "Informativo", icon: Info, tone: "text-muted-foreground", bg: "bg-secondary" },
};
const SEVERITY_ORDER: Record<Severity, number> = { emergency: 0, critical: 1, warning: 2, info: 3 };

/**
 * Tom do estado do fluxo. "Aberto" é o único que grita: é o único que significa
 * que ninguém pegou o alerta. "Contato realizado" é verde-claro e não verde
 * cheio — falar com o paciente não encerra o caso, só tira o alerta do limbo.
 */
const WORKFLOW_META: Record<AlertWorkflowStatus, { tone: string; icon: typeof Bell }> = {
  open: { tone: "bg-error-bg text-error", icon: Bell },
  reviewing: { tone: "bg-warning-bg text-warning", icon: UserCheck },
  contacted: { tone: "bg-info-bg text-info", icon: PhoneCall },
  resolved: { tone: "bg-success-bg text-success", icon: CheckCircle2 },
};

/** Próximo passo do fluxo — a tela oferece UM botão, não quatro. Fluxo com
 *  quatro botões simultâneos vira "escolha um estado", e não fluxo. */
const PROXIMO: Record<AlertWorkflowStatus, AlertWorkflowStatus | null> = {
  open: "reviewing",
  reviewing: "contacted",
  contacted: "resolved",
  resolved: null,
};

/** Filtra pelo estado do fluxo e ordena por gravidade, depois por recência.
 *  Fora do componente porque não depende de nada dele — e assim o `useMemo`
 *  que a chama tem lista de dependências honesta. */
function preparar(lista: AlertaComFluxo[], filter: Filter): AlertaComFluxo[] {
  return lista
    .filter((a) => (filter === "abertos" ? fluxoDoAlerta(a) !== "resolved" : true))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        b.triggered_at.localeCompare(a.triggered_at),
    );
}

function AlertRow({ a, patientName, onOpen, onAvancar, onResolver, onDispensar }: {
  a: AlertaComFluxo;
  patientName: string;
  onOpen: () => void;
  onAvancar: (para: AlertWorkflowStatus) => void;
  onResolver: () => void;
  onDispensar: () => void;
}) {
  const meta = SEVERITY_META[a.severity];
  const fluxo = fluxoDoAlerta(a);
  const wf = WORKFLOW_META[fluxo];
  const proximo = PROXIMO[fluxo];

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-start gap-3 p-4 border-b border-border last:border-0",
      fluxo === "open" && "bg-primary/[0.03]",
    )}>
      <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", meta.bg, meta.tone)}>
        <meta.icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onOpen} className="text-sm font-semibold text-foreground hover:text-primary truncate">{patientName}</button>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", meta.tone)}>{meta.label}</span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", wf.tone)}>
            <wf.icon className="h-3 w-3" /> {LABEL_WORKFLOW[fluxo]}
          </span>
        </div>

        <p className="text-sm text-foreground mt-0.5">{a.title}</p>
        {a.description && <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>}

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
          <span>valor: <b className="text-foreground tabular-nums">{a.trigger_value ?? "sem valor registrado"}</b></span>
          <span>limiar: {a.threshold_value ?? "sem limiar registrado"}</span>
          <span>{tempoRelativo(a.triggered_at)}</span>
          {/* Responsável é informação de primeira classe: "em avaliação" sem
              nome é a mesma névoa que "lido" era. */}
          <span>{a.assigned_to ? "responsável definido" : "sem responsável"}</span>
        </div>

        {a.resolution_note && (
          <p className="text-[11px] text-muted-foreground mt-1.5 border-l-2 border-border pl-2">
            Justificativa: <span className="text-foreground">{a.resolution_note}</span>
            {a.resolved_at && ` · ${tempoRelativo(a.resolved_at)}`}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0 flex-wrap">
        {proximo === "resolved" ? (
          // Resolver abre o modal: a justificativa é obrigatória, então não
          // pode existir um caminho de um clique até "resolvido".
          <Button variant="ghost" size="sm" onClick={onResolver}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
          </Button>
        ) : proximo ? (
          <Button variant="ghost" size="sm" onClick={() => onAvancar(proximo)}>
            {proximo === "reviewing" ? <UserCheck className="h-3.5 w-3.5" /> : <PhoneCall className="h-3.5 w-3.5" />}
            {LABEL_WORKFLOW[proximo]}
          </Button>
        ) : null}
        {fluxo !== "resolved" && (
          <Button variant="ghost" size="sm" onClick={onDispensar} title="Dispensar sem tratar (compatibilidade)">
            <Archive className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ProAlertsPage() {
  const navigate = useNavigate();
  const { alerts, clinicos, operacionais, semResponsavel, isLoading, dispensar, mover } = useProfessionalAlerts();
  const { patients } = useProfessionalPatients();
  const [filter, setFilter] = useState<Filter>("abertos");
  const [resolvendo, setResolvendo] = useState<AlertaComFluxo | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    patients.forEach((p) => m.set(p.patient_user_id, p.full_name));
    return m;
  }, [patients]);

  /**
   * "Abertos" agora significa "ainda dão trabalho", não "não lidos" — a
   * distinção é o ponto do fluxo: um alerta lido e abandonado continua sendo
   * trabalho pendente.
   */
  const listaClinica = useMemo(() => preparar(clinicos, filter), [clinicos, filter]);
  const listaOperacional = useMemo(() => preparar(operacionais, filter), [operacionais, filter]);

  const confirmarResolucao = () => {
    if (!resolvendo || !justificativa.trim()) return;
    mover.mutate(
      { id: resolvendo.id, para: "resolved", justificativa },
      { onSuccess: () => { setResolvendo(null); setJustificativa(""); } },
    );
  };

  const linha = (a: AlertaComFluxo) => (
    <AlertRow
      key={a.id}
      a={a}
      patientName={nameOf.get(a.patient_user_id) ?? "Paciente"}
      onOpen={() => navigate(`/pro/pacientes/${a.patient_user_id}`)}
      onAvancar={(para) => mover.mutate({ id: a.id, para })}
      onResolver={() => { setResolvendo(a); setJustificativa(""); }}
      onDispensar={() => dispensar.mutate(a.id)}
    />
  );

  const vazio = listaClinica.length === 0 && listaOperacional.length === 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-5 md:px-8 lg:px-10 py-6 md:py-8">
      <PageHeader
        title="Alertas"
        subtitle={semResponsavel > 0
          ? `${semResponsavel} sem responsável — ninguém assumiu ainda`
          : "Todos os alertas abertos já têm responsável"}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(["abertos", "todos"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 h-9 rounded-xl text-xs font-semibold border transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-border-strong")}>
            {f === "abertos" ? `Em aberto (${alerts.filter((a) => fluxoDoAlerta(a) !== "resolved").length})` : `Todos (${alerts.length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : vazio ? (
        <EmptyState
          icon={Bell}
          title="Nenhum alerta"
          description={filter === "abertos" ? "Nada em aberto no momento." : "Quando um limiar disparar, aparece aqui."}
          variant="card"
        />
      ) : (
        <div className="space-y-6">
          {/* ── RISCO CLÍNICO ─────────────────────────────────────────── */}
          <section>
            <SectionHeader
              title="Risco clínico"
              subtitle="pressão, ritmo, peso, sintoma e exame — exige avaliação médica"
            />
            {listaClinica.length === 0 ? (
              <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-success shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Nenhum alerta de risco clínico em aberto. Isso vale para quem está medindo —
                  pacientes sem dados recentes aparecem no painel, não aqui.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-error-bg overflow-hidden">
                {listaClinica.map(linha)}
              </div>
            )}
          </section>

          {/* ── ATRASO OPERACIONAL ────────────────────────────────────── */}
          <section>
            <SectionHeader
              title="Atraso operacional"
              subtitle="adesão e falta de registro — trabalho de contato, não conduta clínica"
            />
            {listaOperacional.length === 0 ? (
              <div className="rounded-2xl bg-card border border-border p-4 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">Nenhuma pendência operacional em aberto.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-card border border-border overflow-hidden">
                {listaOperacional.map(linha)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Resolver EXIGE justificativa. Um "resolvido" em branco é
          indistinguível de um alerta fechado para limpar a tela. */}
      <AppModal open={!!resolvendo} onOpenChange={(o) => { if (!o) { setResolvendo(null); setJustificativa(""); } }} title="Resolver alerta">
        <div className="space-y-3">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs font-semibold text-foreground">{resolvendo?.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {resolvendo ? nameOf.get(resolvendo.patient_user_id) ?? "Paciente" : ""} · valor {resolvendo?.trigger_value ?? "não registrado"}
            </p>
          </div>
          <div>
            <label htmlFor="justificativa" className="text-xs font-semibold text-foreground">
              O que foi verificado e qual foi o desfecho?
            </label>
            <Textarea
              id="justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={4}
              placeholder="Ex.: paciente contatado por telefone, refez as medidas com o aparelho de braço, valores dentro do alvo. Reavaliação na consulta de 12/10."
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Fica registrado com o seu nome e a data. É o que responde, meses depois,
              o que foi feito quando este alerta disparou.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { setResolvendo(null); setJustificativa(""); }}>Voltar</Button>
            <Button onClick={confirmarResolucao} disabled={!justificativa.trim() || mover.isPending}>
              {mover.isPending ? "Salvando…" : "Resolver alerta"}
            </Button>
          </div>
        </div>
      </AppModal>
    </div>
  );
}
