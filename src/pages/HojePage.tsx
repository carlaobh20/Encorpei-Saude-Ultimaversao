/**
 * HojePage — a home do paciente.
 *
 * A espinha emocional do app (docs/ENGAJAMENTO-CARDIO.md §1-2): primeiro a
 * prova de que o esforço está funcionando (Idade do Coração / Tempo no
 * Alvo), depois o que falta fazer hoje, os números, os avisos, uma
 * conquista, a próxima lição e a próxima consulta. Nada de menu — uma
 * página que responde "como estou e o que preciso fazer hoje".
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, HeartPulse, Footprints, Moon, Gauge, Pill, Scale,
  CalendarClock, ChevronRight, PhoneCall, CheckCircle2, Salad,
  Award, GraduationCap, ClipboardList,
} from "lucide-react";
import { usePendenciasDeHoje, ROTULO_METRICA } from "@/hooks/usePlanoMonitoramento";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { StatCard } from "@/components/shell/StatCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { AppModal } from "@/components/shell/AppModal";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";
import { useCardioPatient } from "@/hooks/useCardioPatient";
import { useBloodPressure, useHeartRate, useWeight, useActivity, useSleep } from "@/hooks/useCardioReadings";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useCardioAlerts } from "@/hooks/useCardioClinical";
import { useAppointments } from "@/hooks/useProfessional";
import {
  useIdadeDoCoracao, useTempoNoAlvo, useConquistas, useAprender, useSodio,
  useQualidadeDeVida, PERGUNTAS_QOL, OPCOES_QOL,
} from "@/hooks/useEngajamento";
import { DOMAIN_COLORS } from "@/theme/colors";
import { cn } from "@/lib/utils";

const FRASES_DO_DIA = [
  "Um dia de cada vez, um número de cada vez.",
  "Cada medida é uma prova de que você está cuidando de você.",
  "Pequenos hábitos de hoje são o coração de amanhã.",
  "Você não precisa ser perfeito — precisa ser constante.",
  "Seu coração registra cada esforço, mesmo quando você não vê.",
  "Hoje é mais um dia a favor do seu coração.",
  "Cuidar do coração é um ato de carinho com quem você ama.",
];

function primeiroNome(nome?: string | null): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0];
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) + " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function ehHoje(iso?: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString();
}

/** Diálogo do questionário mensal de qualidade de vida (derivado do KCCQ). */
function DialogoQualidadeDeVida({
  open, onOpenChange, onConcluir,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluir: (respostas: Record<string, number>) => void;
}) {
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const completo = PERGUNTAS_QOL.every((p) => respostas[p.chave] !== undefined);

  return (
    <AppModal
      open={open}
      onOpenChange={(o) => { onOpenChange(o); if (!o) setRespostas({}); }}
      title="Como você tem passado"
    >
      <div className="py-2 space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Sete perguntas rápidas sobre as últimas duas semanas. Seu médico vai ver as respostas.
        </p>
        {PERGUNTAS_QOL.map((p) => (
          <div key={p.chave}>
            <p className="text-sm font-medium text-foreground mb-2 leading-relaxed">{p.texto}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {OPCOES_QOL.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  onClick={() => setRespostas((r) => ({ ...r, [p.chave]: o.valor }))}
                  className={cn(
                    "text-left rounded-xl border px-3 py-2 text-sm transition-colors",
                    respostas[p.chave] === o.valor
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {o.rotulo}
                </button>
              ))}
            </div>
          </div>
        ))}
        <Button
          className="w-full"
          size="lg"
          disabled={!completo}
          onClick={() => { onConcluir(respostas); setRespostas({}); }}
        >
          Enviar respostas
        </Button>
      </div>
    </AppModal>
  );
}

export default function HojePage() {
  const navigate = useNavigate();
  const { profile, loading: loadingProfile } = useProfile();
  const { data: patient } = useCardioPatient();

  const bp = useBloodPressure();
  const hr = useHeartRate();
  const weight = useWeight();
  const activity = useActivity();
  const sleep = useSleep();
  const meds = useCardioMedications();
  const alerts = useCardioAlerts();
  const appointments = useAppointments();

  const idadeCoracao = useIdadeDoCoracao();
  const tempoNoAlvo = useTempoNoAlvo();
  const conquistas = useConquistas();
  const aprender = useAprender();
  const sodio = useSodio();
  const qol = useQualidadeDeVida();

  const [qolAberto, setQolAberto] = useState(false);

  const nome = primeiroNome(profile?.full_name);
  const frase = FRASES_DO_DIA[new Date().getDay() % FRASES_DO_DIA.length];
  const temIC = !!patient?.history?.heart_failure;

  // Regra do §4: a última pressão mostrada aqui nunca pode ser uma
  // estimativa de pulseira sem rótulo — só medida com manguito conta
  // para este número. (docs/CONTRATO-DE-CODIGO.md, regra 2)
  const ultimaPressaoValidada = bp.readings.find((r) => r.cuff_validated) ?? null;

  const pressaoHoje = ehHoje(bp.ultima?.recorded_at);
  const pesoHoje = ehHoje(weight.ultimo?.recorded_at);
  const sodioHoje = sodio.registros.some((r) => r.dia === sodio.hoje);
  const dosesPendentes = meds.dosesDeHoje.filter((d) => !d.taken);

  const tarefas: { key: string; label: string; onAction: () => void; actionLabel: string; icon: typeof Pill }[] = [];
  if (dosesPendentes.length > 0) {
    tarefas.push({
      key: "doses",
      label: `${dosesPendentes.length} dose${dosesPendentes.length > 1 ? "s" : ""} de remédio ainda hoje`,
      onAction: () => navigate("/remedios"),
      actionLabel: "Marcar",
      icon: Pill,
    });
  }
  if (!pressaoHoje) {
    tarefas.push({
      key: "pressao",
      label: "Você ainda não mediu a pressão hoje",
      onAction: () => navigate("/pressao"),
      actionLabel: "Medir pressão",
      icon: Gauge,
    });
  }
  if (temIC && !pesoHoje) {
    tarefas.push({
      key: "peso",
      label: "Registre seu peso — você tem insuficiência cardíaca, o peso é acompanhado todo dia",
      onAction: () => navigate("/peso"),
      actionLabel: "Registrar peso",
      icon: Scale,
    });
  }
  if (!sodioHoje) {
    tarefas.push({
      key: "sodio",
      label: "Ainda não há refeições registradas hoje",
      onAction: () => navigate("/alimentacao"),
      actionLabel: "Registrar refeição",
      icon: Salad,
    });
  }

  const plano = usePendenciasDeHoje();

  const isLoading = loadingProfile || bp.isLoading || meds.isLoading || idadeCoracao.isLoading || tempoNoAlvo.isLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Hoje" />
        <TabPageSkeleton />
      </div>
    );
  }

  const proxima = appointments.proxima;
  const alertasAbertos = alerts.alerts.filter((a) => !a.is_dismissed);
  const melhorConquista = conquistas[0] ?? null;
  const proximaLicao = aprender.proxima;
  const combinado = plano;

  return (
    <div className="pb-10">
      <PageHeader title={nome ? `Olá, ${nome}` : "Hoje"} subtitle={frase} />

      {/* ── O combinado de hoje ──────────────────────────────────────
          Este cartão é a ponte entre a prescrição do médico e o dia do
          paciente. Enquanto o médico não prescreve nada, ele diz que é
          sugestão do app — nunca finge que é ordem médica. */}
      {combinado.total > 0 && (
        <SurfaceCard className="mb-6">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-semibold">O combinado de hoje</p>
            <p className="text-sm font-semibold tabular-nums text-primary">
              {combinado.concluidas}/{combinado.total}
            </p>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${combinado.percentual}%` }} />
          </div>
          {combinado.abertas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {combinado.abertas.map((p) => (
                <span key={p.metric} className="rounded-full bg-primary/10 text-primary text-xs font-medium px-2.5 py-1">
                  {ROTULO_METRICA[p.metric]}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-3">Tudo registrado. Até amanhã.</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            {combinado.prescrito
              ? "Definido pelo seu médico."
              : "Sugestão do app — seu médico ainda não definiu um plano."}
            {" "}Toque no botão <strong>Registrar</strong>, no meio da barra de baixo.
          </p>
        </SurfaceCard>
      )}

      {/* ── Cartão do coração — o primeiro elemento, de propósito ──── */}
      <SurfaceCard
        className="mb-6 bg-primary/5 border border-primary/15 cursor-pointer"
        onClick={() => navigate("/meu-coracao")}
      >
        {idadeCoracao.aplicavel && idadeCoracao.resultado ? (
          <div className="text-center py-1">
            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Idade do coração</p>
            <p className="text-6xl font-display font-bold text-foreground leading-none">
              {idadeCoracao.resultado.idadeDoCoracao}
              <span className="text-xl font-medium text-muted-foreground"> anos</span>
            </p>
            <p className="text-sm text-muted-foreground mt-3">
              {idadeCoracao.resultado.diferenca > 0 && (
                <>Você tem {idadeCoracao.resultado.idadeReal} anos — seu coração está trabalhando como o de alguém mais velho.</>
              )}
              {idadeCoracao.resultado.diferenca === 0 && <>Seu coração tem exatamente a sua idade.</>}
              {idadeCoracao.resultado.diferenca < 0 && (
                <>Seu coração trabalha como o de alguém {Math.abs(idadeCoracao.resultado.diferenca)} anos mais novo que você.</>
              )}
            </p>
            <p className="text-xs font-medium text-primary mt-3 inline-flex items-center gap-1">
              Ver meu coração <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </div>
        ) : (
          <div className="text-center py-1">
            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">Tempo no alvo este mês</p>
            <p className="text-6xl font-display font-bold text-foreground leading-none">
              {tempoNoAlvo.mes.percentual != null ? `${tempoNoAlvo.mes.percentual}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{tempoNoAlvo.mes.frase}</p>
            <p className="text-xs font-medium text-primary mt-3 inline-flex items-center gap-1">
              Ver meu coração <ChevronRight className="h-3.5 w-3.5" />
            </p>
          </div>
        )}
      </SurfaceCard>

      {/* ── O que falta hoje ─────────────────────────────────────── */}
      {tarefas.length > 0 && (
        <div className="mb-6">
          <SectionHeader title="O que falta hoje" />
          <div className="space-y-3">
            {tarefas.map((t) => (
              <SurfaceCard key={t.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <t.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                </div>
                <Button size="lg" onClick={t.onAction} className="shrink-0">
                  {t.actionLabel}
                </Button>
              </SurfaceCard>
            ))}
          </div>
        </div>
      )}
      {tarefas.length === 0 && (
        <SurfaceCard className="mb-6 bg-success-bg border-0 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <p className="text-sm font-medium text-foreground">Tudo certo por hoje. Nada pendente.</p>
        </SurfaceCard>
      )}

      {/* ── Seus números ─────────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Seus números" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Última pressão"
            value={ultimaPressaoValidada ? `${ultimaPressaoValidada.systolic}/${ultimaPressaoValidada.diastolic}` : "—"}
            icon={Gauge}
            iconColor={DOMAIN_COLORS.pressao}
          />
          <StatCard
            label="Batimentos em repouso"
            value={hr.repouso[0] ? `${hr.repouso[0].bpm} bpm` : "—"}
            icon={HeartPulse}
            iconColor={DOMAIN_COLORS.coracao}
          />
          <StatCard
            label="Passos de ontem"
            value={activity.records[1]?.steps ?? activity.hoje?.steps ?? "—"}
            icon={Footprints}
            iconColor={DOMAIN_COLORS.atividade}
          />
          <StatCard
            label="Sono da noite"
            value={sleep.ultima ? `${Math.round(sleep.ultima.total_minutes / 60 * 10) / 10} h` : "—"}
            icon={Moon}
            iconColor={DOMAIN_COLORS.sono}
          />
        </div>
      </div>

      {/* ── Alertas abertos ──────────────────────────────────────── */}
      {alertasAbertos.length > 0 && (
        <div className="mb-6">
          <SectionHeader title="Avisos" />
          <div className="space-y-3">
            {alertasAbertos.map((a) => (
              <SurfaceCard
                key={a.id}
                className={a.severity === "critical" || a.severity === "emergency" ? "bg-error-bg border-0" : "bg-warning-bg border-0"}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`h-5 w-5 shrink-0 mt-0.5 ${a.severity === "critical" || a.severity === "emergency" ? "text-error" : "text-warning"}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.description}</p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        </div>
      )}

      {/* ── Uma conquista ────────────────────────────────────────── */}
      {melhorConquista && (
        <SurfaceCard className="mb-6 bg-surface-warm border-0">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-full bg-card/80 grid place-items-center shrink-0">
              <Award className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed pt-1.5">{melhorConquista.texto}</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── Próxima lição ────────────────────────────────────────── */}
      {proximaLicao && (
        <SurfaceCard
          className="mb-6 cursor-pointer"
          onClick={() => navigate("/aprender")}
        >
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{proximaLicao.origem}</p>
              <p className="text-sm font-semibold text-foreground mt-0.5">{proximaLicao.titulo}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{proximaLicao.corpo}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
          </div>
        </SurfaceCard>
      )}

      {/* ── Questionário mensal ──────────────────────────────────── */}
      {qol.devePerguntar && (
        <SurfaceCard
          className="mb-6 border-dashed cursor-pointer"
          onClick={() => setQolAberto(true)}
        >
          <div className="flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Como você tem passado nas últimas semanas?</p>
              <p className="text-xs text-muted-foreground mt-0.5">7 perguntas rápidas, uma vez por mês</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SurfaceCard>
      )}
      <DialogoQualidadeDeVida
        open={qolAberto}
        onOpenChange={setQolAberto}
        onConcluir={(respostas) => {
          qol.responder.mutate(respostas);
          setQolAberto(false);
        }}
      />

      {/* ── Próxima consulta ─────────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Próxima consulta" />
        {proxima ? (
          <SurfaceCard
            className="flex items-center justify-between gap-3 cursor-pointer"
            onClick={() => navigate("/agenda")}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <CalendarClock className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{fmtDataHora(proxima.scheduled_at)}</p>
                <p className="text-xs text-muted-foreground truncate">{proxima.location ?? "Local a confirmar"}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </SurfaceCard>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Sem consulta marcada"
            description="Quando seu médico agendar uma consulta, ela aparece aqui."
            variant="card"
          />
        )}
      </div>

      {/* ── Botão de emergência — discreto, sempre visível ──────── */}
      <button
        onClick={() => navigate("/como-estou")}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border border-error/30 bg-card py-3.5 text-sm font-semibold text-error hover:bg-error-bg transition-colors"
      >
        <PhoneCall className="h-4 w-4" />
        Não estou bem
      </button>
    </div>
  );
}
