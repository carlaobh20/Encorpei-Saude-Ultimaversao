/**
 * HojePage — a home do paciente.
 *
 * ── O que a auditoria de setembro/2026 fixou aqui (e continua valendo) ─
 *
 * 1) DUAS LISTAS DE PENDÊNCIA VIRARAM UMA. A tela tinha "O combinado de
 *    hoje" (vindo do plano de monitoramento, que é o que o médico prescreve)
 *    e, logo abaixo, "O que falta hoje" — uma segunda lista montada por
 *    regras escritas à mão nesta página. Duas listas de dever, com critérios
 *    diferentes, sobre o mesmo dia. Toda pendência sai de
 *    `usePendenciasDeHoje()`; quando não há prescrição, o plano mínimo entra
 *    e a tela DIZ que é sugestão do app.
 *
 * 2) A IDADE DO CORAÇÃO SAIU DO TOPO. O número dominava cada visita e não
 *    tinha ação possível atrás dele — só ansiedade. Mora em /meu-coracao,
 *    com a explicação ao lado do número. Ele não volta para cá.
 *
 * ── O que esta reformulação (visual) mudou ────────────────────────────
 *
 * A página era uma coluna só, empilhada, projetada para o celular e esticada
 * no desktop: num monitor de 1440px sobrava metade da tela em branco enquanto
 * o paciente rolava para achar a consulta. Agora há duas colunas
 * (`LayoutPainel`): à esquerda o fluxo do dia — saudação, aviso, cuidado de
 * hoje, registros, evolução —, à direita o contexto que se consulta e não se
 * executa — pulseira, equipe, atalhos. No celular a mesma ordem vira uma
 * coluna e rola; NÃO tentamos caber tudo na primeira tela, porque o preço
 * disso seria encolher texto que já é o piso legível para 68 anos.
 *
 * O que NÃO mudou: nenhuma regra clínica, nenhum limiar, nenhum cálculo.
 * Todo dado desta tela sai dos hooks como eles já o devolvem, e onde falta
 * dado a tela mostra ausência — nunca zero, nunca estimativa disfarçada.
 *
 * Nada aqui prescreve conduta (docs/CONTRATO-DE-CODIGO.md, regra 1) e nada
 * interpreta número ("normal", "ótimo", "tudo certo" não existem na página).
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle, Award, ChevronRight, ClipboardList, FileText,
  FlaskConical, GraduationCap, Pill, Stethoscope, Target,
} from "lucide-react";
import {
  usePendenciasDeHoje, type MetricaPlano, type Pendencia,
} from "@/hooks/usePlanoMonitoramento";
import { PageHeader } from "@/components/shell/PageHeader";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { AppModal } from "@/components/shell/AppModal";
import { Atalho, LayoutPainel, Painel } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { RegistroRapido } from "@/components/registro/RegistroRapido";
import { CuidadoDeHoje } from "@/components/hoje/CuidadoDeHoje";
import { UltimosRegistros } from "@/components/hoje/UltimosRegistros";
import { MinhaEvolucao } from "@/components/hoje/MinhaEvolucao";
import { PainelPulseira } from "@/components/hoje/PainelPulseira";
import { PainelEquipe } from "@/components/hoje/PainelEquipe";
import { useProfile } from "@/hooks/useProfile";
import { useBloodPressure } from "@/hooks/useCardioReadings";
import { useCardioAlerts, useRiskAssessment } from "@/hooks/useCardioClinical";
import {
  useTempoNoAlvo, useConquistas, useAprender,
  useQualidadeDeVida, PERGUNTAS_QOL, OPCOES_QOL,
} from "@/hooks/useEngajamento";
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

/**
 * ── O aviso que não levava a lugar nenhum (auditoria de desktop) ──────
 *
 * "Pressão alta repetida — 3+ medidas acima do alvo em 7 dias" era um
 * `<section>`: não era link, não era botão, não tinha para onde ir. O
 * paciente lê "pressão alta", não tem onde clicar e não sabe o que fazer —
 * e o aviso, que existe justamente para provocar uma ação, vira só susto.
 *
 * Todo aviso passa a levar AO DADO QUE O GEROU: a tela da métrica. O mapa
 * abaixo é de navegação, não de clínica — ele não decide quando o alerta
 * dispara, o que ele significa nem o que fazer a respeito; só responde
 * "onde eu vejo isso". Cobre as duas nomenclaturas que convivem no sistema
 * (o `rule_code` do banco, em inglês, e o do motor do cliente, em
 * português — ver src/lib/clinical/cardioAlertRules.ts).
 *
 * Código desconhecido cai em /meu-coracao, que é a visão geral dos números:
 * destino genérico e honesto é melhor que beco sem saída, e muito melhor
 * que um destino específico errado.
 */
const ROTA_DO_ALERTA: Record<string, string> = {
  // Pressão e coração
  bp_crisis: "/pressao", bp_hypotension: "/pressao", bp_above_target: "/pressao",
  pa_crise: "/pressao", pa_baixa: "/pressao", pa_alta_sustentada: "/pressao",
  hr_bradycardia: "/pressao", hr_tachycardia: "/pressao", hr_above_target: "/pressao",
  hr_irregular: "/pressao", fc_bradi: "/pressao", fc_taqui_repouso: "/pressao",
  ritmo_irregular: "/pressao",
  // Oxigenação: a dessaturação que o app acompanha é a do sono.
  spo2_low: "/sono", spo2_borderline: "/sono", spo2_baixa: "/sono", spo2_noturna: "/sono",
  // Peso
  weight_gain_3d: "/peso", weight_loss: "/peso", peso_ic_dia: "/peso",
  // Operacionais
  adherence_low: "/remedios", adesao_baixa: "/remedios",
  no_data: "/meu-coracao", sem_dados: "/meu-coracao",
};

/** Onde se vê o dado que gerou este aviso. */
function rotaDoAlerta(ruleCode?: string | null): string {
  if (!ruleCode) return "/meu-coracao";
  if (ROTA_DO_ALERTA[ruleCode]) return ROTA_DO_ALERTA[ruleCode];
  // Sintoma relatado: o dado que gerou o aviso é o próprio relato.
  if (ruleCode.startsWith("symptom_")) return "/sintomas";
  return "/meu-coracao";
}

/**
 * O aviso manda falar com o médico? Então o caminho para o médico aparece.
 *
 * A leitura é do TEXTO, não de uma nova regra: o que decide se é caso de
 * procurar a equipe continua sendo a frase que o motor clínico escreveu.
 * Aqui só se pergunta se ela já disse isso — para então oferecer a porta.
 */
function mandaFalarComMedico(...textos: (string | null | undefined)[]): boolean {
  return textos.some((t) => t && /m[ée]dic[oa]|equipe|consult/i.test(t));
}

function primeiroNome(nome?: string | null): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0];
}

/**
 * Saudação pela hora do aparelho. É a única personalização barata que a tela
 * tem: dizer "bom dia" às 22h é o tipo de detalhe que faz o app parecer um
 * formulário e não alguém falando com você.
 */
function saudacao(agora = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
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
  const alerts = useCardioAlerts();
  const { risk } = useRiskAssessment();

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

  // ── Aviso prioritário ──────────────────────────────────────────────
  // Um aviso, no máximo, e ANTES do cartão azul: um alerta clínico que
  // aparecesse depois do "cuidado de hoje" seria lido depois da ação — e a
  // ação pode ser justamente a errada para quem está com sintoma. A
  // referência de design mostra a tela sem aviso; isso é o ESTADO FELIZ
  // dela, não permissão para esconder o aviso quando ele existe.
  const alertaAberto = alerts.alerts.filter((a) => !a.is_dismissed)[0] ?? null;
  const sinalDeAtencao = !alertaAberto && risk.level !== "green" ? risk.headline : null;
  const avisoGrave =
    alertaAberto?.severity === "critical" || alertaAberto?.severity === "emergency";

  // ── O cuidado de hoje ──────────────────────────────────────────────
  const abertasOrdenadas: Pendencia[] = [...plano.abertas].sort(
    (a, b) => PESO_DA_METRICA[a.metric] - PESO_DA_METRICA[b.metric]
  );
  const prioritaria = abertasOrdenadas[0] ?? null;
  const demaisAbertas = abertasOrdenadas.slice(1);
  // Marcador de check SÓ para o que foi realmente registrado hoje.
  // `usePendenciasDeHoje()` marca item de frequência semanal/mensal como
  // `concluido: true` no dia — de propósito, para não cobrar dívida falsa na
  // tela. Só que "não é cobrado hoje" e "você fez isso hoje" são coisas
  // diferentes, e um check ao lado de "Sono" que ninguém registrou seria a
  // tela afirmando algo falso sobre o paciente. O filtro por `feitos > 0`
  // resolve isso na exibição, sem tocar na regra do hook.
  const concluidas = plano.pendencias.filter((p) => p.concluido && p.feitos > 0);

  function resolver(metric: MetricaPlano) {
    const acao = ACAO_DA_METRICA[metric];
    if (acao.rota) navigate(acao.rota);
    else setRegistroAberto(true);
  }

  // "Só quando há algo novo": lição só entra se houver lição não lida.
  const proximaLicao = aprender.proxima;
  const melhorConquista = conquistas[0] ?? null;

  return (
    <div className="pb-4">
      <LayoutPainel
        principal={
          <>
            {/* ── 1. Saudação ─────────────────────────────────────── */}
            <PageHeader
              title={nome ? `${saudacao()}, ${nome}` : saudacao()}
              subtitle={frase}
            />

            {/* ── 2. Aviso prioritário, só quando existe ───────────── */}
            {alertaAberto && (
              <section
                className={cn(
                  "rounded-2xl p-4 md:p-5 border-l-4",
                  avisoGrave
                    ? "bg-error-bg border-error"
                    : "bg-warning-bg border-warning"
                )}
                aria-label="Aviso sobre a sua saúde"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    className={cn("h-6 w-6 shrink-0 mt-0.5", avisoGrave ? "text-error" : "text-warning-forte")}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-foreground leading-snug">{alertaAberto.title}</p>
                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">
                      {alertaAberto.description}
                    </p>

                    {/* As saídas do aviso. A primeira é sempre o dado que o
                        gerou — é ali que o paciente vê de onde saiu a frase.
                        A segunda só aparece quando o próprio texto do alerta
                        mandou procurar a equipe. Links de verdade: funcionam
                        no teclado, no leitor de tela e no clique do meio. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to={rotaDoAlerta(alertaAberto.rule_code)}
                        className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-border bg-card px-3.5 text-base font-medium text-cardio-dark hover:bg-cardio-50"
                      >
                        Ver o que gerou este aviso
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      </Link>
                      {mandaFalarComMedico(alertaAberto.title, alertaAberto.description) && (
                        <Link
                          to="/medico"
                          className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-border bg-card px-3.5 text-base font-medium text-cardio-dark hover:bg-cardio-50"
                        >
                          <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
                          Falar com meu médico
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!alertaAberto && sinalDeAtencao && (
              <section
                className="rounded-2xl p-4 md:p-5 bg-warning-bg border-l-4 border-warning"
                aria-label="Sinal que precisa de atenção"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5 text-warning-forte" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-base text-foreground leading-relaxed">{sinalDeAtencao}</p>
                    {/* Mesmo princípio do bloco acima: o sinal de risco vem da
                        avaliação geral, então o destino é a tela que reúne os
                        números dela. Nenhum aviso desta página termina sem
                        um lugar para ir. */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        to="/meu-coracao"
                        className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-border bg-card px-3.5 text-base font-medium text-cardio-dark hover:bg-cardio-50"
                      >
                        Ver os números por trás disto
                        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                      </Link>
                      {mandaFalarComMedico(sinalDeAtencao) && (
                        <Link
                          to="/medico"
                          className="inline-flex items-center gap-1.5 min-h-[44px] rounded-xl border border-border bg-card px-3.5 text-base font-medium text-cardio-dark hover:bg-cardio-50"
                        >
                          <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
                          Falar com meu médico
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ── 3. O único bloco azul da página ──────────────────── */}
            <CuidadoDeHoje
              prescrito={plano.prescrito}
              total={plano.total}
              concluidasCount={plano.concluidas}
              prioritaria={prioritaria}
              demaisAbertas={demaisAbertas}
              concluidas={concluidas}
              rotuloAcao={prioritaria ? ACAO_DA_METRICA[prioritaria.metric].botao : ""}
              onResolver={resolver}
            />

            {/* ── 4. Seus últimos registros ────────────────────────── */}
            <UltimosRegistros />

            {/* ── 5. Minha evolução ────────────────────────────────── */}
            <MinhaEvolucao />

            {/* ── 6. Aprender e Meu mês, em peso menor ─────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
              <Painel titulo="Aprender a cuidar">
                {proximaLicao ? (
                  <Link to="/aprender" className="flex items-start gap-3 -mx-1 px-1 py-1 rounded-xl">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <GraduationCap className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium uppercase tracking-wide text-primary">
                        {proximaLicao.origem}
                      </span>
                      <span className="block text-base font-semibold text-foreground mt-0.5 leading-snug">
                        {proximaLicao.titulo}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                  </Link>
                ) : (
                  <div>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      Você já leu as lições sugeridas para o seu caso.
                    </p>
                    <Link to="/aprender" className="inline-block text-base font-medium text-primary mt-2 rounded-lg">
                      Rever as lições
                    </Link>
                  </div>
                )}
              </Painel>

              <Painel titulo="Meu mês">
                {melhorConquista ? (
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                      <Award className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base text-foreground leading-relaxed">{melhorConquista.texto}</p>
                      <Link to="/meu-mes" className="inline-block text-base font-medium text-primary mt-2 rounded-lg">
                        Ver o resumo do mês
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-base text-muted-foreground leading-relaxed">
                        O resumo que você leva para a consulta se monta sozinho com o que
                        você registra.
                      </p>
                      <Link to="/meu-mes" className="inline-block text-base font-medium text-primary mt-2 rounded-lg">
                        Ver o resumo do mês
                      </Link>
                    </div>
                  </div>
                )}
              </Painel>
            </div>

            {/* O questionário mensal fica no fim, discreto, e some no resto
                do mês: ele não é o motivo de abrir o app hoje. */}
            {qol.devePerguntar && (
              <button
                type="button"
                onClick={() => setQolAberto(true)}
                className="w-full text-left rounded-2xl border border-dashed border-border bg-card/50 p-4 md:p-5
                           flex items-center gap-3"
              >
                <ClipboardList className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="block text-base font-medium text-foreground">
                    Como você tem passado nas últimas semanas?
                  </span>
                  <span className="block text-sm text-muted-foreground mt-0.5">
                    7 perguntas rápidas, uma vez por mês
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden="true" />
              </button>
            )}
          </>
        }
        apoio={
          <>
            {/* ── Coluna de apoio: contexto que se consulta ────────── */}
            <PainelPulseira />
            <PainelEquipe />

            {/*
              Acesso rápido — quatro destinos, e SÓ estes quatro. Eles não se
              repetem em nenhum outro ponto da página: atalho duplicado ensina
              que a página tem dois lugares para a mesma coisa, e o paciente
              passa a procurar nos dois.
            */}
            <Painel titulo="Acesso rápido">
              {/* Uma coluna a partir de 1280px: é onde a grade passa a morar na
                  coluna de apoio estreita, e duas colunas ali cortavam
                  "Sintomas" e "Remédios" pela metade. */}
              <div className="grid grid-cols-2 xl:grid-cols-1 gap-2">
                <Atalho icone={Stethoscope} rotulo="Sintomas" para="/sintomas" />
                <Atalho icone={FlaskConical} rotulo="Exames" para="/exames" />
                <Atalho icone={Pill} rotulo="Remédios" para="/remedios" />
                <Atalho icone={Target} rotulo="Metas" para="/metas" />
              </div>
            </Painel>
          </>
        }
      />

      <DialogoQualidadeDeVida
        open={qolAberto}
        onOpenChange={setQolAberto}
        onConcluir={(respostas) => {
          qol.responder.mutate(respostas);
          setQolAberto(false);
        }}
      />

      {/* A folha de registro é a mesma do botão central da barra. Abrir daqui
          evita a troca de tela quando a tarefa prioritária cabe num campo. O
          botão "Não estou bem" NÃO se repete nesta página: ele já flutua em
          toda tela pela casca do app (AppShell) — ter os dois era a
          duplicação apontada na auditoria §6. */}
      <RegistroRapido aberto={registroAberto} onFechar={() => setRegistroAberto(false)} />
    </div>
  );
}
