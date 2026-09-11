/**
 * MeuMesPage — "Meu Mês": o resumo que o paciente tem orgulho de abrir e
 * leva impresso para a consulta (docs/ENGAJAMENTO-CARDIO.md §2, item "Meu
 * Mês"). Celebra o esforço sem infantilizar; quando o mês foi ruim, diz isso
 * com honestidade e sem culpar.
 */
import { useMemo, useState } from "react";
import {
  Printer, HeartPulse, Gauge, Pill, Footprints, Moon, Droplets, Activity,
  ArrowUp, ArrowDown,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { TelaPaciente, TituloSecao, Lista, ItemLista } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTargets } from "@/hooks/useCardioPatient";
import { useBloodPressure, useActivity, useSleep } from "@/hooks/useCardioReadings";
import { useCardioMedications } from "@/hooks/useCardioMedications";
import { useSymptoms, useCardioExams } from "@/hooks/useCardioClinical";
import { useCapacidade, useIdadeDoCoracao, useSodio } from "@/hooks/useEngajamento";
import { calcularTempoNoAlvo, ROTULO_MEDIDAS_NA_META_CURTO } from "@/lib/clinical/timeInRange";
import { DOMAIN_COLORS } from "@/theme/colors";
import type { SymptomType } from "@/types/cardio";

const SYMPTOM_LABEL: Record<SymptomType, string> = {
  chest_pain: "Dor no peito",
  dyspnea: "Falta de ar",
  palpitations: "Palpitação",
  edema: "Inchaço nas pernas",
  syncope: "Desmaio",
  presyncope: "Quase desmaio",
  claudication: "Dor na perna ao andar",
  dry_cough: "Tosse seca",
  fatigue: "Cansaço fora do comum",
  dizziness: "Tontura",
};

const EXAM_LABEL: Record<string, string> = {
  ecg: "Eletrocardiograma", echocardiogram: "Ecocardiograma", stress_test: "Teste ergométrico",
  holter: "Holter", mapa: "MAPA", ct_angio: "Angio-TC", scintigraphy: "Cintilografia",
  mri: "Ressonância magnética", catheterization: "Cateterismo", carotid_doppler: "Doppler de carótidas",
};

function nomeMes(d: Date): string {
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mediaOu(nums: number[], casas = 0): number | null {
  if (nums.length === 0) return null;
  return +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(casas);
}

export default function MeuMesPage() {
  const opcoesDeMes = useMemo(() => {
    const hoje = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      return { valor: `${d.getFullYear()}-${d.getMonth()}`, ano: d.getFullYear(), mes: d.getMonth(), rotulo: nomeMes(d) };
    });
  }, []);
  const [mesSelecionado, setMesSelecionado] = useState(opcoesDeMes[0].valor);

  const { ano, mes } = opcoesDeMes.find((o) => o.valor === mesSelecionado) ?? opcoesDeMes[0];
  const inicio = new Date(ano, mes, 1).getTime();
  const fim = new Date(ano, mes + 1, 1).getTime();
  const noRange = (t: number) => t >= inicio && t < fim;

  const { targets, isLoading: loadingTargets } = useTargets();
  const bp = useBloodPressure();
  const activity = useActivity();
  const sleep = useSleep();
  const meds = useCardioMedications();
  const { symptoms, isLoading: loadingSymptoms } = useSymptoms();
  const { exams, isLoading: loadingExams } = useCardioExams();
  const idadeCoracao = useIdadeDoCoracao();
  const sodio = useSodio();
  const capacidade = useCapacidade();

  const isLoading = loadingTargets || bp.isLoading || meds.isLoading || loadingSymptoms || loadingExams || idadeCoracao.isLoading || capacidade.isLoading;

  const pressaoDoMes = useMemo(
    () => bp.readings.filter((r) => r.cuff_validated && r.validation_status === "validated" && noRange(+new Date(r.recorded_at))),
    [bp.readings, inicio, fim]
  );
  const pressaoMedia = useMemo(() => ({
    sistolica: mediaOu(pressaoDoMes.map((r) => r.systolic)),
    diastolica: mediaOu(pressaoDoMes.map((r) => r.diastolic)),
  }), [pressaoDoMes]);

  const tempoNoAlvoMes = useMemo(() => {
    const diasDoMes = Math.round((fim - inicio) / 86_400_000);
    return calcularTempoNoAlvo(bp.readings, targets, diasDoMes, new Date(Math.min(fim, Date.now())));
  }, [bp.readings, targets, inicio, fim]);

  const intakesDoMes = useMemo(
    () => meds.intakes.filter((i) => noRange(+new Date(i.intake_date))),
    [meds.intakes, inicio, fim]
  );
  const adesaoMes = intakesDoMes.length > 0
    ? Math.round((intakesDoMes.filter((i) => i.taken).length / intakesDoMes.length) * 100)
    : null;

  const atividadeDoMes = useMemo(
    () => activity.records.filter((a) => noRange(+new Date(a.activity_date))),
    [activity.records, inicio, fim]
  );
  const passosMedia = mediaOu(atividadeDoMes.map((a) => a.steps ?? 0));
  const minutosAtividade = atividadeDoMes.reduce((s, a) => s + (a.moderate_minutes ?? 0) + (a.vigorous_minutes ?? 0), 0);

  const sonoDoMes = useMemo(
    () => sleep.records.filter((r) => noRange(+new Date(r.sleep_date))),
    [sleep.records, inicio, fim]
  );
  const sonoMedioMin = mediaOu(sonoDoMes.map((r) => r.total_minutes));

  const sodioDoMes = useMemo(
    () => sodio.registros.filter((r) => noRange(+new Date(r.dia))),
    [sodio.registros, inicio, fim]
  );
  const sodioMedio = useMemo(() => {
    const porDia = new Map<string, number>();
    for (const r of sodioDoMes) porDia.set(r.dia, (porDia.get(r.dia) ?? 0) + r.sodio_mg);
    const dias = [...porDia.values()];
    return dias.length > 0 ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : null;
  }, [sodioDoMes]);

  const sintomasDoMes = useMemo(
    () => symptoms.filter((s) => noRange(+new Date(s.occurred_at))),
    [symptoms, inicio, fim]
  );

  const examesDoMes = useMemo(
    () => exams.filter((e) => e.performed_at && noRange(+new Date(e.performed_at))),
    [exams, inicio, fim]
  );

  const idadeCoracaoNoMes = useMemo(() => {
    const ordenado = [...idadeCoracao.historico].sort((a, b) => +new Date(a.calculado_em) - +new Date(b.calculado_em));
    const ateFim = ordenado.filter((h) => +new Date(h.calculado_em) < fim);
    const atual = ateFim[ateFim.length - 1] ?? null;
    const ateInicio = ordenado.filter((h) => +new Date(h.calculado_em) < inicio);
    const anterior = ateInicio[ateInicio.length - 1] ?? null;
    return { atual, variacao: atual && anterior ? atual.idade_coracao - anterior.idade_coracao : null };
  }, [idadeCoracao.historico, inicio, fim]);

  const titulacoes = useMemo(
    () => meds.medications.filter((m) => m.status === "active" && m.target_dose && m.target_dose !== m.dose),
    [meds.medications]
  );

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Meu mês" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  const rotuloMes = opcoesDeMes.find((o) => o.valor === mesSelecionado)?.rotulo ?? "";

  return (
    <TelaPaciente>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-sheet { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      <div className="no-print">
        <PageHeader title="Meu mês" subtitle="Um resumo para você e para levar à consulta" />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={mesSelecionado} onValueChange={setMesSelecionado}>
            <SelectTrigger className="h-12 w-full min-[420px]:w-56 rounded-xl text-base" aria-label="Escolher o mês">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {opcoesDeMes.map((o) => <SelectItem key={o.valor} value={o.valor}>{o.rotulo}</SelectItem>)}
            </SelectContent>
          </Select>
          {/* O único azul cheio da tela: imprimir é a ação pela qual ela
              existe — o resumo serve para ir junto na consulta. */}
          <Button size="lg" onClick={() => window.print()} className="min-[420px]:ml-auto w-full min-[420px]:w-auto">
            <Printer className="h-5 w-5" aria-hidden /> Imprimir / salvar em PDF
          </Button>
        </div>
      </div>

      <div className="print-sheet rounded-2xl border border-border bg-card p-5 md:p-8 shadow-sm">
        <div className="border-b border-border pb-4 mb-5">
          <h1 className="font-display text-2xl font-semibold text-foreground break-words">Meu mês — {rotuloMes}</h1>
          <p className="text-sm text-muted-foreground mt-1">Encorpei Cardio · resumo do paciente</p>
        </div>

        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-3 gap-3 mb-6">
          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <HeartPulse className="h-4 w-4" style={{ color: DOMAIN_COLORS.coracao }} />
              <p className="text-sm text-muted-foreground">Idade do coração</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {idadeCoracaoNoMes.atual ? `${idadeCoracaoNoMes.atual.idade_coracao} anos` : "—"}
            </p>
            {idadeCoracaoNoMes.variacao != null && (
              /* Cor NUNCA sozinha: a seta e a palavra dizem a direção. */
              <p className={`text-sm font-medium mt-1 flex items-center gap-1 ${idadeCoracaoNoMes.variacao <= 0 ? "text-success" : "text-error"}`}>
                {idadeCoracaoNoMes.variacao !== 0 && (
                  idadeCoracaoNoMes.variacao > 0
                    ? <ArrowUp className="h-4 w-4 shrink-0" aria-hidden />
                    : <ArrowDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {idadeCoracaoNoMes.variacao === 0 ? "Sem variação" : `${idadeCoracaoNoMes.variacao > 0 ? "+" : ""}${idadeCoracaoNoMes.variacao} desde o mês anterior`}
              </p>
            )}
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="h-4 w-4" style={{ color: DOMAIN_COLORS.pressao }} />
              {/* "Tempo no alvo" era mentira de rótulo: a conta é sobre AMOSTRAS
                  de pressão, não sobre tempo monitorado (ver timeInRange.ts).
                  O rótulo vem da constante para não divergir de novo. */}
              <p className="text-sm text-muted-foreground">{ROTULO_MEDIDAS_NA_META_CURTO}</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {tempoNoAlvoMes.percentual != null ? `${tempoNoAlvoMes.percentual}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{tempoNoAlvoMes.total} medida{tempoNoAlvoMes.total === 1 ? "" : "s"} no mês</p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Gauge className="h-4 w-4" style={{ color: DOMAIN_COLORS.pressao }} />
              <p className="text-sm text-muted-foreground">Pressão média</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {pressaoMedia.sistolica != null ? `${pressaoMedia.sistolica}/${pressaoMedia.diastolica}` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">meta: até {targets.bp_systolic_max}/{targets.bp_diastolic_max}</p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Pill className="h-4 w-4" style={{ color: DOMAIN_COLORS.metabolico }} />
              <p className="text-sm text-muted-foreground">Adesão aos remédios</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{adesaoMes != null ? `${adesaoMes}%` : "—"}</p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Footprints className="h-4 w-4" style={{ color: DOMAIN_COLORS.atividade }} />
              <p className="text-sm text-muted-foreground">Passos por dia</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{passosMedia != null ? passosMedia : "—"}</p>
            <p className="text-sm text-muted-foreground mt-1">{minutosAtividade} min de atividade no mês</p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Moon className="h-4 w-4" style={{ color: DOMAIN_COLORS.sono }} />
              <p className="text-sm text-muted-foreground">Sono médio</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {sonoMedioMin != null ? `${Math.floor(sonoMedioMin / 60)}h${String(Math.round(sonoMedioMin % 60)).padStart(2, "0")}` : "—"}
            </p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Droplets className="h-4 w-4" style={{ color: DOMAIN_COLORS.metabolico }} />
              <p className="text-sm text-muted-foreground">Sódio médio por dia</p>
            </div>
            <p className="text-2xl font-bold text-foreground tabular-nums">{sodioMedio != null ? `${sodioMedio} mg` : "—"}</p>
          </SurfaceCard>

          <SurfaceCard variant="stat">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Capacidade</p>
            </div>
            <p className="text-base text-foreground leading-relaxed">
              {capacidade.evolucao.caminhada.atual != null
                ? `Caminhada de 6 min: ${capacidade.evolucao.caminhada.atual} m.`
                : "Ainda sem teste de capacidade neste mês."}
            </p>
          </SurfaceCard>
        </div>

        {/* ── Sintomas relatados ────────────────────────────────── */}
        <div className="mb-5">
          <TituloSecao titulo="Sintomas relatados no mês" />
          {sintomasDoMes.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhum sintoma registrado neste mês.</p>
          ) : (
            <Lista>
              {sintomasDoMes.map((s) => (
                <ItemLista key={s.id}>
                  <span className="text-base text-foreground min-w-0 break-words">{SYMPTOM_LABEL[s.symptom_type] ?? s.symptom_type}</span>
                  <span className="text-sm text-muted-foreground shrink-0">{new Date(s.occurred_at).toLocaleDateString("pt-BR")}</span>
                </ItemLista>
              ))}
            </Lista>
          )}
        </div>

        {/* ── Exames novos ──────────────────────────────────────── */}
        <div className="mb-5">
          <TituloSecao titulo="Exames novos" />
          {examesDoMes.length === 0 ? (
            <p className="text-base text-muted-foreground">Nenhum exame novo neste mês.</p>
          ) : (
            <Lista>
              {examesDoMes.map((e) => (
                <ItemLista key={e.id}>
                  <span className="text-base text-foreground min-w-0 break-words">{EXAM_LABEL[e.exam_type] ?? e.exam_type}</span>
                  <span className="text-sm text-muted-foreground shrink-0">{e.performed_at ? new Date(e.performed_at).toLocaleDateString("pt-BR") : ""}</span>
                </ItemLista>
              ))}
            </Lista>
          )}
        </div>

        {/* ── O que o médico mudou ──────────────────────────────── */}
        {titulacoes.length > 0 && (
          <div>
            <TituloSecao titulo="O que o médico mudou" />
            <Lista>
              {titulacoes.map((m) => (
                <ItemLista key={m.id}>
                  <span className="text-base text-foreground min-w-0 break-words">{m.name}</span>
                  <span className="text-sm text-muted-foreground shrink-0">{m.dose} → alvo {m.target_dose}</span>
                </ItemLista>
              ))}
            </Lista>
          </div>
        )}
      </div>
    </TelaPaciente>
  );
}
