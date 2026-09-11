/**
 * ══════════════════════════════════════════════════════════════════════
 * MetasPage — duas metas, dois donos
 * ══════════════════════════════════════════════════════════════════════
 *
 * Esta tela existe para deixar visível uma fronteira que o banco já leva a
 * sério desde a migração 20260912000000_seguranca.sql (§3):
 *
 *   · "O QUE SEU MÉDICO DEFINIU" — `cardio_targets`. Pressão, colesterol,
 *     batimentos, peso seco. É PRESCRIÇÃO: os mesmos números disparam os
 *     alertas do app. O paciente lê; quem escreve é o cardiologista vinculado.
 *
 *   · "O QUE EU COMBINEI COMIGO" — `patient_goals`. Passos, exercício, sono,
 *     sal, e um recado livre. É COMPROMISSO: não dispara alerta, não titula
 *     remédio, não vira cobrança. O paciente escreve; o médico lê.
 *
 * Antes da migração, o paciente conseguia reescrever a primeira lista — ou
 * seja, mexer no limiar que decide se ele recebe um alerta. Fechado o buraco,
 * a tela ficou só de leitura, e isso é regressão de outro tipo: sumiu do
 * produto a única parte em que o paciente decide alguma coisa. Adesão em
 * doença crônica não se sustenta em obediência; se sustenta em ter algo seu
 * para cumprir. Daí a segunda lista.
 *
 * Duas decisões de interface que não são estética:
 *
 *  1. Nenhum controle editável aparece perto dos números do médico. Não é o
 *     RLS que protege o paciente de se confundir — é a ausência do botão.
 *     Se ele quer mudar um número da prescrição, o app oferece PEDIR: abre a
 *     conversa com o cardiologista com a mensagem já redigida. Pedir e mudar
 *     não podem parecer a mesma ação.
 *
 *  2. Alvo de toque grande (≥ 48px) e passo fixo nos botões −/+. O paciente
 *     típico tem 60–75 anos; digitar número em campo pequeno no celular é
 *     onde ele erra, desiste, ou grava 50000 passos sem querer.
 *
 * REGRA CLÍNICA INEGOCIÁVEL: nada nesta tela prescreve conduta nem sugere que
 * o paciente ajuste tratamento por conta própria. "Combinar caminhar mais" é
 * comportamento. "Baixar o alvo de pressão" seria conduta — e por isso só
 * existe aqui na forma de pergunta ao médico.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * As duas listas, quem escreve cada uma, os passos dos −/+, os limites de
 * sanidade e todos os textos seguem idênticos. Mudou:
 *
 *  · A barra de progresso das metas do médico ganhou o número em texto ao
 *    lado do rótulo (`BarraProporcao`). Ela já vinha com o selo "No alvo" /
 *    "Fora do alvo" escrito — o que faltava era a barra em si não ser só
 *    cor e comprimento.
 *
 *  · O aviso de "você ainda não tem médico acompanhando" virou o bloco de
 *    aviso comum do app, em vez de um cartão amarelo cheio que competia com
 *    o cartão de explicação azul logo acima dele.
 *
 *  · Um azul cheio por tela: "Guardar meu combinado". O botão "Quero falar
 *    com meu médico sobre esta meta" continua secundário, como já era — o
 *    que mudou foi ele parar de ser o único controle com desenho próprio,
 *    inventado dentro desta página.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Target, Info, Stethoscope, HeartHandshake, Minus, Plus,
  MessageSquare, Lock, Save, Footprints, Timer, Moon, Salad, PenLine,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, BarraProporcao, AvisoDaTela,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useTargets } from "@/hooks/useCardioPatient";
import { useMetasPaciente, useSalvarMetasPaciente, type MetasPacienteEdit } from "@/hooks/useMetasPaciente";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { usePatientMessages } from "@/hooks/useProfessional";
import { useBloodPressure, useHeartRate, useWeight, useActivity, useSleep } from "@/hooks/useCardioReadings";
import { useLabResults } from "@/hooks/useCardioClinical";
import { useSodio } from "@/hooks/useEngajamento";
import { mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { avaliarMeta, type TargetProgress } from "@/lib/clinical/cardioTargets";

const STATUS_TONE: Record<TargetProgress["status"], { bg: string; text: string; label: string }> = {
  on_target: { bg: "bg-success-bg", text: "text-success", label: "No alvo" },
  near: { bg: "bg-warning-bg", text: "text-warning", label: "Quase lá" },
  off_target: { bg: "bg-error-bg", text: "text-error", label: "Fora do alvo" },
  no_data: { bg: "bg-muted", text: "text-muted-foreground", label: "Sem dado ainda" },
};

function fmtData(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// ══════════════════════════════════════════════════════════════════════
// 1. O que o médico definiu — somente leitura, por decisão de produto
// ══════════════════════════════════════════════════════════════════════

/**
 * Cartão de meta clínica.
 *
 * Sem nenhum controle de edição, de propósito: a única ação possível é PEDIR
 * para conversar. `onPedir` é opcional — sem médico vinculado, não há a quem
 * pedir, e um botão que não leva a lugar nenhum é pior do que botão nenhum.
 */
function MetaClinicaCard({ meta, onPedir }: { meta: TargetProgress; onPedir?: () => void }) {
  const tone = STATUS_TONE[meta.status];
  const pct = meta.current == null
    ? 0
    : meta.lowerIsBetter
      ? Math.max(0, Math.min(100, Math.round((meta.target / Math.max(meta.current, 1)) * 100)))
      : Math.max(0, Math.min(100, Math.round((meta.current / Math.max(meta.target, 1)) * 100)));

  return (
    <SurfaceCard>
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-base font-semibold text-foreground">{meta.label}</p>
        <span className={cn("text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0", tone.bg, tone.text)}>
          {tone.label}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums mb-2">
        {meta.current != null ? meta.current : "—"} <span className="text-base font-normal text-muted-foreground">{meta.unit}</span>
      </p>
      <BarraProporcao
        rotulo={meta.lowerIsBetter ? "Meta: até" : "Meta:"}
        valor={`${meta.target} ${meta.unit}`}
        percentual={pct}
        cor={
          meta.status === "on_target" ? "hsl(var(--status-success))"
            : meta.status === "near" ? "hsl(var(--warning))"
              : meta.status === "off_target" ? "hsl(var(--status-danger))"
                : "hsl(var(--muted-foreground) / 0.3)"
        }
      />

      {onPedir && (
        <Button
          variant="outline"
          onClick={onPedir}
          className="mt-4 w-full h-12 justify-center gap-2 whitespace-normal text-base"
        >
          <MessageSquare className="h-5 w-5 shrink-0" aria-hidden />
          Quero falar com meu médico sobre esta meta
        </Button>
      )}
    </SurfaceCard>
  );
}

// ══════════════════════════════════════════════════════════════════════
// 2. O que eu combinei comigo — editável
// ══════════════════════════════════════════════════════════════════════

interface CampoMeta {
  chave: keyof MetasPacienteEdit;
  rotulo: string;
  /** Frase na voz do paciente, não do prontuário. */
  ajuda: string;
  unidade: string;
  icone: typeof Footprints;
  passo: number;
  min: number;
  max: number;
  /** Valor de partida quando ele resolve combinar algo pela primeira vez. */
  padrao: number;
  /** Quantas casas decimais o número tem (só o sono usa 1). */
  casas?: number;
}

/**
 * Os quatro combinados.
 *
 * Passo e limites escolhidos para que qualquer sequência de toques produza um
 * número plausível: não existe estado "18 passos por dia" nem "22 horas de
 * sono" para o paciente atravessar sem querer. Os limites NÃO são clínicos —
 * são de sanidade de entrada. Nenhum deles vira alerta.
 */
const CAMPOS: CampoMeta[] = [
  {
    chave: "steps_per_day", rotulo: "Passos por dia", ajuda: "quanto eu quero caminhar num dia comum",
    unidade: "passos", icone: Footprints, passo: 500, min: 1000, max: 20000, padrao: 6000,
  },
  {
    chave: "mvpa_minutes_week", rotulo: "Exercício por semana", ajuda: "minutos de caminhada mais puxada, somando a semana",
    unidade: "min", icone: Timer, passo: 15, min: 0, max: 420, padrao: 150,
  },
  {
    chave: "sleep_hours", rotulo: "Horas de sono", ajuda: "quanto eu quero dormir por noite",
    unidade: "h", icone: Moon, passo: 0.5, min: 4, max: 12, padrao: 7, casas: 1,
  },
  {
    chave: "sodium_mg_day", rotulo: "Sal por dia", ajuda: "sódio no dia inteiro — o sal da comida conta",
    unidade: "mg", icone: Salad, passo: 100, min: 800, max: 4000, padrao: 2000,
  },
];

/**
 * Controle de uma meta combinada.
 *
 * Três estados, e o primeiro é o que costuma ser esquecido: NÃO COMBINADO.
 * Não é zero e não é o padrão — é a ausência de compromisso, que é uma
 * resposta legítima. Forçar um número de partida transformaria "não pensei
 * nisso" em "eu quis 6000 passos", e o médico leria isso como autorrelato.
 */
function CombinadoCard({
  campo, valor, atual, referenciaMedico, onChange,
}: {
  campo: CampoMeta;
  valor: number | null;
  /** Onde ele está hoje, na média recente. Contexto, nunca cobrança. */
  atual: number | null;
  /** Número do médico para o mesmo assunto, quando existe. Só informativo. */
  referenciaMedico: number | null;
  onChange: (v: number | null) => void;
}) {
  const Icone = campo.icone;
  const fmt = (v: number) => v.toFixed(campo.casas ?? 0);

  const ajustar = (delta: number) => {
    const base = valor ?? campo.padrao;
    const bruto = base + delta;
    // Arredonda no passo para não acumular sujeira de ponto flutuante em 0.5h.
    const preso = Math.min(campo.max, Math.max(campo.min, Math.round(bruto / campo.passo) * campo.passo));
    onChange(+preso.toFixed(campo.casas ?? 0));
  };

  return (
    <SurfaceCard>
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <Icone className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground leading-tight">{campo.rotulo}</p>
          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{campo.ajuda}</p>
        </div>
      </div>

      {valor == null ? (
        <button
          type="button"
          onClick={() => onChange(campo.padrao)}
          className="w-full min-h-[56px] rounded-xl border-2 border-dashed border-border px-4 text-base font-medium text-muted-foreground active:scale-[0.99] transition-transform motion-reduce:transition-none"
        >
          Ainda não combinei nada — toque para combinar
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => ajustar(-campo.passo)}
              aria-label={`Diminuir ${campo.rotulo}`}
              className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <Minus className="h-6 w-6 text-foreground" />
            </button>

            <div className="text-center min-w-0">
              <p className="text-3xl font-bold text-foreground tabular-nums leading-none">
                {fmt(valor)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">{campo.unidade}</p>
            </div>

            <button
              type="button"
              onClick={() => ajustar(campo.passo)}
              aria-label={`Aumentar ${campo.rotulo}`}
              className="h-14 w-14 rounded-full bg-secondary flex items-center justify-center shrink-0 active:scale-95 transition-transform"
            >
              <Plus className="h-6 w-6 text-foreground" />
            </button>
          </div>

          <div className="mt-3 space-y-1">
            {atual != null && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Nos últimos dias você tem ficado em <b className="text-foreground">{fmt(atual)} {campo.unidade}</b>.
              </p>
            )}
            {referenciaMedico != null && (
              // Aparece como REFERÊNCIA, nunca como validação do combinado. O
              // paciente pode combinar menos do que a referência: é o combinado
              // dele, e um número que ele cumpre vale mais que um que ele ignora.
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seu médico usa <b className="text-foreground">{fmt(referenciaMedico)} {campo.unidade}</b> como referência.
              </p>
            )}
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-sm text-muted-foreground underline underline-offset-2 min-h-[44px] text-left"
            >
              Não quero combinar isto agora
            </button>
          </div>
        </>
      )}
    </SurfaceCard>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Página
// ══════════════════════════════════════════════════════════════════════

export default function MetasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { targets, ehSugestao, ehPrescricao, definidoEm, isLoading: loadingTargets } = useTargets();
  const { metas, isLoading: loadingMetas } = useMetasPaciente();
  const salvar = useSalvarMetasPaciente();
  const { professionals } = useMyProfessionals();
  const medico = professionals[0] ?? null;
  const { enviar } = usePatientMessages(user?.id, "patient", user?.id);

  const bp = useBloodPressure();
  const hr = useHeartRate();
  const weight = useWeight();
  const activity = useActivity();
  const sleep = useSleep();
  const sodio = useSodio();
  const { ultimoPorMarcador, isLoading: loadingLabs } = useLabResults();

  /**
   * Rascunho local do combinado.
   *
   * O formulário é de rascunho e não de gravação a cada toque, por dois
   * motivos: um toque no −/+ é exploração ("quanto seria 8000?"), não decisão;
   * e gravar por toque encheria `updated_at` de ruído, justo a coluna que o
   * médico usa para saber quando o paciente combinou aquilo.
   */
  const [rascunho, setRascunho] = useState<MetasPacienteEdit>({
    steps_per_day: null, mvpa_minutes_week: null, sleep_hours: null,
    sodium_mg_day: null, observacao: null,
  });
  const [tocado, setTocado] = useState(false);

  // Sincroniza o rascunho quando os dados chegam do servidor — e só enquanto
  // ele não mexeu em nada, para não apagar o que ele está digitando se uma
  // revalidação do TanStack Query cair no meio.
  useEffect(() => {
    if (tocado) return;
    setRascunho({
      steps_per_day: metas?.steps_per_day ?? null,
      mvpa_minutes_week: metas?.mvpa_minutes_week ?? null,
      sleep_hours: metas?.sleep_hours ?? null,
      sodium_mg_day: metas?.sodium_mg_day ?? null,
      observacao: metas?.observacao ?? null,
    });
  }, [metas, tocado]);

  // Meta clínica que o paciente quer discutir. `null` = diálogo fechado.
  const [pedido, setPedido] = useState<{ label: string; alvo: string } | null>(null);
  const [textoPedido, setTextoPedido] = useState("");

  const isLoading = loadingTargets || loadingMetas || bp.isLoading || loadingLabs;

  const mrpa = useMemo(() => mediaMrpa(bp.readings, new Date(), 7), [bp.readings]);

  const metasClinicas = useMemo(() => {
    const ldl = ultimoPorMarcador.get("ldl")?.value_num ?? null;
    const restingHr = hr.repouso[0]?.bpm ?? null;
    const lista = [
      avaliarMeta("Pressão sistólica", mrpa?.systolic ?? null, targets.bp_systolic_max, "mmHg", true),
      avaliarMeta("Pressão diastólica", mrpa?.diastolic ?? null, targets.bp_diastolic_max, "mmHg", true),
      avaliarMeta(
        "Batimentos de repouso", restingHr,
        Math.round((targets.resting_hr_min + targets.resting_hr_max) / 2), "bpm", false, 0.15,
      ),
      avaliarMeta("Colesterol LDL", ldl, targets.ldl_max, "mg/dL", true),
      targets.dry_weight_kg
        ? avaliarMeta("Peso", weight.ultimo?.value ?? null, targets.dry_weight_kg, "kg", true, 0.03)
        : null,
    ];
    return lista.filter((m): m is TargetProgress => !!m);
  }, [mrpa, targets, hr.repouso, weight.ultimo, ultimoPorMarcador]);

  /** Onde o paciente está hoje, por campo do combinado. Só contexto. */
  const atualPorCampo: Record<keyof MetasPacienteEdit, number | null> = {
    steps_per_day: activity.passosMedia,
    mvpa_minutes_week: activity.mvpaSemana,
    sleep_hours: sleep.mediaMinutos != null ? +(sleep.mediaMinutos / 60).toFixed(1) : null,
    sodium_mg_day: sodio.mediaSemana,
    observacao: null,
  };

  /** Referência do médico para o mesmo assunto — só quando é prescrição real. */
  const referenciaPorCampo: Record<keyof MetasPacienteEdit, number | null> = {
    steps_per_day: ehPrescricao ? targets.steps_per_day : null,
    mvpa_minutes_week: ehPrescricao ? targets.mvpa_minutes_week : null,
    sleep_hours: ehPrescricao ? targets.sleep_hours : null,
    sodium_mg_day: ehPrescricao ? (targets.sodium_mg_day ?? null) : null,
    observacao: null,
  };

  // Botão de guardar só acende quando há diferença real em relação ao que está
  // no banco. Sem linha gravada, qualquer campo preenchido já é diferença.
  const CHAVES = ["steps_per_day", "mvpa_minutes_week", "sleep_hours", "sodium_mg_day", "observacao"] as const;
  const mudou = CHAVES.some((k) => (rascunho[k] ?? null) !== (metas?.[k] ?? null));

  const abrirPedido = (meta: TargetProgress) => {
    const alvo = `${meta.target} ${meta.unit}`;
    setPedido({ label: meta.label, alvo });
    // Mensagem já redigida — e editável. O paciente pede; quem decide é o
    // médico. Em nenhum ponto o texto sugere que ele possa mudar sozinho.
    setTextoPedido(
      `Olá! Queria conversar sobre a minha meta de ${meta.label.toLowerCase()}, ` +
      `que hoje está em ${alvo}. Gostaria de entender melhor esse número e saber ` +
      `se faz sentido revermos. Obrigado!`,
    );
  };

  const enviarPedido = () => {
    const t = textoPedido.trim();
    if (!t) return;
    enviar.mutate(t, {
      onSuccess: () => {
        setPedido(null);
        navigate("/medico");
      },
    });
  };

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Minhas metas" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader
        title="Minhas metas"
        subtitle="o que seu médico definiu e o que você combinou com você"
      />

      {/* A frase que explica a tela inteira, na primeira dobra e sem jargão. */}
      <SurfaceCard variant="highlight">
        <div className="flex items-start gap-3">
          <Info className="h-6 w-6 text-primary shrink-0 mt-0.5" aria-hidden />
          <p className="text-base text-foreground leading-relaxed">
            Aqui tem duas listas. Os números do seu médico são a <b>receita do seu
            tratamento</b> — só ele muda. Os de baixo são o <b>combinado que você faz
            com você mesmo</b> — esses são seus, mude quando quiser.
          </p>
        </div>
      </SurfaceCard>

      {/* ── 1. O que seu médico definiu ─────────────────────────────── */}
      <TituloSecao
        titulo="O que seu médico definiu"
        icone={Stethoscope}
        subtitulo={
          ehPrescricao
            ? `definido em ${fmtData(definidoEm)}${medico?.display_name ? ` por ${medico.display_name}` : ""}`
            : "valores de referência"
        }
        className="mb-0"
      />

      {ehPrescricao ? (
        <div className="flex items-start gap-2 px-1">
          <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estes números são a receita do seu tratamento e são eles que ligam os
            avisos do aplicativo. Por isso só o seu médico pode mudá-los.
          </p>
        </div>
      ) : (
        // Sem médico vinculado (ou linha só de referência, plantada pelo próprio
        // app): dizer "seu médico definiu" seria inventar um médico. Isso não é
        // preciosismo — é a diferença entre referência e prescrição.
        <AvisoDaTela tom="atencao">
          Você ainda não tem um médico acompanhando por aqui. Os números abaixo
          são <b>valores de referência gerais</b>, e não uma receita feita para
          você. Quando um cardiologista assumir o seu acompanhamento, ele define
          os seus.
          {ehSugestao ? "" : " Enquanto isso, eles servem só para você se situar."}
        </AvisoDaTela>
      )}

      <div className="space-y-3">
        {metasClinicas.map((m) => (
          <MetaClinicaCard
            key={m.label}
            meta={m}
            onPedir={medico ? () => abrirPedido(m) : undefined}
          />
        ))}

        {!medico && (
          <p className="text-sm text-muted-foreground px-1 leading-relaxed">
            Quando você estiver vinculado a um cardiologista, aparece aqui um botão
            para pedir uma conversa sobre qualquer uma destas metas.
          </p>
        )}
      </div>

      {/* ── 2. O que eu combinei comigo ─────────────────────────────── */}
      <TituloSecao
        titulo="O que eu combinei comigo"
        icone={HeartHandshake}
        subtitulo={metas?.updated_at ? `guardado em ${fmtData(metas.updated_at)}` : "ainda não combinado"}
        className="mb-0 mt-2"
      />

      <div className="flex items-start gap-2 px-1">
        <PenLine className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
        <p className="text-sm text-muted-foreground leading-relaxed">
          Estes são seus. Nada aqui vira aviso nem cobrança — é o que você resolveu
          tentar. Seu médico consegue ver, e isso ajuda na consulta.
        </p>
      </div>

      <div className="space-y-3">
        {CAMPOS.map((campo) => (
          <CombinadoCard
            key={campo.chave}
            campo={campo}
            valor={(rascunho[campo.chave] as number | null) ?? null}
            atual={atualPorCampo[campo.chave]}
            referenciaMedico={referenciaPorCampo[campo.chave]}
            onChange={(v) => {
              setTocado(true);
              setRascunho((r) => ({ ...r, [campo.chave]: v }));
            }}
          />
        ))}

        <SurfaceCard>
          <div className="flex items-start gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <PenLine className="h-5 w-5 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground leading-tight">Meu recado para mim</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                escreva do seu jeito o que você combinou — ex.: “caminhar até a padaria de manhã”
              </p>
            </div>
          </div>
          <Textarea
            value={rascunho.observacao ?? ""}
            onChange={(e) => {
              setTocado(true);
              const v = e.target.value;
              setRascunho((r) => ({ ...r, observacao: v.trim() === "" ? null : v }));
            }}
            placeholder="Escreva aqui..."
            aria-label="Meu recado para mim"
            className="min-h-[96px] rounded-xl text-base"
          />
        </SurfaceCard>
      </div>

      <Button
        size="xl"
        className="w-full"
        disabled={!mudou || salvar.isPending}
        onClick={() => {
          salvar.mutate(rascunho, { onSuccess: () => setTocado(false) });
        }}
      >
        <Save className="h-5 w-5" />
        {salvar.isPending ? "Guardando…" : "Guardar meu combinado"}
      </Button>
      {!mudou && (
        <p className="text-center text-sm text-muted-foreground">
          Tudo já está guardado.
        </p>
      )}

      {/* ── Pedir conversa sobre uma meta do médico ─────────────────── */}
      <Dialog open={!!pedido} onOpenChange={(o) => { if (!o) setPedido(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Falar sobre esta meta
            </DialogTitle>
            <DialogDescription>
              {pedido
                ? `Você vai enviar uma mensagem ao seu médico sobre "${pedido.label}" (hoje em ${pedido.alvo}). Quem decide se o número muda é ele — esta mensagem abre a conversa.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={textoPedido}
            onChange={(e) => setTextoPedido(e.target.value)}
            className="min-h-[132px] rounded-xl text-base"
            aria-label="Mensagem para o médico"
          />

          <DialogFooter className="gap-2">
            <Button variant="ghost" className="min-h-[48px]" onClick={() => setPedido(null)}>
              Cancelar
            </Button>
            <Button
              className="min-h-[48px]"
              disabled={!textoPedido.trim() || enviar.isPending}
              onClick={enviarPedido}
            >
              <Target className="h-4 w-4" />
              {enviar.isPending ? "Enviando…" : "Enviar e abrir a conversa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TelaPaciente>
  );
}
