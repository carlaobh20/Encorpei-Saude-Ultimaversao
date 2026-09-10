/**
 * HojePage — a home do paciente.
 *
 * ── O que a auditoria de setembro/2026 mudou aqui ─────────────────────
 *
 * 1) DUAS LISTAS DE PENDÊNCIA VIRARAM UMA. A tela tinha "O combinado de
 *    hoje" (vindo do plano de monitoramento, que é o que o médico prescreve)
 *    e, logo abaixo, "O que falta hoje" — uma segunda lista montada por
 *    regras escritas à mão nesta página (`if (temIC && !pesoHoje)`,
 *    `if (!pressaoHoje)`, `if (!sodioHoje)`). Duas listas de dever, com
 *    critérios diferentes, sobre o mesmo dia. Além de confundir, a segunda
 *    cobrava coisa que o médico não pediu — o oposto do que o app promete.
 *    Agora TODA pendência sai de `usePendenciasDeHoje()`. Quando não há
 *    prescrição, o plano mínimo entra e a tela DIZ que é sugestão do app.
 *
 * 2) A IDADE DO CORAÇÃO SAIU DO TOPO. O número (80, no caso típico) dominava
 *    cada visita, era a primeira coisa que o paciente lia todo dia, e não
 *    tinha ação possível atrás dele — só ansiedade. Ele virou um cartão
 *    dentro da evolução, em /meu-coracao, com a explicação ao lado do número.
 *    O topo passou a ser: o que dá para fazer agora, e o que já melhorou.
 *
 * 3) A ABERTURA TEM SEIS BLOCOS, NESTA ORDEM: saudação · aviso (só se
 *    existir) · tarefa prioritária com botão · último registro com data e
 *    origem · resumo da evolução · próxima consulta. Educação, conquista e
 *    questionário desceram para o fim e só aparecem quando há algo novo.
 *
 * Nada aqui prescreve conduta (docs/CONTRATO-DE-CODIGO.md, regra 1) e nada
 * promete "rejuvenescer o coração": o que a tela mostra é ação possível e
 * progresso observado.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, CalendarClock, ChevronRight, CheckCircle2, Gauge,
  Award, GraduationCap, ClipboardList, Clock3,
} from "lucide-react";
import {
  usePendenciasDeHoje, ROTULO_METRICA, type MetricaPlano, type Pendencia,
} from "@/hooks/usePlanoMonitoramento";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { AppModal } from "@/components/shell/AppModal";
import { Button } from "@/components/ui/button";
import { RegistroRapido } from "@/components/registro/RegistroRapido";
import { useProfile } from "@/hooks/useProfile";
import { useBloodPressure, useHeartRate, useWeight } from "@/hooks/useCardioReadings";
import { useCardioAlerts, useRiskAssessment } from "@/hooks/useCardioClinical";
import { useAppointments } from "@/hooks/useProfessional";
import {
  useTempoNoAlvo, useConquistas, useAprender,
  useQualidadeDeVida, PERGUNTAS_QOL, OPCOES_QOL,
} from "@/hooks/useEngajamento";
import {
  MINIMO_DE_MEDIDAS, ROTULO_MEDIDAS_NA_META, rotuloPeriodo,
} from "@/lib/clinical/timeInRange";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
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

/**
 * Como se resolve cada pendência do plano.
 *
 * Métrica que cabe em um campo abre a folha de registro rápido AQUI mesmo —
 * trocar de tela para digitar dois números é o pedágio que faz o paciente
 * desistir. Métrica que precisa de contexto (qual remédio, qual sintoma,
 * quanto tempo de caminhada) leva para a tela que sabe perguntar isso.
 */
const ACAO_DA_METRICA: Record<MetricaPlano, { botao: string; rota?: string }> = {
  bp:         { botao: "Medir a pressão" },
  weight:     { botao: "Registrar o peso" },
  hr:         { botao: "Registrar os batimentos" },
  spo2:       { botao: "Registrar a oxigenação" },
  glucose:    { botao: "Registrar a glicemia" },
  wellbeing:  { botao: "Dizer como estou" },
  medication: { botao: "Marcar os remédios", rota: "/remedios" },
  symptoms:   { botao: "Registrar sintoma",  rota: "/sintomas" },
  walk:       { botao: "Registrar caminhada", rota: "/caminhada" },
  sodium:     { botao: "Registrar refeição",  rota: "/alimentacao" },
  sleep:      { botao: "Registrar o sono",    rota: "/sono" },
  steps:      { botao: "Ver minha atividade", rota: "/atividade" },
};

/**
 * Prioridade quando há mais de uma pendência aberta.
 *
 * Ordem por consequência clínica de deixar passar: remédio esquecido é o que
 * mais muda desfecho; pressão é a medida que sustenta todo o resto do
 * acompanhamento; peso é vigilância de descompensação em insuficiência
 * cardíaca. O restante segue depois. Quem define O QUE é cobrado continua
 * sendo o plano do médico — isto aqui só decide quem fala primeiro.
 */
const PESO_DA_METRICA: Record<MetricaPlano, number> = {
  medication: 0, bp: 1, weight: 2, wellbeing: 3, symptoms: 4, spo2: 5,
  glucose: 6, walk: 7, sodium: 8, sleep: 9, hr: 10, steps: 11,
};

function primeiroNome(nome?: string | null): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0];
}

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" }) + " às " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
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
      {/* `leitura-paciente` também aqui: o modal é renderizado num portal,
          fora da casca do app, e sem a classe ele voltaria à escala menor. */}
      <div className="leitura-paciente py-2 space-y-5">
        <p className="text-base text-muted-foreground leading-relaxed">
          Sete perguntas rápidas sobre as últimas duas semanas. Seu médico vai ver as respostas.
        </p>
        {PERGUNTAS_QOL.map((p) => (
          <div key={p.chave}>
            <p className="text-base font-medium text-foreground mb-2 leading-relaxed">{p.texto}</p>
            <div className="grid grid-cols-1 gap-2">
              {OPCOES_QOL.map((o) => (
                <button
                  key={o.valor}
                  type="button"
                  aria-pressed={respostas[p.chave] === o.valor}
                  onClick={() => setRespostas((r) => ({ ...r, [p.chave]: o.valor }))}
                  className={cn(
                    "text-left rounded-xl border px-4 py-3 min-h-[48px] text-base transition-colors",
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
          className="w-full h-12 text-base"
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

  const bp = useBloodPressure();
  const hr = useHeartRate();
  const weight = useWeight();
  const alerts = useCardioAlerts();
  const { risk } = useRiskAssessment();
  const appointments = useAppointments();

  const tempoNoAlvo = useTempoNoAlvo();
  const conquistas = useConquistas();
  const aprender = useAprender();
  const qol = useQualidadeDeVida();

  // A ÚNICA fonte de pendência da tela. Não existe mais lista paralela.
  const plano = usePendenciasDeHoje();

  const [qolAberto, setQolAberto] = useState(false);
  const [registroAberto, setRegistroAberto] = useState(false);

  const nome = primeiroNome(profile?.full_name);
  const frase = FRASES_DO_DIA[new Date().getDay() % FRASES_DO_DIA.length];

  const isLoading = loadingProfile || bp.isLoading || plano.isLoading || tempoNoAlvo.isLoading;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Hoje" />
        <TabPageSkeleton />
      </div>
    );
  }

  // ── (b) o aviso ────────────────────────────────────────────────────
  // Um aviso, no máximo. Alerta aberto do motor clínico vem primeiro; na
  // falta dele, um sinal que o motor de risco marcou como amarelo/vermelho.
  // Se não há nem um nem outro, este bloco simplesmente não existe — tela
  // sem aviso é informação, não é espaço vazio.
  const alertaAberto = alerts.alerts.filter((a) => !a.is_dismissed)[0] ?? null;
  const sinalDeAtencao = !alertaAberto && risk.level !== "green" ? risk.headline : null;

  // ── (c) a tarefa prioritária ───────────────────────────────────────
  const abertasOrdenadas: Pendencia[] = [...plano.abertas].sort(
    (a, b) => PESO_DA_METRICA[a.metric] - PESO_DA_METRICA[b.metric]
  );
  const prioritaria = abertasOrdenadas[0] ?? null;
  const demaisAbertas = abertasOrdenadas.slice(1);

  function resolver(metric: MetricaPlano) {
    const acao = ACAO_DA_METRICA[metric];
    if (acao.rota) navigate(acao.rota);
    else setRegistroAberto(true);
  }

  // ── (d) o último registro ──────────────────────────────────────────
  // Data E origem juntas, sempre. Sem a origem o paciente (e depois o
  // médico) não sabe se aquele número saiu do aparelho de braço ou é
  // estimativa da pulseira — e os dois não valem a mesma coisa
  // (docs/CONTRATO-DE-CODIGO.md, regra 2).
  const candidatos = [
    bp.ultima ? { r: bp.ultima, texto: `${bp.ultima.systolic}/${bp.ultima.diastolic}`, oque: "Pressão" } : null,
    weight.ultimo ? { r: weight.ultimo, texto: `${weight.ultimo.value} kg`, oque: "Peso" } : null,
    hr.ultima ? { r: hr.ultima, texto: `${hr.ultima.bpm} bpm`, oque: "Batimentos" } : null,
  ].filter(Boolean) as { r: { recorded_at: string; source_type: string; validation_status: string; source_device_name?: string | null }; texto: string; oque: string }[];

  const ultimoRegistro = candidatos.sort(
    (a, b) => +new Date(b.r.recorded_at) - +new Date(a.r.recorded_at)
  )[0] ?? null;
  const origem = ultimoRegistro
    ? rotuloProveniencia(ultimoRegistro.r.source_type, ultimoRegistro.r.validation_status, ultimoRegistro.r.source_device_name)
    : null;

  // ── (e) o resumo da evolução ───────────────────────────────────────
  const meta = tempoNoAlvo.mes;

  // ── (f) e o fim da página ──────────────────────────────────────────
  const proxima = appointments.proxima;
  // "Só quando há algo novo": lição só entra se houver lição não lida.
  // `aprender.naoLidas` é a LISTA de lições ainda não lidas — `proxima` já é
  // a primeira delas, então basta ela: se não há lição nova, não há bloco.
  const proximaLicao = aprender.proxima;
  const melhorConquista = conquistas[0] ?? null;

  return (
    <div>
      {/* ── (a) saudação ─────────────────────────────────────────── */}
      <PageHeader title={nome ? `Olá, ${nome}` : "Hoje"} subtitle={frase} />

      {/* ── (b) aviso, só se existir ─────────────────────────────── */}
      {alertaAberto && (
        <SurfaceCard
          className={cn(
            "mb-5 border-0",
            alertaAberto.severity === "critical" || alertaAberto.severity === "emergency"
              ? "bg-error-bg"
              : "bg-warning-bg"
          )}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className={cn(
                "h-6 w-6 shrink-0 mt-0.5",
                alertaAberto.severity === "critical" || alertaAberto.severity === "emergency"
                  ? "text-error"
                  : "text-warning-forte"
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">{alertaAberto.title}</p>
              <p className="text-base text-muted-foreground mt-1 leading-relaxed">{alertaAberto.description}</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {!alertaAberto && sinalDeAtencao && (
        <SurfaceCard className="mb-5 bg-warning-bg border-0">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-warning-forte" aria-hidden="true" />
            <p className="text-base text-foreground leading-relaxed">{sinalDeAtencao}</p>
          </div>
        </SurfaceCard>
      )}

      {/* ── (c) a tarefa prioritária do plano ────────────────────── */}
      <div className="mb-6">
        <SectionHeader
          title="O combinado de hoje"
          subtitle={plano.total > 0 ? `${plano.concluidas} de ${plano.total}` : undefined}
        />

        {prioritaria ? (
          <SurfaceCard>
            <p className="text-lg font-semibold text-foreground leading-snug">
              {ROTULO_METRICA[prioritaria.metric]}
              {prioritaria.esperados > 1 ? ` — ${prioritaria.feitos} de ${prioritaria.esperados} hoje` : ""}
            </p>
            {prioritaria.instrucao && (
              <p className="text-base text-muted-foreground mt-1 leading-relaxed">{prioritaria.instrucao}</p>
            )}
            <Button
              size="lg"
              className="w-full mt-4 h-12 text-base"
              onClick={() => resolver(prioritaria.metric)}
            >
              {ACAO_DA_METRICA[prioritaria.metric].botao}
            </Button>

            {/* O resto do combinado fica visível, mas sem competir com o
                botão. É a mesma lista — só que uma coisa de cada vez. */}
            {demaisAbertas.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Também combinado para hoje:</p>
                <ul className="flex flex-wrap gap-2">
                  {demaisAbertas.map((p) => (
                    <li key={p.metric}>
                      <button
                        type="button"
                        onClick={() => resolver(p.metric)}
                        className="rounded-full bg-primary/10 text-primary text-sm font-medium px-4 py-2 min-h-[44px]"
                      >
                        {ROTULO_METRICA[p.metric]}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
              {plano.prescrito
                ? "Este é o plano que seu médico definiu."
                : "Sugestão do app — seu médico ainda não definiu um plano para você."}
            </p>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="bg-success-bg border-0 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-success shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">
                {plano.total > 0 ? "Tudo registrado por hoje. Até amanhã." : "Nada combinado para hoje."}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {plano.prescrito
                  ? "Este é o plano que seu médico definiu."
                  : "Sugestão do app — seu médico ainda não definiu um plano para você."}
              </p>
            </div>
          </SurfaceCard>
        )}
      </div>

      {/* ── (d) último registro, com data e origem ───────────────── */}
      <div className="mb-6">
        <SectionHeader title="Seu último registro" />
        {ultimoRegistro && origem ? (
          <SurfaceCard>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="text-base font-medium text-muted-foreground">{ultimoRegistro.oque}</p>
              <p className="text-3xl font-display font-bold text-foreground tabular-nums">{ultimoRegistro.texto}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {fmtDataHora(ultimoRegistro.r.recorded_at)}
            </p>
            <p className={cn("text-sm mt-1", origem.tone === "warning" ? "text-warning-forte font-medium" : "text-muted-foreground")}>
              Origem: {origem.label}
              {origem.tone === "warning" ? " — estimativa, não usar para decisão clínica." : ""}
            </p>
          </SurfaceCard>
        ) : (
          <EmptyState
            icon={Gauge}
            title="Nenhum registro ainda"
            description="Toque em Registrar, no meio da barra de baixo, para começar."
            variant="card"
          />
        )}
      </div>

      {/* ── (e) resumo curto da evolução ─────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Como está indo" />
        <SurfaceCard
          className="text-left w-full"
          onClick={() => navigate("/meu-coracao")}
          ariaLabel="Ver minha evolução completa"
        >
          <p className="text-base font-semibold text-foreground">{ROTULO_MEDIDAS_NA_META}</p>
          {meta.suficiente && meta.percentual != null ? (
            <>
              <p className="text-4xl font-display font-bold text-foreground leading-none mt-2 tabular-nums">
                {meta.percentual}%
              </p>
              {/* Percentual nunca aparece sozinho: n= e período andam junto,
                  senão o número vira opinião. */}
              <p className="text-sm text-muted-foreground mt-2">
                {meta.dentro} de {meta.total} medidas (n={meta.total}) · {rotuloPeriodo(meta.dias)}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-foreground mt-2">Medidas insuficientes</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {meta.total === 0
                  ? `Nenhuma medida com aparelho de braço ${rotuloPeriodo(meta.dias)}.`
                  : `${meta.total} medida${meta.total > 1 ? "s" : ""} (n=${meta.total}) ${rotuloPeriodo(meta.dias)} — o app mostra o percentual a partir de ${MINIMO_DE_MEDIDAS}.`}
              </p>
            </>
          )}
          <p className="text-base font-medium text-primary mt-3 inline-flex items-center gap-1">
            Ver minha evolução <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </p>
        </SurfaceCard>
      </div>

      {/* ── (f) próxima consulta ─────────────────────────────────── */}
      <div className="mb-8">
        <SectionHeader title="Próxima consulta" />
        {proxima ? (
          <SurfaceCard
            className="w-full text-left flex items-center justify-between gap-3"
            onClick={() => navigate("/agenda")}
            ariaLabel="Ver minhas consultas"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                <CalendarClock className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{fmtDataHora(proxima.scheduled_at)}</p>
                <p className="text-sm text-muted-foreground truncate">{proxima.location ?? "Local a confirmar"}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
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

      {/*
        ── Rodapé discreto ────────────────────────────────────────────
        Educação, conquista e questionário são bons — mas não são o motivo
        de abrir o app hoje. Ficam no fim, em tom baixo, e só aparecem
        quando têm novidade: lição não lida, alguma conquista acumulada, ou
        o mês em que o questionário é devido. Numa tela sem nada novo, esta
        seção inteira desaparece.
      */}
      {(proximaLicao || melhorConquista || qol.devePerguntar) && (
        <div className="space-y-3 border-t border-border pt-6">
          {proximaLicao && (
            <SurfaceCard
              className="w-full text-left"
              onClick={() => navigate("/aprender")}
              ariaLabel={`Aprender: ${proximaLicao.titulo}`}
            >
              <div className="flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-primary">{proximaLicao.origem}</p>
                  <p className="text-base font-semibold text-foreground mt-0.5">{proximaLicao.titulo}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
              </div>
            </SurfaceCard>
          )}

          {melhorConquista && (
            <SurfaceCard className="bg-surface-warm border-0">
              <div className="flex items-start gap-3">
                <Award className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-base text-foreground leading-relaxed">{melhorConquista.texto}</p>
              </div>
            </SurfaceCard>
          )}

          {qol.devePerguntar && (
            <SurfaceCard
              className="w-full text-left border-dashed"
              onClick={() => setQolAberto(true)}
              ariaLabel="Responder o questionário do mês"
            >
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-foreground">Como você tem passado nas últimas semanas?</p>
                  <p className="text-sm text-muted-foreground mt-0.5">7 perguntas rápidas, uma vez por mês</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
              </div>
            </SurfaceCard>
          )}
        </div>
      )}

      <DialogoQualidadeDeVida
        open={qolAberto}
        onOpenChange={setQolAberto}
        onConcluir={(respostas) => {
          qol.responder.mutate(respostas);
          setQolAberto(false);
        }}
      />

      {/* A folha de registro é a mesma do botão central da barra. Abrir a
          daqui evita a troca de tela quando a tarefa prioritária cabe num
          campo. O botão "Não estou bem" NÃO se repete nesta página: ele já
          flutua em toda tela pela casca do app (AppShell) — ter os dois era
          a duplicação apontada na auditoria §6. */}
      <RegistroRapido aberto={registroAberto} onFechar={() => setRegistroAberto(false)} />
    </div>
  );
}
