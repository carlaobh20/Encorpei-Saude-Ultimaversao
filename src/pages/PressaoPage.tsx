/**
 * PressaoPage — pressão arterial e coração.
 *
 * Registro grande de pressão, gráfico de 30 dias com a faixa-alvo, média de
 * MRPA (só medidas válidas de manguito — ver docs §4), histórico com badge
 * de proveniência, e frequência cardíaca de repouso.
 *
 * ── O que esta passada visual mudou (e só isso) ───────────────────────
 * Nenhum limiar, nenhuma conta, nenhum texto clínico. O que mudou:
 *
 *  · O formulário deixou de herdar a largura da tela. Num monitor de 1440px
 *    os campos "Sistólica" e "Diastólica" viravam duas faixas de 600px com
 *    três dígitos no meio — o olho percorre meia tela entre o rótulo e o que
 *    ele acabou de digitar, e é exatamente aí que se erra a linha.
 *
 *  · Os rótulos saíram de `text-xs` (13px na escala do paciente) para o
 *    corpo de 17px do `Campo`. Rótulo de formulário é a instrução: encolhê-lo
 *    para caber mais campo é economizar no lugar errado.
 *
 *  · UM botão azul por tela. "Salvar pressão" continua azul cheio; os dois
 *    botões de "mediu com aparelho de braço?" viraram `OpcaoBotao`, que é
 *    escolha e não ação — antes o "Sim" ficava azul cheio quando marcado e
 *    competia com o Salvar logo abaixo.
 *
 *  · Os dois gráficos passaram à paleta e às peças comuns (`shell/Grafico`):
 *    eixo com unidade, tick de 13px em vez de 10px, legenda em texto, e
 *    animação desligada sob `prefers-reduced-motion`.
 *
 * A faixa-alvo do gráfico continua vindo de `useTargets()` e continua sendo
 * desenhada do mesmo jeito: é referência do médico, não juízo do app.
 *
 * ══════════════════════════════════════════════════════════════════════
 * O que a auditoria de DESKTOP (setembro/2026) mudou — e nada mais
 * ══════════════════════════════════════════════════════════════════════
 *
 * 1) DUAS COLUNAS A PARTIR DE `xl`. Em 1440px o `<main>` tem 1188px e a
 *    coluna de leitura ocupava 768, começando em x=462: ~420px de branco à
 *    direita, com a página somando 3142px de altura. Agora o que se FAZ
 *    (registrar, e o que o registro produz — média, gráficos) fica à
 *    esquerda, e o que se CONSULTA (histórico, cobertura, pontes) à direita.
 *    Abaixo de `xl` o `LayoutPainel` empilha na mesma ordem: o celular não
 *    muda em nada.
 *
 * 2) O BOTÃO DEIXOU DE NASCER MORTO. "Salvar pressão" ficava `disabled` com
 *    sistólica e diastólica preenchidas, sem `title`, sem `aria-disabled`,
 *    sem marca de campo obrigatório — e só destravava depois de uma escolha
 *    que vinha DEPOIS de um parágrafo longo. Para a ação central do app,
 *    isso é um beco. Agora o botão está sempre ativo e a validação diz o que
 *    falta, no campo que falta, levando o foco até ele; a pergunta do
 *    manguito ganhou a marca "obrigatório" ANTES do parágrafo, e o parágrafo
 *    desceu para depois das opções — a instrução longa explica a escolha,
 *    não deve atrasá-la. O texto do parágrafo é o mesmo, palavra por palavra.
 *
 * 3) O HISTÓRICO DEIXOU DE PARAR EM 12. Havia exatamente doze linhas e nada
 *    dizendo que existiam mais — na consulta, o paciente precisa do mês. Há
 *    período (7/30/90), a contagem real do período e o aviso de `truncado`
 *    da `Cobertura` que o hook já devolvia e ninguém lia.
 *
 * 4) A TELA DEIXOU DE ACABAR NO NADA: pontes para "minha evolução" e para o
 *    resumo que se leva à consulta.
 */
import { useMemo, useRef, useState } from "react";
import { CalendarDays, Gauge, HeartPulse, Heart, Info } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, ReferenceArea,
} from "recharts";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, Formulario, Campo, OpcaoBotao, GradeOpcoes,
  AreaGrafico, LegendaGrafico, NotaGrafico, usePrefereMenosMovimento,
  gradeGrafico, eixoX, eixoY, dicaGrafico, COR_SERIE, COR_SERIE_APOIO,
  LayoutPainel, SeletorPeriodo, CoberturaDoPeriodo, Ponte, ObrigatorioMarca,
  type PeriodoDias,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useBloodPressure, useHeartRate } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { mediaMrpa } from "@/lib/clinical/cardioRiskEngine";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import type { BpContext } from "@/types/cardio";

const CONTEXTO_LABEL: Record<BpContext, string> = {
  morning: "Manhã",
  evening: "Noite",
  random: "Outro horário",
  symptom: "Por sintoma",
  office: "No consultório",
};

function fmtDia(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtDiaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " · " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function PressaoPage() {
  const bp = useBloodPressure();
  const hr = useHeartRate();
  const { targets, isLoading: loadingTargets } = useTargets();
  const reduzirMovimento = usePrefereMenosMovimento();

  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [context, setContext] = useState<BpContext>("morning");
  const [arm, setArm] = useState<"left" | "right">("right");
  const [cuffValidated, setCuffValidated] = useState<boolean | null>(null);

  // Validação só aparece DEPOIS de a pessoa tentar salvar. Campo que já nasce
  // vermelho é acusação antes de erro, e num formulário de três campos isso
  // basta para o paciente achar que fez algo errado antes de digitar.
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const refSistolica = useRef<HTMLInputElement>(null);
  const refDiastolica = useRef<HTMLInputElement>(null);
  const refManguito = useRef<HTMLDivElement>(null);

  // Período do histórico. NÃO muda a janela pedida ao hook (que continua no
  // padrão de 90 dias, o mesmo que alimenta a média de MRPA e os gráficos):
  // é recorte de EXIBIÇÃO. Mexer na janela do hook aqui mudaria o conjunto
  // sobre o qual `mediaMrpa` é calculada, e conta clínica não é assunto de
  // uma passada visual.
  const [periodo, setPeriodo] = useState<PeriodoDias>(30);
  const [mostrarTudo, setMostrarTudo] = useState(false);

  const isLoading = bp.isLoading || loadingTargets;

  const chartData30d = useMemo(() => {
    const corte = Date.now() - 30 * 86_400_000;
    return [...bp.readings]
      .filter((r) => r.cuff_validated && +new Date(r.recorded_at) >= corte)
      .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at))
      .map((r) => ({ dia: fmtDia(r.recorded_at), sistolica: r.systolic, diastolica: r.diastolic }));
  }, [bp.readings]);

  const mrpa = useMemo(() => mediaMrpa(bp.readings, new Date(), 7), [bp.readings]);

  const hrChartData = useMemo(() => {
    const corte = Date.now() - 30 * 86_400_000;
    return [...hr.repouso]
      .filter((r) => +new Date(r.recorded_at) >= corte)
      .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at))
      .map((r) => ({ dia: fmtDia(r.recorded_at), bpm: r.bpm }));
  }, [hr.repouso]);

  const leiturasDoPeriodo = useMemo(() => {
    const corte = Date.now() - periodo * 86_400_000;
    return bp.readings.filter((r) => +new Date(r.recorded_at) >= corte);
  }, [bp.readings, periodo]);

  const PRIMEIRAS = 12;
  const leiturasVisiveis = mostrarTudo ? leiturasDoPeriodo : leiturasDoPeriodo.slice(0, PRIMEIRAS);

  // Cada pendência é uma FRASE do que falta, não um booleano: é o texto que o
  // paciente lê ao lado do campo, e é o mesmo que decide para onde vai o foco.
  const faltaSistolica = systolic.trim() === "" ? "Digite o número maior." : null;
  const faltaDiastolica = diastolic.trim() === "" ? "Digite o número menor." : null;
  const faltaManguito =
    cuffValidated === null ? "Escolha uma das duas opções acima para eu poder salvar." : null;
  const completo = !faltaSistolica && !faltaDiastolica && !faltaManguito;

  const salvar = () => {
    if (!completo) {
      // Nada de botão morto e silencioso: a tentativa liga as mensagens e
      // leva o foco ao primeiro campo que falta — que pode estar abaixo da
      // dobra, e é justamente o caso do manguito.
      setTentouSalvar(true);
      if (faltaSistolica) refSistolica.current?.focus();
      else if (faltaDiastolica) refDiastolica.current?.focus();
      else refManguito.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    setTentouSalvar(false);
    bp.registrar.mutate({
      systolic: Number(systolic),
      diastolic: Number(diastolic),
      pulse: pulse.trim() ? Number(pulse) : null,
      context,
      arm,
      cuff_validated: cuffValidated!,
    });
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setCuffValidated(null);
  };

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Pressão e coração" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  const formulario = (
    <SurfaceCard>
      <TituloSecao titulo="Registrar pressão" icone={Gauge} />
      {/* `Formulario` segura a largura em 2xl mesmo dentro de um cartão que
          ocupa a coluna toda — é o campo que precisa de teto, não o cartão.
          Vale ainda mais na coluna larga do desktop: sem ele, "Sistólica"
          voltaria a ser uma faixa de 900px com três dígitos no meio. */}
      <Formulario className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Campo
              rotulo={<>Sistólica <ObrigatorioMarca /></>}
              ajuda="o número maior"
              para="sistolica"
              erro={tentouSalvar ? faltaSistolica : null}
            >
              <Input
                ref={refSistolica}
                id="sistolica" inputMode="numeric" placeholder="ex.: 128" value={systolic}
                aria-required
                aria-invalid={tentouSalvar && !!faltaSistolica}
                onChange={(e) => setSystolic(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-2xl font-bold text-center tabular-nums"
              />
            </Campo>
            <Campo
              rotulo={<>Diastólica <ObrigatorioMarca /></>}
              ajuda="o número menor"
              para="diastolica"
              erro={tentouSalvar ? faltaDiastolica : null}
            >
              <Input
                ref={refDiastolica}
                id="diastolica" inputMode="numeric" placeholder="ex.: 82" value={diastolic}
                aria-required
                aria-invalid={tentouSalvar && !!faltaDiastolica}
                onChange={(e) => setDiastolic(e.target.value.replace(/\D/g, ""))}
                className="h-14 text-2xl font-bold text-center tabular-nums"
              />
            </Campo>
          </div>

          <Campo rotulo="Pulso" ajuda="opcional" para="pulso">
            <Input
              id="pulso" inputMode="numeric" placeholder="ex.: 70" value={pulse}
              onChange={(e) => setPulse(e.target.value.replace(/\D/g, ""))}
              className="tabular-nums"
            />
          </Campo>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
            <Campo rotulo="Quando mediu">
              <Select value={context} onValueChange={(v) => setContext(v as BpContext)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(CONTEXTO_LABEL) as BpContext[]).map((c) => (
                    <SelectItem key={c} value={c}>{CONTEXTO_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Braço">
              <Select value={arm} onValueChange={(v) => setArm(v as "left" | "right")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Direito</SelectItem>
                  <SelectItem value="left">Esquerdo</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>

          {/* Escolha, não ação: por isso `OpcaoBotao` e não dois `Button`. O
              azul cheio desta tela é do "Salvar pressão", e é um só.

              A marca "obrigatório" vem ANTES do parágrafo e o parágrafo desceu
              para DEPOIS das opções. Era esta a armadilha: o paciente
              preenchia os dois números, encontrava um bloco de texto, parava
              de ler, e o botão continuava cinza sem explicar por quê. A
              instrução não sumiu nem mudou uma palavra — ela deixou de ficar
              no caminho da escolha que descreve. */}
          <div ref={refManguito}>
            <Campo
              rotulo={<>Você mediu com aparelho de braço? <ObrigatorioMarca /></>}
              erro={tentouSalvar ? faltaManguito : null}
            >
              <GradeOpcoes>
                <OpcaoBotao
                  selecionado={cuffValidated === true}
                  onClick={() => setCuffValidated(true)}
                  titulo="Sim, aparelho de braço"
                />
                <OpcaoBotao
                  selecionado={cuffValidated === false}
                  onClick={() => setCuffValidated(false)}
                  titulo="Não / outro tipo"
                />
              </GradeOpcoes>
              <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground leading-relaxed">
                <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                Só a medida com aparelho de braço entra na média que seu médico usa e pode gerar alerta — aparelho de pulso ou de dedo não é confiável para isso.
              </p>
            </Campo>
          </div>

          {/* Sempre habilitado (menos enquanto salva). Botão que não responde
              ao clique não tem como explicar o que falta; botão que responde
              tem. `aria-disabled` continua anunciando o estado de pendência
              para quem usa leitor de tela, sem tirar o clique de ninguém. */}
          <Button
            size="xl"
            className="w-full"
            aria-disabled={!completo}
            disabled={bp.registrar.isPending}
            title={completo ? undefined : "Falta preencher: " + [
              faltaSistolica && "sistólica",
              faltaDiastolica && "diastólica",
              faltaManguito && "se mediu com aparelho de braço",
            ].filter(Boolean).join(", ")}
            onClick={salvar}
          >
            {bp.registrar.isPending ? "Salvando..." : "Salvar pressão"}
          </Button>
        </Formulario>
      </SurfaceCard>
  );

  const mediaCard = (
    <SurfaceCard className="bg-cardio-50 border-0">
      <p className="text-sm font-bold uppercase tracking-wide text-primary mb-1">Média dos últimos 7 dias</p>
      {mrpa ? (
        <>
          <p className="text-3xl font-bold text-foreground tabular-nums">{mrpa.systolic}/{mrpa.diastolic} <span className="text-base font-normal text-muted-foreground">mmHg</span></p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">Calculada com {mrpa.n} medida{mrpa.n > 1 ? "s" : ""} válida{mrpa.n > 1 ? "s" : ""} de manhã e à noite, com manguito.</p>
        </>
      ) : (
        <p className="text-base text-muted-foreground leading-relaxed">Ainda não há medidas suficientes (mínimo 2, de manhã ou à noite, com aparelho de braço) para calcular a média.</p>
      )}
    </SurfaceCard>
  );

  const graficoPressao = (
    <section>
      <TituloSecao titulo="Últimos 30 dias" subtitulo="faixa em verde é o seu alvo" />
      {chartData30d.length === 0 ? (
        <EmptyState icon={Gauge} title="Sem medidas ainda" description="Registre sua pressão para ver o gráfico." variant="card" />
      ) : (
        <SurfaceCard>
          <AreaGrafico altura={220}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData30d} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                {gradeGrafico()}
                {eixoX("dia")}
                {eixoY({ unidade: "mmHg", dominio: ["dataMin - 10", "dataMax + 10"] })}
                <ReferenceArea y1={0} y2={targets.bp_diastolic_max} fill="hsl(var(--success))" fillOpacity={0.06} ifOverflow="extendDomain" />
                <ReferenceArea y1={0} y2={targets.bp_systolic_max} fill="hsl(var(--success))" fillOpacity={0.06} ifOverflow="extendDomain" />
                {dicaGrafico((v: never, nome: string) => [`${v} mmHg`, nome])}
                <Line
                  type="monotone" dataKey="sistolica" name="Sistólica"
                  stroke={COR_SERIE} strokeWidth={2.5} dot={false}
                  isAnimationActive={!reduzirMovimento}
                />
                <Line
                  type="monotone" dataKey="diastolica" name="Diastólica"
                  stroke={COR_SERIE_APOIO} strokeWidth={2.5} dot={false}
                  isAnimationActive={!reduzirMovimento}
                />
              </LineChart>
            </ResponsiveContainer>
          </AreaGrafico>
          <LegendaGrafico
            itens={[
              { cor: COR_SERIE, rotulo: "Sistólica (o número maior)" },
              { cor: COR_SERIE_APOIO, rotulo: "Diastólica (o número menor)" },
            ]}
          />
        </SurfaceCard>
      )}
    </section>
  );

  const graficoBatimentos = (
    <section>
      <TituloSecao titulo="Batimentos de repouso" icone={HeartPulse} />
      {hrChartData.length === 0 ? (
        <EmptyState icon={HeartPulse} title="Sem dados de batimentos" description="Conecte a pulseira ou registre manualmente." variant="card" />
      ) : (
        <SurfaceCard>
          <AreaGrafico altura={180}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hrChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                {gradeGrafico()}
                {eixoX("dia")}
                {eixoY({ unidade: "bpm", dominio: ["dataMin - 10", "dataMax + 10"] })}
                {dicaGrafico((v: never) => [`${v} bpm`, "Batimentos"])}
                <Line
                  type="monotone" dataKey="bpm" name="Batimentos"
                  stroke={COR_SERIE} strokeWidth={2.5} dot={false}
                  isAnimationActive={!reduzirMovimento}
                />
              </LineChart>
            </ResponsiveContainer>
          </AreaGrafico>
          <LegendaGrafico itens={[{ cor: COR_SERIE, rotulo: "Batimentos de repouso" }]} />
        </SurfaceCard>
      )}
      <NotaGrafico>
        Variabilidade de batimentos (HRV) aparece aqui quando sua pulseira envia esse dado.
      </NotaGrafico>
    </section>
  );

  /**
   * Histórico — a coluna de consulta.
   *
   * Deixou de ser "as 12 primeiras e ponto". O período escolhido recorta a
   * lista; a contagem embaixo diz quantas medidas o período tem de verdade; e
   * "mostrar todas" abre o resto em vez de fingir que não existe. O aviso de
   * `truncado` vem da `Cobertura` do hook — enquanto ele estiver ligado, nem
   * a lista nem a contagem são o total, e a tela diz isso.
   */
  const historico = (
    <section>
      <TituloSecao titulo="Minhas leituras" />
      <SeletorPeriodo valor={periodo} onMudar={(d) => { setPeriodo(d); setMostrarTudo(false); }} className="mb-3" />
      {leiturasDoPeriodo.length === 0 ? (
        <EmptyState icon={Gauge} title="Nenhuma leitura no período" description="Escolha um período maior ou registre uma medida." variant="card" />
      ) : (
        <div className="space-y-2.5">
          {leiturasVisiveis.map((r) => {
            const prov = rotuloProveniencia(r.source_type, r.validation_status, r.source_device_name);
            return (
              <SurfaceCard key={r.id} className={cn("flex items-center justify-between gap-3", prov.tone === "warning" && "opacity-70")}>
                <div className="min-w-0">
                  <p className={cn("text-lg font-bold tabular-nums", prov.tone === "warning" ? "text-muted-foreground" : "text-foreground")}>
                    {r.systolic}/{r.diastolic} <span className="text-sm font-normal text-muted-foreground">mmHg</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{fmtDiaHora(r.recorded_at)} · {CONTEXTO_LABEL[r.context]}</p>
                </div>
                <span className={cn(
                  "text-xs font-bold uppercase tracking-wide rounded-full px-2.5 py-1 shrink-0",
                  prov.tone === "warning" ? "bg-muted text-muted-foreground" : "bg-cardio-50 text-primary"
                )}>
                  {prov.label}
                </span>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {!mostrarTudo && leiturasDoPeriodo.length > PRIMEIRAS ? (
        <Button variant="outline" size="lg" className="w-full mt-3" onClick={() => setMostrarTudo(true)}>
          Mostrar as {leiturasDoPeriodo.length} leituras do período
        </Button>
      ) : null}

      <CoberturaDoPeriodo
        className="mt-3"
        quantidade={leiturasDoPeriodo.length}
        dias={periodo}
        truncado={bp.cobertura.truncado}
      />

      <NotaGrafico className="flex items-start gap-1.5">
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        Leituras em cinza são estimativas da pulseira — não usadas para decisão clínica.
      </NotaGrafico>
    </section>
  );

  /**
   * Pontes. A tela respondia "quanto deu hoje" e parava; estas duas linhas
   * respondem "e daí?" com os dois destinos que o paciente realmente procura
   * depois de medir — ver se está melhorando, e levar isso para a consulta.
   */
  const pontes = (
    <section>
      <TituloSecao titulo="Depois de medir" />
      <div className="space-y-2">
        <Ponte
          para="/meu-coracao"
          icone={Heart}
          titulo="Ver minha evolução"
          detalhe="Quantas medidas ficaram na meta, semana a semana"
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
      <PageHeader title="Pressão e coração" subtitle="Registre e acompanhe sua pressão" />

      {/* O que se FAZ à esquerda (registrar, e o que o registro produz);
          o que se CONSULTA à direita. Abaixo de `xl` vira uma coluna só, na
          mesma ordem — o celular continua exatamente como estava. */}
      <LayoutPainel
        principal={<>{formulario}{mediaCard}{graficoPressao}{graficoBatimentos}</>}
        apoio={<>{historico}{pontes}</>}
      />
    </TelaPaciente>
  );
}
