/**
 * GLICEMIA — a tela que faltava (a tabela e o hook já existiam).
 *
 * Por que glicemia tem tela num app de cardiologia: diabetes é o comorbidade
 * que mais muda a conduta cardiológica — alvo de LDL, escolha de anti-
 * hipertensivo, indicação de iSGLT2. `glucose_readings` e `useGlucose` já
 * estavam prontos desde o baseline; faltava o lugar onde o paciente digita.
 * Até aqui o dado só entrava por importação, ou seja, quase nunca.
 *
 * ══════════════════════════════════════════════════════════════════════
 * REGRA CLÍNICA INEGOCIÁVEL desta tela
 * ══════════════════════════════════════════════════════════════════════
 * A tela NÃO interpreta o número e NÃO sugere conduta. Ela não diz "sua
 * glicemia está alta", não diz "controlada", não classifica em pré-diabetes,
 * não manda comer, não manda corrigir com insulina, não sugere dose.
 *
 * O único julgamento que ela faz é sobre PARA QUEM AVISAR, e ele é
 * deliberadamente grosseiro e conservador:
 *   - valor muito baixo  → orientação de procurar atendimento agora;
 *   - valor fora da faixa de tranquilidade → "avise seu médico";
 *   - dentro da faixa    → nenhum comentário sobre o número. Nenhum.
 *
 * As faixas abaixo NÃO são critério diagnóstico e não estão aqui para
 * classificar ninguém: são um gatilho de encaminhamento. É por isso que o
 * texto nunca nomeia o achado ("hipoglicemia", "hiperglicemia") — nomear já
 * seria dar diagnóstico, e diagnóstico é do médico.
 *
 * Modelo de tela: PesoPage (registro rápido → último valor → histórico).
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nada dos limiares, nada dos textos. O bloco "muito baixo" continua sendo o
 * único vermelho da tela e continua com o botão de ligar em cima de tudo;
 * ele só passou a usar o desenho de aviso comum, para não ser mais um
 * retângulo vermelho diferente dos outros retângulos vermelhos do app.
 *
 * ── O que a auditoria de DESKTOP (setembro/2026) mudou ────────────────
 * Nada de limiar, faixa, texto clínico ou encaminhamento. Mudou:
 *
 *  · Duas colunas a partir de `xl`: registrar e ler o último valor à
 *    esquerda, histórico e pontes à direita (a tela usava 768px de 1188 e
 *    deixava o resto em branco).
 *
 *  · O histórico parava em 14 linhas sem dizer que parava. Ganhou período
 *    (7/30/90), a contagem real do período e o aviso de `truncado`.
 *
 *  · O aviso de "avise seu médico" ganhou o caminho até ele. A frase é a
 *    mesma; o que faltava era a porta.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from "react";
import { CalendarDays, Droplet, FlaskConical, MessageCircle, Phone } from "lucide-react";
import { PageHeader, SurfaceCard, EmptyState, PageLoader } from "@/components/shell";
import {
  TelaPaciente, TituloSecao, Formulario, Campo, OpcaoBotao, GradeOpcoes,
  Lista, ItemLista, AvisoDaTela, LayoutPainel,
  SeletorPeriodo, CoberturaDoPeriodo, Ponte, type PeriodoDias,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useGlucose } from "@/hooks/useCardioReadings";
import { EMERGENCIA_TELEFONE } from "@/lib/config";
import type { GlucoseReading } from "@/types/cardio";

type Contexto = GlucoseReading["context"];

/**
 * Os contextos são exatamente os quatro que o banco aceita — o check
 * constraint de `glucose_readings` é `context in
 * ('fasting','post_meal','random','bedtime')`.
 *
 * Nota de escopo: "antes da refeição" (pré-prandial) foi pedido no desenho da
 * tela, mas não existe como valor permitido no schema; inserir esse contexto
 * hoje seria rejeitado pelo Postgres. Em vez de escondê-lo dentro de "outro
 * momento" — o que faria o médico ler um pré-prandial como medida avulsa — a
 * opção fica de fora até a migração acrescentar 'pre_meal'. "Em jejum" ganhou
 * a explicação entre parênteses para que quem mede antes de comer de manhã
 * não escolha errado.
 */
const CONTEXTOS: { valor: Contexto; label: string; ajuda: string }[] = [
  { valor: "fasting",   label: "Em jejum",             ajuda: "de manhã, antes de comer qualquer coisa" },
  { valor: "post_meal", label: "Depois da refeição",   ajuda: "cerca de 2 horas depois de comer" },
  { valor: "bedtime",   label: "Antes de dormir",      ajuda: "na hora de deitar" },
  { valor: "random",    label: "Outro momento",        ajuda: "qualquer outra hora do dia" },
];

const CONTEXTO_LABEL: Record<Contexto, string> = {
  fasting: "Em jejum",
  post_meal: "Depois da refeição",
  bedtime: "Antes de dormir",
  random: "Outro momento",
};

/** Limites do próprio campo no banco (`value between 20 and 700`). */
const MIN_VALIDO = 20;
const MAX_VALIDO = 700;

/**
 * Gatilho de encaminhamento — não é classificação clínica.
 *
 * `atendimento`: valor muito baixo. É o único caso em que o app tira o
 * paciente da tela e manda procurar ajuda, porque hipoglicemia grave é
 * questão de minutos e esperar retorno do consultório não serve.
 *
 * `medico`: qualquer coisa fora de uma faixa larga de tranquilidade. A faixa
 * é larga de propósito: aviso que dispara toda hora vira ruído, o paciente
 * para de ler e o aviso que importa passa batido junto.
 */
type Encaminhamento = "atendimento" | "medico" | null;

function encaminhamento(valor: number, contexto: Contexto): Encaminhamento {
  if (valor < 70) return "atendimento";
  // Depois de comer o número sobe por fisiologia normal, então o gatilho sobe
  // junto — senão a tela avisaria o médico todo dia sobre gente que está bem.
  const teto = contexto === "post_meal" ? 250 : 180;
  if (valor > teto) return "medico";
  return null;
}

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function dataHora(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function GlicemiaPage() {
  const { readings, registrar, isLoading, cobertura } = useGlucose();
  const [valor, setValor] = useState("");
  const [contexto, setContexto] = useState<Contexto>("fasting");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Recorte de EXIBIÇÃO: a janela pedida ao hook continua a padrão (90 dias).
  const [periodo, setPeriodo] = useState<PeriodoDias>(30);
  const [mostrarTudo, setMostrarTudo] = useState(false);

  const lista = (readings ?? []) as GlucoseReading[];
  const ultimo = lista[0] ?? null;

  /**
   * O aviso é calculado sobre a ÚLTIMA medida registrada, não sobre o que está
   * sendo digitado: enquanto a pessoa digita "1" de "120" o app não pode
   * gritar "procure atendimento".
   */
  const aviso = useMemo(
    () => (ultimo ? encaminhamento(Number(ultimo.value), ultimo.context) : null),
    [ultimo]
  );

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!Number.isFinite(v) || v < MIN_VALIDO || v > MAX_VALIDO) {
      // Mensagem de digitação, não de clínica: fala do aparelho, não do corpo.
      const msg = `Digite um valor entre ${MIN_VALIDO} e ${MAX_VALIDO} mg/dL, como aparece no aparelho.`;
      setErro(msg);
      toast.error(msg);
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await (registrar as any).mutateAsync({ value: Math.round(v), context: contexto });
      setValor("");
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <PageLoader />;

  const doPeriodo = lista.filter(
    (r) => new Date(r.recorded_at).getTime() >= Date.now() - periodo * 86400000
  );
  const PRIMEIRAS = 14;
  const visiveis = mostrarTudo ? doPeriodo : doPeriodo.slice(0, PRIMEIRAS);

  /* ── Registro rápido ───────────────────────────────────────── */
  const registro = (
    <SurfaceCard>
      <Formulario>
        <Campo rotulo="Glicemia agora" para="glicemia" erro={erro}>
          <div className="flex items-center gap-2">
            <Input
              id="glicemia"
              inputMode="numeric"
              value={valor}
              onChange={(e) => { setValor(e.target.value.replace(/[^\d]/g, "")); if (erro) setErro(null); }}
              placeholder="102"
              className="h-14 text-2xl font-semibold tabular-nums text-center"
            />
            <span className="text-base text-muted-foreground w-16 shrink-0">mg/dL</span>
          </div>
        </Campo>

        {/* Contexto: sem ele o número não serve para o médico — 180 em jejum e
            180 depois de comer são conversas diferentes. Botão em vez de select
            porque são quatro opções e a tela é de registro rápido. */}
        <fieldset className="mt-4">
          <legend className="text-base font-medium text-foreground">Quando você mediu?</legend>
          <GradeOpcoes className="mt-2">
            {CONTEXTOS.map((c) => (
              <OpcaoBotao
                key={c.valor}
                selecionado={contexto === c.valor}
                onClick={() => setContexto(c.valor)}
                titulo={c.label}
                descricao={c.ajuda}
              />
            ))}
          </GradeOpcoes>
        </fieldset>

        <Button onClick={salvar} disabled={salvando} size="xl" className="w-full mt-4">
          {salvando ? "Salvando…" : "Registrar glicemia"}
        </Button>
      </Formulario>
    </SurfaceCard>
  );

  /* ── Último valor ──────────────────────────────────────────── */
  const ultimoCard = ultimo ? (
    <SurfaceCard>
      <div className="flex items-baseline justify-between">
        <div>
          {/* O número aparece cru, sem cor de semáforo e sem adjetivo.
              Colorir por faixa já seria interpretar. */}
          <p className="text-3xl font-semibold tabular-nums">
            {Number(ultimo.value)} <span className="text-lg font-normal text-muted-foreground">mg/dL</span>
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {CONTEXTO_LABEL[ultimo.context]} · {dataHora(ultimo.recorded_at)}
          </p>
        </div>
      </div>

      {aviso === "atendimento" ? (
        <AvisoDaTela tom="grave" titulo="Esse valor está muito baixo." className="mt-4">
          <p>
            Não fique sozinho e não espere passar. Procure atendimento agora — se estiver
            confuso, tremendo, suando frio ou se sentindo mal, ligue para o {EMERGENCIA_TELEFONE}.
          </p>
          <a
            href={`tel:${EMERGENCIA_TELEFONE}`}
            className="mt-3 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-error text-white text-lg font-semibold"
          >
            <Phone className="h-5 w-5" aria-hidden /> Ligar {EMERGENCIA_TELEFONE}
          </a>
        </AvisoDaTela>
      ) : aviso === "medico" ? (
        <AvisoDaTela tom="atencao" className="mt-4">
          Esse valor está fora da faixa em que o app fica quieto.{" "}
          <strong>Avise seu médico</strong> — quem diz o que esse número significa para o seu
          tratamento é ele, não o aplicativo.
          {/* "Avise seu médico" precisava de um lugar para ir. O texto acima é
              o mesmo; o que faltava era a porta. */}
          <Ponte
            para="/medico"
            icone={MessageCircle}
            titulo="Falar com meu médico"
            detalhe="Mandar uma mensagem para a equipe que te acompanha"
            className="mt-3 bg-card"
          />
        </AvisoDaTela>
      ) : (
        // Dentro da faixa: o app registra e cala. Um "tudo certo!" aqui
        // seria interpretação — e seria interpretação errada num paciente
        // cuja meta o médico pode ter colocado em outro lugar.
        <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
          Registrado. Seu médico vê esse valor junto com os outros no acompanhamento.
        </p>
      )}
    </SurfaceCard>
  ) : (
    <EmptyState
      icon={Droplet}
      title="Nenhuma glicemia registrada ainda"
      description="Registre a primeira e o histórico começa a aparecer aqui para você mostrar na consulta."
      variant="card"
      actionLabel="Registrar a primeira medida"
      onAction={() => document.getElementById("glicemia")?.focus()}
    />
  );

  /* ── Histórico ─────────────────────────────────────────────── */
  const historico = lista.length > 1 ? (
    <SurfaceCard>
      <TituloSecao titulo="Meus registros" />
      <SeletorPeriodo valor={periodo} onMudar={(d) => { setPeriodo(d); setMostrarTudo(false); }} className="mb-3" />
      {doPeriodo.length === 0 ? (
        <p className="text-base text-muted-foreground leading-relaxed">
          Nenhuma medida nesse período. Escolha um período maior.
        </p>
      ) : (
        <Lista>
          {visiveis.map((r) => (
            <ItemLista key={r.id}>
              <div className="min-w-0">
                <span className="text-base text-muted-foreground">{dataCurta(r.recorded_at)}</span>
                <span className="text-sm text-muted-foreground/80 ml-2">{CONTEXTO_LABEL[r.context]}</span>
              </div>
              {/* Sem cor por faixa também no histórico: uma coluna colorida
                  é um laudo visual, e o app não dá laudo. */}
              <span className="text-base font-semibold tabular-nums shrink-0">
                {Number(r.value)} mg/dL
              </span>
            </ItemLista>
          ))}
        </Lista>
      )}
      {!mostrarTudo && doPeriodo.length > PRIMEIRAS ? (
        <Button variant="outline" size="lg" className="w-full mt-3" onClick={() => setMostrarTudo(true)}>
          Mostrar as {doPeriodo.length} medidas do período
        </Button>
      ) : null}
      <CoberturaDoPeriodo
        className="mt-3"
        quantidade={doPeriodo.length}
        dias={periodo}
        truncado={cobertura.truncado}
      />
    </SurfaceCard>
  ) : null;

  const pontes = (
    <section>
      <TituloSecao titulo="Onde isso entra" />
      <div className="space-y-2">
        <Ponte
          para="/exames"
          icone={FlaskConical}
          titulo="Meus exames"
          detalhe="Hemoglobina glicada e o resto do laboratório"
        />
        <Ponte
          para="/meu-mes"
          icone={CalendarDays}
          titulo="Levar para a consulta"
          detalhe="O resumo do mês que você mostra para o seu médico"
        />
      </div>
    </section>
  );

  return (
    <TelaPaciente largura="painel">
      <PageHeader
        title="Glicemia"
        subtitle="Anote o número como ele aparece no aparelho, sem arredondar."
      />

      {/* Registrar e ler o último valor à esquerda; histórico e pontes à
          direita. Abaixo de `xl` vira uma coluna, na mesma ordem. */}
      <LayoutPainel
        principal={
          <>
            {registro}
            {ultimoCard}
            <p className="text-sm text-muted-foreground px-1 leading-relaxed">
              O Encorpei Cardio guarda e organiza seus registros. Ele não interpreta glicemia, não
              ajusta remédio e não substitui a consulta.
            </p>
          </>
        }
        apoio={<>{historico}{pontes}</>}
      />
    </TelaPaciente>
  );
}
