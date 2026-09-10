/**
 * CuidadorHomePage — a tela do familiar que acompanha um paciente.
 * docs/ENGAJAMENTO-CARDIO.md §3.3 e §6.4
 *
 * Rota pública (`/cuidador`): a pessoa tem conta, mas não precisa ser
 * paciente para entrar aqui. Layout próprio — não usa o AppShell, que é do
 * paciente.
 *
 * REGRAS QUE ESTA TELA MANTÉM:
 *  - Acesso é SOMENTE LEITURA. Nada aqui registra dado em nome do paciente.
 *  - Cada seção só aparece se a permissão do vínculo liberar — sem exceção.
 *  - Nunca substitui o médico: aviso de emergência sempre visível.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  HeartPulse, Pill, Footprints, Moon, AlertTriangle, LogOut, ArrowRight,
  Users, ShieldCheck, PhoneCall, Clock, Stethoscope, FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDeQuemCuido } from "@/hooks/useCuidadores";
import { useCardioPatient, useNomesDePacientes } from "@/hooks/useCardioPatient";
import { useBloodPressure, useActivity, useSleep } from "@/hooks/useCardioReadings";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useCardioAlerts, useCardioExams, useLabResults, useSymptoms } from "@/hooks/useCardioClinical";
import { useTempoNoAlvo } from "@/hooks/useEngajamento";
import { APP_NAME, EMERGENCIA_TELEFONE } from "@/lib/config";
import type { CaregiverLink } from "@/types/cardio";

function primeiroNome(nome?: string | null): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0];
}

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const data = mesmoDia
    ? "hoje"
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  return `${data} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Cabeçalho próprio — sem menu lateral, sem barra inferior. É a área do familiar. */
function Cabecalho({ mostrarSair }: { mostrarSair: boolean }) {
  const { signOut } = useAuth();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between bg-card/95 backdrop-blur border-b border-border px-4 py-3">
      <div className="flex items-center gap-2.5">
        <img src="/logo-symbol.png" alt={APP_NAME} width={30} height={30} className="object-contain" style={{ width: 30, height: 30 }} />
        <div className="leading-none">
          <div className="font-display text-sm font-semibold text-foreground">Encorpei</div>
          <div className="font-script text-[12px] text-primary">Cardio · Cuidador</div>
        </div>
      </div>
      {mostrarSair && (
        <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
          <LogOut className="h-4 w-4" /> Sair
        </Button>
      )}
    </header>
  );
}

/** Aviso permanente — nunca escondido dentro de outra tela. */
function AvisoLimites() {
  return (
    <div className="mt-8 rounded-2xl border border-border bg-secondary/60 px-4 py-3.5 flex items-start gap-3">
      <PhoneCall className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
      <p className="text-xs text-muted-foreground leading-relaxed">
        Você está acompanhando, não substituindo o médico. Em emergência, ligue{" "}
        <span className="font-semibold text-foreground">{EMERGENCIA_TELEFONE}</span>.
      </p>
    </div>
  );
}

/**
 * Chip do seletor de paciente.
 *
 * O nome chega PRONTO por prop: buscá-lo aqui dentro significaria uma consulta
 * por chip renderizado (N+1). Quem monta a lista faz uma consulta só.
 */
function ChipPaciente({ nome, ativo, onClick }: { nome: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-4 py-2 text-sm font-medium border transition-colors",
        ativo ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
      )}
    >
      {nome}
    </button>
  );
}

/** O cartão-resumo tranquilizador de um paciente acompanhado. */
const SINTOMA_ROTULO: Record<string, string> = {
  chest_pain: "Dor no peito",
  dyspnea: "Falta de ar",
  palpitations: "Palpitação",
  edema: "Inchaço",
  syncope: "Desmaio",
  presyncope: "Quase desmaiou",
  claudication: "Dor na perna ao andar",
  dry_cough: "Tosse seca",
  fatigue: "Cansaço",
  dizziness: "Tontura",
};

const EXAME_ROTULO: Record<string, string> = {
  ecg: "Eletrocardiograma",
  echocardiogram: "Ecocardiograma",
  stress_test: "Teste de esforço",
  holter: "Holter 24h",
  abpm: "MAPA 24h",
  coronary_ct: "Tomografia das coronárias",
  myocardial_spect: "Cintilografia do coração",
  cardiac_mri: "Ressonância do coração",
  catheterization: "Cateterismo",
  carotid_doppler: "Doppler das carótidas",
};

function ResumoPaciente({ vinculo }: { vinculo: CaregiverLink }) {
  const { data: patient } = useCardioPatient(vinculo.patient_user_id);
  const bp = useBloodPressure(vinculo.patient_user_id);
  const tempoNoAlvo = useTempoNoAlvo(vinculo.patient_user_id);
  const meds = useCardioMedications(vinculo.patient_user_id);
  const activity = useActivity(vinculo.patient_user_id);
  const sleep = useSleep(vinculo.patient_user_id);
  const alerts = useCardioAlerts(vinculo.patient_user_id);
  // Só busca o que a permissão libera — o hook fica desligado quando não deve
  // aparecer, para não carregar dado que a tela não pode mostrar.
  const sintomas = useSymptoms(vinculo.ver_sintomas ? vinculo.patient_user_id : undefined);
  const exames = useCardioExams(vinculo.ver_exames ? vinculo.patient_user_id : undefined);
  const labs = useLabResults(vinculo.ver_exames ? vinculo.patient_user_id : undefined);

  const nome = primeiroNome(patient?.full_name) || "essa pessoa";

  const dosesHoje = meds.dosesDeHoje;
  const dosesTomadas = dosesHoje.filter((d) => d.taken).length;

  const ultimoRegistro = [bp.ultima?.recorded_at, sleep.ultima?.recorded_at, activity.hoje?.recorded_at]
    .filter((x): x is string => !!x)
    .sort((a, b) => +new Date(b) - +new Date(a))[0];

  const alertasAbertos = alerts.alerts.filter((a) => !a.is_dismissed);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-display font-semibold text-foreground">Como está {nome}</h1>
        {ultimoRegistro && (
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Último registro {fmtDataHora(ultimoRegistro)}
          </p>
        )}
      </div>

      {/* ── Alertas abertos ─────────────────────────────────────────── */}
      {vinculo.receber_alertas && alertasAbertos.length > 0 && (
        <div className="space-y-3">
          {alertasAbertos.map((a) => (
            <div
              key={a.id}
              className={cn(
                "rounded-2xl p-4",
                a.severity === "critical" || a.severity === "emergency" ? "bg-error-bg" : "bg-warning-bg"
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className={cn(
                  "h-5 w-5 shrink-0 mt-0.5",
                  a.severity === "critical" || a.severity === "emergency" ? "text-error" : "text-warning"
                )} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{a.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pressão ──────────────────────────────────────────────────── */}
      {vinculo.ver_medidas && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <HeartPulse className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Pressão</p>
          </div>
          {bp.ultima ? (
            <>
              <p className="text-3xl font-bold text-foreground leading-none">
                {bp.ultima.systolic}/{bp.ultima.diastolic}
                <span className="text-sm font-medium text-muted-foreground"> mmHg</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                Medida {fmtDataHora(bp.ultima.recorded_at)}.{" "}
                {tempoNoAlvo.mes.percentual != null
                  ? `Nas últimas semanas, a pressão ficou no alvo em ${tempoNoAlvo.mes.percentual}% das vezes.`
                  : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ainda sem medida de pressão registrada.</p>
          )}
        </div>
      )}

      {/* ── Remédios ─────────────────────────────────────────────────── */}
      {vinculo.ver_remedios && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Remédios de hoje</p>
          </div>
          {dosesHoje.length > 0 ? (
            <>
              <p className="text-3xl font-bold text-foreground leading-none">
                {dosesTomadas}<span className="text-lg font-medium text-muted-foreground">/{dosesHoje.length}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {dosesTomadas === dosesHoje.length
                  ? "Já tomou tudo o que estava previsto para hoje."
                  : `Faltam ${dosesHoje.length - dosesTomadas} dose${dosesHoje.length - dosesTomadas > 1 ? "s" : ""} até o fim do dia.`}
                {meds.adesao?.d7 != null && ` Na última semana, tomou ${Math.round(meds.adesao.d7 * 100)}% das doses previstas.`}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem remédios cadastrados no momento.</p>
          )}
        </div>
      )}

      {/* ── Passos e sono ────────────────────────────────────────────── */}
      {vinculo.ver_medidas && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Footprints className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Passos</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {activity.hoje?.steps != null ? activity.hoje.steps.toLocaleString("pt-BR") : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {activity.hoje?.activity_date ? "hoje" : "ainda sem registro"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold text-foreground">Sono</p>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {sleep.ultima ? `${Math.round((sleep.ultima.total_minutes / 60) * 10) / 10} h` : "—"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">última noite</p>
          </div>
        </div>
      )}

      {/* ── O que a pessoa sentiu ────────────────────────────────────── */}
      {vinculo.ver_sintomas && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">O que {nome} registrou sentir</p>
          </div>
          {sintomas.symptoms.length > 0 ? (
            <ul className="space-y-2">
              {sintomas.symptoms.slice(0, 5).map((s) => (
                <li key={s.id} className="text-sm text-foreground leading-relaxed">
                  <span className="font-medium">{SINTOMA_ROTULO[s.symptom_type] ?? s.symptom_type}</span>
                  <span className="text-muted-foreground"> · {fmtDataHora(s.occurred_at)}</span>
                  {s.notes && <span className="block text-xs text-muted-foreground">{s.notes}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nada registrado nos últimos dias.</p>
          )}
        </div>
      )}

      {/* ── Exames ───────────────────────────────────────────────────── */}
      {vinculo.ver_exames && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Exames</p>
          </div>
          {exames.exams.length > 0 || labs.labs.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {exames.exams.slice(0, 3).map((e) => (
                <li key={e.id} className="text-foreground">
                  {EXAME_ROTULO[e.exam_type] ?? e.exam_type}
                  <span className="text-muted-foreground"> · {fmtDataHora(e.performed_at)}</span>
                </li>
              ))}
              {labs.labs.slice(0, 4).map((l) => (
                <li key={l.id} className="text-foreground">
                  {l.marker_label}: <span className="tabular-nums font-medium">{l.value_num ?? l.value_text}</span>
                  {l.unit ? ` ${l.unit}` : ""}
                  <span className="text-muted-foreground"> · {fmtDataHora(l.collected_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum exame registrado ainda.</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Quem interpreta esses resultados é o médico de {nome}.
          </p>
        </div>
      )}

      {!vinculo.ver_medidas && !vinculo.ver_remedios && !vinculo.ver_sintomas && !vinculo.ver_exames && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center">
          <ShieldCheck className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            {nome} ainda não liberou nenhuma informação para você ver aqui.
          </p>
        </div>
      )}
    </div>
  );
}

function EntrarComCodigo() {
  const { aceitarConvite } = useDeQuemCuido();
  const [codigo, setCodigo] = useState("");

  return (
    <div className="pt-6">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-lg font-display font-semibold text-foreground">Digite o código do convite</h1>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-xs mx-auto">
          A pessoa que você acompanha te passou um código de 6 letras. Digite abaixo para começar.
        </p>
      </div>
      <div className="max-w-xs mx-auto space-y-3">
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          placeholder="CÓDIGO"
          maxLength={6}
          className="h-14 text-center text-2xl font-bold tracking-[0.3em] font-mono"
        />
        <Button
          size="lg"
          className="w-full"
          disabled={codigo.trim().length < 4 || aceitarConvite.isPending}
          onClick={() => aceitarConvite.mutate(codigo)}
        >
          {aceitarConvite.isPending ? "Verificando..." : "Começar a acompanhar"}
        </Button>
      </div>
    </div>
  );
}

export default function CuidadorHomePage() {
  const { user, loading } = useAuth();
  const { vinculos, isLoading } = useDeQuemCuido();
  // Uma consulta para todos os chips, em vez de uma por chip.
  const nomesDePacientes = useNomesDePacientes(vinculos.map((v) => v.patient_user_id));
  const [selecionado, setSelecionado] = useState<string | null>(null);

  useEffect(() => {
    if (vinculos.length > 0 && (!selecionado || !vinculos.some((v) => v.patient_user_id === selecionado))) {
      setSelecionado(vinculos[0].patient_user_id);
    }
  }, [vinculos, selecionado]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Cabecalho mostrarSair={false} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Cabecalho mostrarSair={false} />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 grid place-items-center mb-5">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-display font-semibold text-foreground max-w-sm">
            Aqui é a área de quem acompanha a saúde de alguém pelo Encorpei Cardio
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-sm leading-relaxed">
            Entre ou crie sua conta para usar o código que a pessoa que você cuida te enviou.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth">
              Entrar ou criar conta <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const vinculoAtivo = vinculos.find((v) => v.patient_user_id === selecionado) ?? vinculos[0] ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Cabecalho mostrarSair />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 pb-10">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-40 bg-secondary rounded" />
            <div className="h-24 bg-secondary rounded-2xl" />
            <div className="h-24 bg-secondary rounded-2xl" />
          </div>
        ) : vinculos.length === 0 ? (
          <EntrarComCodigo />
        ) : (
          <>
            {vinculos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 px-1">
                {vinculos.map((v) => (
                  <ChipPaciente
                    key={v.id}
                    nome={primeiroNome(nomesDePacientes[v.patient_user_id]) || v.caregiver_nome}
                    ativo={v.patient_user_id === vinculoAtivo?.patient_user_id}
                    onClick={() => setSelecionado(v.patient_user_id)}
                  />
                ))}
              </div>
            )}
            {vinculoAtivo && <ResumoPaciente vinculo={vinculoAtivo} />}
          </>
        )}
        <AvisoLimites />
      </main>
    </div>
  );
}
