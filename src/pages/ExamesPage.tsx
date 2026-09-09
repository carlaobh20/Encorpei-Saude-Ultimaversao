/**
 * ExamesPage — resultados de laboratório e exames do coração.
 *
 * Laboratório agrupado por bloco clínico, evolução do LDL contra a meta, e
 * exames de imagem/gráficos em linha do tempo com campos traduzidos.
 */
import { useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  FlaskConical, HeartPulse, Paperclip,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SectionHeader } from "@/components/shell/SectionHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDevBypass } from "@/contexts/DevBypass";
import { useLabResults, useCardioExams } from "@/hooks/useCardioClinical";
import { useTargets } from "@/hooks/useCardioPatient";
import { DOMAIN_COLORS } from "@/theme/colors";
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
      <div>
        <PageHeader title="Exames" />
        <TabPageSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Exames"
        subtitle="Resultados de laboratório e do coração"
        action={
          <Button onClick={anexar} className="gap-2">
            <Paperclip className="h-4 w-4" /> Anexar resultado
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
        <div className="mb-6">
          <SectionHeader title="LDL ao longo do tempo" subtitle={`sua meta: < ${targets.ldl_max} mg/dL`} />
          <SurfaceCard>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={ldlHistorico} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="2 4" />
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <ReferenceLine y={targets.ldl_max} stroke={DOMAIN_COLORS.metabolico} strokeDasharray="4 4" />
                <RTooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} formatter={(v: number) => [`${v} mg/dL`, "LDL"]} />
                <Line type="monotone" dataKey="ldl" stroke={DOMAIN_COLORS.metabolico} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </SurfaceCard>
        </div>
      )}

      {/* ── Laboratório por bloco ────────────────────────────────── */}
      <div className="mb-6">
        <SectionHeader title="Exames de laboratório" icon={FlaskConical} />
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
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">{bloco.titulo}</p>
                  <div className="space-y-2.5">
                    {itens.map((l) => (
                      <SurfaceCard key={l.id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{l.marker_label}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.reference_text ? `Referência: ${l.reference_text}` : ""} · {fmtDia(l.collected_at)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-lg font-bold text-foreground">
                            {l.value_num ?? l.value_text ?? "—"} <span className="text-xs font-normal text-muted-foreground">{l.unit}</span>
                          </p>
                          {l.status && (
                            <span className={cn("text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5", STATUS_TONE[l.status])}>
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
      </div>

      {/* ── Exames do coração — linha do tempo ───────────────────── */}
      <div>
        <SectionHeader title="Exames do coração" icon={HeartPulse} />
        {examsOrdenados.length === 0 ? (
          <EmptyState icon={HeartPulse} title="Nenhum exame do coração ainda" description="ECG, ecocardiograma, Holter e outros aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-3">
            {examsOrdenados.map((e) => (
              <SurfaceCard key={e.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{EXAM_TYPE_LABEL[e.exam_type] ?? e.exam_type}</p>
                    <p className="text-xs text-muted-foreground">{fmtDia(e.performed_at)}{e.performed_by ? ` · ${e.performed_by}` : ""}</p>
                  </div>
                </div>
                {e.conclusion && (
                  <p className="text-sm text-foreground leading-relaxed mb-2">{e.conclusion}</p>
                )}
                {Object.keys(e.findings ?? {}).length > 0 && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-border-soft">
                    {Object.entries(e.findings).map(([chave, valor]) => (
                      valor == null || valor === "" ? null : (
                        <div key={chave} className="min-w-0">
                          <p className="text-[10.5px] text-muted-foreground truncate">{campoLabel(chave)}</p>
                          <p className="text-xs font-semibold text-foreground truncate">{String(valor)}</p>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </SurfaceCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
