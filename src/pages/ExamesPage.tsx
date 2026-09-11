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
  FlaskConical, HeartPulse, Paperclip,
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
import type { LabMarkerKey, CardioExamType } from "@/types/cardio";

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

const EXAM_TYPE_LABEL: Record<CardioExamType, string> = {
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
  fc_media: "Frequência média",
  fc_min: "Frequência mínima",
  fc_max: "Frequência máxima",
  pausas: "Pausas",
  esv: "Extrassístoles ventriculares",
  essv: "Extrassístoles supraventriculares",
  tvns: "Episódios de taquicardia não sustentada",
  fa_percentual: "% do tempo em fibrilação atrial",
  protocolo: "Protocolo",
  mets: "Capacidade de esforço (METs)",
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
};

function campoLabel(chave: string): string {
  return CAMPO_LABEL[chave] ?? chave.replace(/_/g, " ");
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
  const { exams, isLoading: loadingExams } = useCardioExams();
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

  const anexar = () => {
    if (getDevBypass()) { toast.info("Modo demo: nada é salvo."); return; }
    fileRef.current?.click();
  };
  const onFile = (f?: File | null) => {
    if (!f) return;
    toast.info("Recebido. Seu médico vai revisar e lançar o resultado no seu histórico.");
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
          <Button size="lg" onClick={anexar} className="gap-2">
            <Paperclip className="h-5 w-5" aria-hidden /> Anexar resultado
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
                            {l.value_num ?? l.value_text ?? "—"} <span className="text-sm font-normal text-muted-foreground">{l.unit}</span>
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
                {Object.keys(e.findings ?? {}).length > 0 && (
                  <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-border">
                    {Object.entries(e.findings).map(([chave, valor]) => (
                      valor == null || valor === "" ? null : (
                        <div key={chave} className="min-w-0">
                          <p className="text-sm text-muted-foreground break-words">{campoLabel(chave)}</p>
                          <p className="text-base font-semibold text-foreground break-words">{String(valor)}</p>
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
