/**
 * ExamesPage — resultados de laboratório e exames do coração.
 *
 * Laboratório agrupado por bloco clínico, evolução do LDL contra a meta, e
 * exames de imagem/gráficos em linha do tempo com campos traduzidos.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhuma faixa de referência, nenhum rótulo de status, nenhuma tradução de
 * campo. O que mudou:
 *
 *  · Os valores de laboratório saíram de 13/14px para o corpo legível. Um
 *    resultado de exame que o paciente precisa ler em voz alta na consulta
 *    não pode ser o menor texto da tela.
 *
 *  · O gráfico do LDL passou às peças comuns: eixo com unidade (mg/dL), tick
 *    de 13px, linha de meta tracejada COM legenda escrita — antes a linha
 *    pontilhada aparecia sem nada dizendo o que era, e "a linha de baixo" não
 *    é explicação.
 *
 *  · "Anexar resultado" continua azul e continua sendo a ação da tela; é o
 *    único botão cheio aqui.
 */
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  FlaskConical, HeartPulse, Paperclip, FileText,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, AreaGrafico, LegendaGrafico, usePrefereMenosMovimento,
  gradeGrafico, eixoX, eixoY, dicaGrafico, COR_SERIE, COR_REFERENCIA,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDevBypass } from "@/contexts/DevBypass";
import { useLabResults, useCardioExams } from "@/hooks/useCardioClinical";
import { useTargets } from "@/hooks/useCardioPatient";
import { numero } from "@/lib/formato";
import type { LabMarkerKey } from "@/types/cardio";

const BLOCOS: { titulo: string; marcadores: LabMarkerKey[] }[] = [
  { titulo: "Colesterol e gordura no sangue", marcadores: ["total_cholesterol", "ldl", "hdl", "triglycerides", "non_hdl", "apob", "lpa"] },
  { titulo: "Açúcar no sangue", marcadores: ["glucose", "hba1c"] },
  { titulo: "Rim e eletrólitos", marcadores: ["creatinine", "egfr", "urea", "sodium", "potassium", "magnesium", "albumin_creatinine_ratio"] },
  { titulo: "Coração", marcadores: ["nt_probnp", "troponin"] },
  { titulo: "Outros", marcadores: ["tsh", "t4", "hemoglobin", "uric_acid", "ast", "alt", "ck", "vitamin_d", "inr"] },
];

const STATUS_TONE: Record<string, string> = {
  normal: "bg-success-bg text-success",
  attention: "bg-warning-bg text-warning",
  critical: "bg-error-bg text-error",
};
const STATUS_LABEL: Record<string, string> = { normal: "Normal", attention: "Atenção", critical: "Alterado" };

/** Limite do bucket `exams` — 25 MiB, definido na migração 20260911000000 §7. */
const TAMANHO_MAXIMO = 25 * 1024 * 1024;

/**
 * `anexo_paciente` não é um tipo de exame: é a verdade sobre a linha. O
 * paciente não sabe (nem deve adivinhar) se o PDF que ele fotografou é um
 * Holter ou um ecocardiograma — quem classifica é o médico, ao ler. Até lá, a
 * lista mostra o que realmente aconteceu: um arquivo enviado, ainda não lido.
 */
const EXAM_TYPE_LABEL: Record<string, string> = {
  anexo_paciente: "Resultado que você enviou",
  ecg: "Eletrocardiograma (ECG)",
  echocardiogram: "Ecocardiograma",
  stress_test: "Teste ergométrico",
  holter: "Holter 24h",
  abpm: "MAPA 24h",
  coronary_ct: "Angio-TC de coronárias",
  myocardial_spect: "Cintilografia do coração",
  cardiac_mri: "Ressonância do coração",
  catheterization: "Cateterismo",
  carotid_doppler: "Doppler de carótidas",
};

/** Chave técnica → nome legível. Cobre os campos estruturados do §2.5. */
const CAMPO_LABEL: Record<string, string> = {
  fevi: "Fração de ejeção (FEVE)",
  metodo: "Método",
  atrio_esquerdo: "Átrio esquerdo",
  psap: "Pressão da artéria pulmonar",
  disfuncao_diastolica: "Função de relaxamento (diastólica)",
  strain_global: "Strain global",
  ritmo: "Ritmo",
  fc: "Frequência cardíaca",
  eixo: "Eixo elétrico",
  pr: "Intervalo PR",
  qrs: "Complexo QRS",
  qtc: "Intervalo QTc",
  alteracoes: "Alterações",
  alteracoes_st: "Alterações do segmento ST",
  septo: "Espessura do septo (a parede entre os dois ventrículos)",
  fc_media: "Frequência média",
  fc_min: "Frequência mínima",
  fc_max: "Frequência máxima",
  pausas: "Pausas",
  esv: "Extrassístoles ventriculares",
  essv: "Extrassístoles supraventriculares",
  tvns: "Episódios de taquicardia não sustentada",
  fa_percentual: "Tempo em fibrilação atrial",
  protocolo: "Protocolo",
  mets: "Capacidade de esforço (METs)",
  pct_fc_prevista: "Frequência atingida, comparada à prevista para a sua idade",
  pa_pico: "Pressão no pico do esforço",
  duracao: "Duração do exame",
  motivo_interrupcao: "Motivo de parar",
  descenso_noturno: "Queda da pressão à noite",
  carga_pressorica: "Carga de pressão alta",
  escore_calcio: "Escore de cálcio",
  percentil: "Percentil (comparado à idade/sexo)",
  cad_rads: "Classificação CAD-RADS",
  isquemia: "Isquemia",
  massa: "Massa do coração",
  realce_tardio: "Cicatriz (realce tardio)",
  vasos: "Vasos afetados",
  conduta: "Conduta indicada",
  stents: "Stents colocados",
  emi: "Espessura da parede da artéria",
  placas: "Placas de gordura",
  estenose_pct: "Estreitamento da artéria",
  arquivo: "Arquivo",
};

/**
 * Unidade de quem é NÚMERO no banco.
 *
 * A fração de ejeção é o caso que obrigou este mapa a existir: `findings.fevi`
 * precisa continuar numérico porque `lib/clinical/educacao.ts` compara o valor
 * para montar a lição ("entre 50% e 70% é a faixa normal"). Guardar "61%" como
 * texto quebraria a lição; imprimir "61" sozinho na tela faz o paciente
 * perguntar "61 do quê?". Então a unidade é escrita no RENDER, aqui.
 *
 * Só se aplica quando o valor gravado é `number`: laudo importado costuma vir
 * com a unidade já dentro do texto ("55 mm"), e repeti-la daria "55 mm mm".
 */
const CAMPO_UNIDADE: Record<string, string> = {
  fevi: "%",
  pct_fc_prevista: "%",
  estenose_pct: "%",
  fa_percentual: "%",
  fc: "bpm",
  fc_media: "bpm",
  fc_min: "bpm",
  fc_max: "bpm",
  pr: "ms",
  qrs: "ms",
  qtc: "ms",
  septo: "mm",
  atrio_esquerdo: "mm",
  emi: "mm",
  psap: "mmHg",
  mets: "METs",
};

/**
 * A linha de baixo, em português de paciente.
 *
 * "Extrassístole", "METs" e "segmento ST" são palavras do laudo, não do
 * paciente — e o laudo é justamente o que ele chega em casa sem entender. O
 * nome técnico continua na tela (é a palavra que o médico vai usar na
 * consulta) e ganha ao lado a frase que diz o que ele significa. Nenhuma
 * destas frases diz se o achado é bom, ruim, ou o que fazer: quem interpreta
 * o exame é o médico.
 */
const CAMPO_EXPLICACAO: Record<string, string> = {
  esv: "Batidas fora do ritmo que nascem na parte de baixo do coração.",
  essv: "Batidas fora do ritmo que nascem na parte de cima do coração.",
  mets: "Mede quanto esforço físico você conseguiu sustentar durante o exame.",
  alteracoes_st: "Trecho do traçado do eletrocardiograma que o médico usa para avaliar o esforço do músculo do coração.",
  tvns: "Sequências rápidas de batidas que começam e param sozinhas.",
};

function campoLabel(chave: string): string {
  return CAMPO_LABEL[chave] ?? chave.replace(/_/g, " ");
}

/** Como o valor de um campo estruturado aparece escrito para o paciente. */
function campoValor(chave: string, valor: unknown): string {
  if (typeof valor !== "number") return String(valor);
  // Decimais do próprio dado (até 3): 5.9 é "5,9" e 1.18 continua "1,18".
  const casas = Math.min(3, (String(valor).split(".")[1] ?? "").length);
  const texto = numero(valor, casas) ?? String(valor);
  const unidade = CAMPO_UNIDADE[chave];
  if (!unidade) return texto;
  // "%" cola no número ("91%"); toda outra unidade vai separada ("12 mm").
  return unidade === "%" ? `${texto}%` : `${texto} ${unidade}`;
}

/**
 * Valor de laboratório em pt-BR, com as casas que o próprio resultado tem.
 * Arredondar aqui mudaria o exame: 1,18 mg/dL não é 1,2 mg/dL.
 */
function valorLab(valor: number): string {
  const casas = Math.min(3, (String(valor).split(".")[1] ?? "").length);
  return numero(valor, casas) ?? String(valor);
}

function fmtDia(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDiaCurto(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function ExamesPage() {
  const { labs, ultimoPorMarcador, isLoading: loadingLabs } = useLabResults();
  const { exams, isLoading: loadingExams, anexar, urlDoArquivo } = useCardioExams();
  const { targets, isLoading: loadingTargets } = useTargets();
  const reduzirMovimento = usePrefereMenosMovimento();
  const fileRef = useRef<HTMLInputElement>(null);

  const ldlHistorico = useMemo(() => {
    return [...labs]
      .filter((l) => l.marker_key === "ldl" && l.value_num != null)
      .sort((a, b) => +new Date(a.collected_at ?? 0) - +new Date(b.collected_at ?? 0))
      .map((l) => ({ dia: fmtDiaCurto(l.collected_at), ldl: l.value_num! }));
  }, [labs]);

  const examsOrdenados = useMemo(
    () => [...exams].sort((a, b) => +new Date(b.performed_at ?? 0) - +new Date(a.performed_at ?? 0)),
    [exams]
  );

  /**
   * ══════════════════════════════════════════════════════════════════
   * "ANEXAR RESULTADO" AGORA ANEXA DE VERDADE.
   * ══════════════════════════════════════════════════════════════════
   *
   * AUDITORIA: `onFile` recebia o arquivo e disparava "Recebido. Seu médico
   * vai revisar..." sem upload nenhum — o `File` era descartado na saída da
   * função. É a pior classe de erro deste produto: mensagem falsa sobre um
   * exame. O paciente acreditava ter entregado o laudo e parava de cobrar; o
   * médico nunca soube que existia.
   *
   * O que existe agora: upload para o bucket privado `exams`, linha em
   * `cardio_exams` apontando para o arquivo, e o anexo aparecendo na lista
   * abaixo com nome, data e link assinado. Falhou, a tela DIZ que falhou.
   */
  const abrirSeletor = () => {
    if (getDevBypass()) {
      toast.info("Modo demonstração: o arquivo não é enviado a lugar nenhum.");
      return;
    }
    fileRef.current?.click();
  };

  const onFile = (f?: File | null) => {
    if (!f) return;
    // O limite do bucket é 25 MB (migração 20260911000000 §7). Recusar aqui,
    // com o número na frente, é melhor do que deixar o servidor recusar com
    // uma mensagem que o paciente não entende.
    if (f.size > TAMANHO_MAXIMO) {
      toast.error("Esse arquivo tem mais de 25 MB. Tente uma foto menor ou o PDF do laboratório.");
      return;
    }
    anexar.mutate(f);
  };

  if (loadingLabs || loadingExams || loadingTargets) {
    return (
      <TelaPaciente>
        <PageHeader title="Exames" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader
        title="Exames"
        subtitle="Resultados de laboratório e do coração"
        action={
          <Button size="lg" onClick={abrirSeletor} className="gap-2" disabled={anexar.isPending}>
            <Paperclip className="h-5 w-5" aria-hidden />
            {anexar.isPending ? "Enviando..." : "Anexar resultado"}
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* ── LDL contra a meta ────────────────────────────────────── */}
      {ldlHistorico.length > 0 && (
        <section>
          <TituloSecao titulo="LDL ao longo do tempo" subtitulo={`sua meta: < ${targets.ldl_max} mg/dL`} />
          <SurfaceCard>
            <AreaGrafico altura={200}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ldlHistorico} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  {gradeGrafico()}
                  {eixoX("dia")}
                  {eixoY({ unidade: "mg/dL" })}
                  <ReferenceLine y={targets.ldl_max} stroke={COR_REFERENCIA} strokeDasharray="4 4" />
                  {dicaGrafico((v: never) => [`${v} mg/dL`, "LDL"])}
                  <Line
                    type="monotone" dataKey="ldl" name="LDL"
                    stroke={COR_SERIE} strokeWidth={2.5} dot={{ r: 3 }}
                    isAnimationActive={!reduzirMovimento}
                  />
                </LineChart>
              </ResponsiveContainer>
            </AreaGrafico>
            {/* A linha tracejada não se explica sozinha: quem lê precisa saber
                que ela é a meta do médico, e não mais uma medida. */}
            <LegendaGrafico
              itens={[
                { cor: COR_SERIE, rotulo: "Seu LDL a cada exame" },
                { cor: COR_REFERENCIA, rotulo: `Meta do seu médico (${targets.ldl_max} mg/dL)` },
              ]}
            />
          </SurfaceCard>
        </section>
      )}

      {/* ── Laboratório por bloco ────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Exames de laboratório" icone={FlaskConical} />
        {labs.length === 0 ? (
          <EmptyState icon={FlaskConical} title="Nenhum exame ainda" description="Seus resultados aparecem aqui assim que forem lançados." variant="card" />
        ) : (
          <div className="space-y-5">
            {BLOCOS.map((bloco) => {
              const itens = bloco.marcadores
                .map((k) => ultimoPorMarcador.get(k))
                .filter((v): v is NonNullable<typeof v> => !!v);
              if (itens.length === 0) return null;
              return (
                <div key={bloco.titulo}>
                  <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">{bloco.titulo}</p>
                  <div className="space-y-2.5">
                    {itens.map((l) => (
                      <SurfaceCard key={l.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground break-words">{l.marker_label}</p>
                          <p className="text-sm text-muted-foreground">
                            {l.reference_text ? `Referência: ${l.reference_text}` : ""} · {fmtDia(l.collected_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground tabular-nums">
                            {l.value_num != null ? valorLab(Number(l.value_num)) : l.value_text ?? "—"} <span className="text-sm font-normal text-muted-foreground">{l.unit}</span>
                          </p>
                          {l.status && (
                            <span className={cn("inline-block mt-0.5 text-xs font-bold uppercase tracking-wide rounded-full px-2 py-0.5", STATUS_TONE[l.status])}>
                              {STATUS_LABEL[l.status]}
                            </span>
                          )}
                        </div>
                      </SurfaceCard>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Exames do coração — linha do tempo ───────────────────── */}
      <section>
        <TituloSecao titulo="Exames do coração" icone={HeartPulse} />
        {examsOrdenados.length === 0 ? (
          <EmptyState icon={HeartPulse} title="Nenhum exame do coração ainda" description="ECG, ecocardiograma, Holter e outros aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-3">
            {examsOrdenados.map((e) => (
              <SurfaceCard key={e.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground break-words">{EXAM_TYPE_LABEL[e.exam_type] ?? e.exam_type}</p>
                    <p className="text-sm text-muted-foreground">{fmtDia(e.performed_at)}{e.performed_by ? ` · ${e.performed_by}` : ""}</p>
                  </div>
                </div>
                {e.conclusion && (
                  <p className="text-base text-foreground leading-relaxed mb-2">{e.conclusion}</p>
                )}

                {/* O bucket `exams` é privado: o link só existe assinado, e a
                    assinatura vem do hook, em lote. Enquanto ela não chega, a
                    linha diz que está preparando — nunca um link morto. */}
                {e.file_url && (
                  <div className="mb-2">
                    {(() => {
                      const href = urlDoArquivo(e.file_url);
                      return href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-base font-semibold text-primary underline underline-offset-2 touch-target"
                      >
                        <FileText className="h-5 w-5" aria-hidden />
                        Abrir arquivo
                      </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">Preparando o link do arquivo...</span>
                      );
                    })()}
                  </div>
                )}
                {Object.keys(e.findings ?? {}).length > 0 && (
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-border">
                    {Object.entries(e.findings).map(([chave, valor]) => (
                      valor == null || valor === "" ? null : (
                        <div key={chave} className="min-w-0">
                          <p className="text-sm text-muted-foreground break-words">{campoLabel(chave)}</p>
                          <p className="text-base font-semibold text-foreground break-words">{campoValor(chave, valor)}</p>
                          {CAMPO_EXPLICACAO[chave] && (
                            <p className="text-sm text-muted-foreground leading-relaxed break-words mt-0.5">
                              {CAMPO_EXPLICACAO[chave]}
                            </p>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>
    </TelaPaciente>
  );
}
