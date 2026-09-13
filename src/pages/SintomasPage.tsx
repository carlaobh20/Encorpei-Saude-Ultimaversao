/**
 * SintomasPage — registrar sintoma.
 *
 * REGRA CRÍTICA (docs §2.3 e contrato regra 3): dor no peito em repouso com
 * duração acima de 10 minutos, ou desmaio, não vira registro para o médico
 * ver depois — a tela redireciona na hora para /emergencia.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhum gatilho, nenhuma pergunta, nenhum texto. A regra de duração
 * desconhecida contar como longa está onde sempre esteve, com o mesmo
 * comentário. Mudou:
 *
 *  · Os rótulos das perguntas saíram de `text-xs` — 13px na escala do
 *    paciente — para o corpo de 17px do `Campo`. Aqui isso não é conforto: a
 *    pergunta É o formulário, e ler "A dor vai para algum lugar (braço,
 *    costas, mandíbula)?" em letra miúda é onde a resposta sai errada.
 *
 *  · O `Botao` local (11 de altura, azul cheio quando marcado) virou
 *    `OpcaoBotao`. Marcar "Em repouso" era azul cheio do mesmo tom do
 *    "Registrar" logo abaixo — dois azuis, e o de cima nem era ação.
 *
 *  · A grade de sintomas ganhou alvo maior e quebra em uma coluna abaixo de
 *    380px, onde "Palpitação (coração disparado)" partia no meio.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  HeartCrack, Wind, Activity, Droplets, PersonStanding, Footprints,
  Stethoscope, BatteryLow, Gauge, ChevronLeft,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import {
  TelaPaciente, Formulario, Campo, OpcaoBotao, AvisoDaTela,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSymptoms } from "@/hooks/useCardioClinical";
import { classificarNyha, NYHA_DESCRICAO } from "@/lib/clinical/scores";
import { GATILHO, QUALIFICADOR, type GatilhoDaDor } from "@/lib/clinical/cardioAlertRules";
import type { SymptomType } from "@/types/cardio";

interface SymptomDef {
  type: SymptomType;
  label: string;
  icon: typeof HeartCrack;
}

const SINTOMAS: SymptomDef[] = [
  { type: "chest_pain", label: "Dor no peito", icon: HeartCrack },
  { type: "dyspnea", label: "Falta de ar", icon: Wind },
  { type: "palpitations", label: "Palpitação (coração disparado)", icon: Activity },
  { type: "edema", label: "Inchaço nas pernas", icon: Droplets },
  { type: "syncope", label: "Desmaio", icon: PersonStanding },
  { type: "presyncope", label: "Quase desmaiei", icon: PersonStanding },
  { type: "claudication", label: "Dor na perna ao andar", icon: Footprints },
  { type: "dry_cough", label: "Tosse seca", icon: Stethoscope },
  { type: "fatigue", label: "Cansaço fora do comum", icon: BatteryLow },
  { type: "dizziness", label: "Tontura", icon: Gauge },
];

/**
 * Onde a tela pergunta "de 0 a 10, quanto?".
 *
 * AUDITORIA: `intensity` só era enviada para `fatigue`; ia `null` para dor no
 * peito, falta de ar e palpitação. Com isso o escalonamento por intensidade do
 * gatilho do banco (`coalesce(new.intensity,0) >= 8`) nunca disparava — a
 * coluna existia, a regra existia, e nada nunca chegava lá. Agora a pergunta é
 * feita nos sintomas em que um número de 0 a 10 significa alguma coisa, e o
 * valor é enviado sempre que foi coletado.
 */
const COLETA_INTENSIDADE = new Set<SymptomType>(["chest_pain", "dyspnea", "palpitations", "fatigue"]);

/** Linha de escolhas que quebra em vez de estourar a largura em 360px. */
function LinhaOpcoes({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/**
 * A pergunta de 0 a 10, com o mesmo desenho em todos os sintomas.
 * Número grande porque é para ser lido e conferido por quem tem 70 anos e
 * está com o sintoma acontecendo.
 */
function CampoIntensidade({
  id, rotulo, valor, aoMudar,
}: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo rotulo={rotulo} para={id}>
      <Input
        id={id} inputMode="numeric" value={valor}
        onChange={(e) => aoMudar(e.target.value.replace(/\D/g, "").slice(0, 2))}
        className="h-14 w-24 text-2xl font-bold text-center tabular-nums"
      />
    </Campo>
  );
}

export default function SintomasPage() {
  const navigate = useNavigate();
  const { registrar, registrarEmergencia } = useSymptoms();
  const [selecionado, setSelecionado] = useState<SymptomType | null>(null);

  // Dor no peito
  const [local, setLocal] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [duracao, setDuracao] = useState("");
  const [gatilho, setGatilho] = useState<GatilhoDaDor | null>(null);
  const [irradiacao, setIrradiacao] = useState("");
  const [associados, setAssociados] = useState<string[]>([]);

  // Falta de ar
  const [repouso, setRepouso] = useState(false);
  const [esforcoLeve, setEsforcoLeve] = useState(false);
  const [atividadeHabitual, setAtividadeHabitual] = useState(false);
  const [travesseiros, setTravesseiros] = useState("1");
  const [dpn, setDpn] = useState(false);

  // Palpitação
  const [inicioSubito, setInicioSubito] = useState<boolean | null>(null);
  const [ritmoRegular, setRitmoRegular] = useState<boolean | null>(null);
  const [duracaoPalpitacao, setDuracaoPalpitacao] = useState("");

  // Inchaço
  const [localEdema, setLocalEdema] = useState<string | null>(null);
  const [cacifo, setCacifo] = useState<boolean | null>(null);
  const [periodo, setPeriodo] = useState<string | null>(null);

  // Claudicação
  const [distancia, setDistancia] = useState("");

  // Genérico (tontura, cansaço, tosse, presíncope)
  const [intensidade, setIntensidade] = useState("5");
  const [notas, setNotas] = useState("");

  const limpar = () => {
    setSelecionado(null);
    setLocal(""); setTipo(null); setDuracao(""); setGatilho(null); setIrradiacao(""); setAssociados([]);
    setRepouso(false); setEsforcoLeve(false); setAtividadeHabitual(false); setTravesseiros("1"); setDpn(false);
    setInicioSubito(null); setRitmoRegular(null); setDuracaoPalpitacao("");
    setLocalEdema(null); setCacifo(null); setPeriodo(null);
    setDistancia(""); setIntensidade("5"); setNotas("");
  };

  const toggleAssociado = (s: string) =>
    setAssociados((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  /** 0–10 digitado, ou `null` quando a tela não perguntou / veio vazio. */
  const intensidadeColetada = (type: SymptomType): number | null => {
    if (!COLETA_INTENSIDADE.has(type)) return null;
    const n = Number(intensidade);
    if (!intensidade.trim() || !Number.isFinite(n)) return null;
    return Math.min(10, Math.max(0, Math.round(n)));
  };

  const salvarESeguir = (qualifiers: Record<string, string | number | boolean>, duracaoMin: number | null) => {
    registrar.mutate({
      symptom_type: selecionado!,
      occurred_at: new Date().toISOString(),
      duration_minutes: duracaoMin,
      intensity: intensidadeColetada(selecionado!),
      qualifiers,
      notes: notas.trim() || null,
    });
    toast.success("Registrado. Seu médico consegue ver.");
    limpar();
  };

  /**
   * ══════════════════════════════════════════════════════════════════
   * GRAVA PRIMEIRO, NAVEGA DEPOIS — e a gravação não segura ninguém.
   * ══════════════════════════════════════════════════════════════════
   *
   * AUDITORIA, o buraco mais grave do app: síncope e dor torácica em repouso
   * chamavam `navigate("/emergencia")` e davam `return` ANTES de qualquer
   * escrita. Os dois sintomas mais graves do domínio eram os únicos que nunca
   * entravam em `symptom_reports`: nenhum gatilho do banco rodava, nenhum
   * alerta era criado, e o cardiologista descobria — se descobrisse — pelo
   * telefone do pronto-socorro.
   *
   * A ordem correta tem duas metades e as duas são inegociáveis:
   *
   *  1. a escrita é DISPARADA antes da navegação (`registrarEmergencia` é
   *     chamada aqui, não depois de um `await` que talvez nunca volte);
   *  2. a navegação NÃO espera a escrita. Nada de `await`: a promise fica
   *     solta no hook, que não é desmontado com esta tela, e a rota troca no
   *     mesmo tick. Se a rede estiver ruim, o paciente vê o 192 na hora e o
   *     registro chega quando chegar. Se falhar de vez, o hook avisa — mas
   *     nunca antes de o paciente já estar na tela certa.
   */
  const gravarEIrParaEmergencia = (
    type: SymptomType,
    qualifiers: Record<string, string | number | boolean>,
    duracaoMin: number | null
  ) => {
    void registrarEmergencia({
      symptom_type: type,
      occurred_at: new Date().toISOString(),
      duration_minutes: duracaoMin,
      intensity: intensidadeColetada(type),
      qualifiers,
      notes: notas.trim() || null,
      // O app diz o que ele próprio concluiu. O gatilho do banco recalcula e
      // confirma; ter os dois registrados é o que permite auditar depois
      // divergência entre a triagem da tela e a do servidor.
      triaged_as: "emergency",
    });
    navigate("/emergencia");
  };

  // ── Desmaio: emergência imediata, sem formulário, mas COM registro ──
  const escolher = (type: SymptomType) => {
    if (type === "syncope") {
      toast.error("Desmaio é emergência.");
      // Desmaio não tem formulário — e não precisa ter. O que ele precisa é
      // existir em `symptom_reports`: é o relato que faz o gatilho abrir um
      // alerta `emergency` para o médico enquanto o paciente vai ao PS.
      gravarEIrParaEmergencia(type, {}, null);
      return;
    }
    setSelecionado(type);
  };

  const enviarDorNoPeito = () => {
    const min = duracao.trim() ? Number(duracao) : null;
    const qualifiers = {
      local,
      tipo: tipo ?? "",
      [QUALIFICADOR.GATILHO]: gatilho ?? "",
      irradiacao,
      associados: associados.join(", "),
    };

    // REGRA CRÍTICA: dor em repouso não vira card na fila — vira tela de
    // emergência. O que mudou é que agora ela também vira LINHA no banco.
    //
    // Duração DESCONHECIDA conta como longa, de propósito. O caso que essa
    // linha protege é o pior possível: alguém com dor torácica em repouso
    // que não sabe (ou não consegue) dizer há quanto tempo. Tratar o campo
    // vazio como "curta" é a única leitura que mata; tratá-lo como longa
    // custa, no máximo, uma tela de emergência a mais.
    if (gatilho === GATILHO.REPOUSO && (min == null || min > 10)) {
      gravarEIrParaEmergencia("chest_pain", qualifiers, min);
      return;
    }
    salvarESeguir(qualifiers, min);
  };

  /**
   * O atalho do aviso no topo do formulário de dor no peito.
   *
   * Era o mesmo buraco em versão menor: quem clicava aqui ia para /emergencia
   * sem deixar rastro. Agora grava com o que já foi preenchido — mesmo que
   * seja quase nada. O gatilho é assumido como "repouso" quando não marcado
   * porque é exatamente o que o aviso diz ao paciente antes do clique ("está
   * acontecendo agora, não passa e você está em repouso").
   */
  const emergenciaPeloAviso = () =>
    gravarEIrParaEmergencia(
      "chest_pain",
      {
        local,
        tipo: tipo ?? "",
        [QUALIFICADOR.GATILHO]: gatilho ?? GATILHO.REPOUSO,
        irradiacao,
        associados: associados.join(", "),
        pelo_aviso_da_tela: true,
      },
      duracao.trim() ? Number(duracao) : null
    );

  const nyhaClasse = classificarNyha({
    sintomaEmRepouso: repouso,
    sintomaEsforcoLeve: esforcoLeve,
    sintomaAtividadeHabitual: atividadeHabitual,
  });

  if (selecionado) {
    const def = SINTOMAS.find((s) => s.type === selecionado)!;
    return (
      <TelaPaciente>
        <PageHeader
          title={def.label}
          action={
            <Button variant="ghost" size="icon" className="touch-target" onClick={limpar} aria-label="Voltar">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          }
        />

        {selecionado === "chest_pain" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              {/* O aviso vem ANTES do formulário: quem está com dor agora não
                  pode encontrá-lo depois de seis perguntas. */}
              <AvisoDaTela tom="atencao">
                Se a dor está acontecendo agora, não passa e você está em repouso, não espere — vá direto para{" "}
                <button type="button" className="underline font-semibold" onClick={emergenciaPeloAviso}>emergência</button>.
              </AvisoDaTela>

              <Campo rotulo="Onde dói" para="dor-local">
                <Input id="dor-local" value={local} onChange={(e) => setLocal(e.target.value)} placeholder="ex.: meio do peito" />
              </Campo>

              <Campo rotulo="Tipo de dor">
                <LinhaOpcoes>
                  {["Aperto", "Queimação", "Pontada"].map((t) => (
                    <OpcaoBotao key={t} className="w-auto" selecionado={tipo === t} onClick={() => setTipo(t)} titulo={t} />
                  ))}
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="Há quanto tempo (minutos)" para="dor-duracao">
                <Input id="dor-duracao" inputMode="numeric" value={duracao} onChange={(e) => setDuracao(e.target.value.replace(/\D/g, ""))} className="tabular-nums" />
              </Campo>

              <Campo rotulo="Quando começou">
                <LinhaOpcoes>
                  {/* Os valores gravados são os canônicos de `GATILHO`, em
                      português. Antes a tela gravava "rest" e o motor de risco
                      procurava `qualifiers.trigger` — chave e dicionário
                      diferentes, regra que nunca disparava. */}
                  <OpcaoBotao className="w-auto" selecionado={gatilho === GATILHO.ESFORCO} onClick={() => setGatilho(GATILHO.ESFORCO)} titulo="Durante esforço" />
                  <OpcaoBotao className="w-auto" selecionado={gatilho === GATILHO.REPOUSO} onClick={() => setGatilho(GATILHO.REPOUSO)} titulo="Em repouso" />
                  <OpcaoBotao className="w-auto" selecionado={gatilho === GATILHO.EMOCAO} onClick={() => setGatilho(GATILHO.EMOCAO)} titulo="Com emoção/estresse" />
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="A dor vai para algum lugar (braço, costas, mandíbula)?" para="dor-irradiacao">
                <Input id="dor-irradiacao" value={irradiacao} onChange={(e) => setIrradiacao(e.target.value)} />
              </Campo>

              <Campo rotulo="Sentiu junto com a dor">
                <LinhaOpcoes>
                  {["Suor frio", "Náusea", "Falta de ar"].map((s) => (
                    <OpcaoBotao key={s} className="w-auto" selecionado={associados.includes(s)} onClick={() => toggleAssociado(s)} titulo={s} />
                  ))}
                </LinhaOpcoes>
              </Campo>

              <CampoIntensidade
                id="dor-intensidade"
                rotulo="De 0 (nada) a 10 (a pior possível), quanto dói?"
                valor={intensidade}
                aoMudar={setIntensidade}
              />

              <Button size="xl" className="w-full" onClick={enviarDorNoPeito} disabled={registrar.isPending}>
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "dyspnea" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <Campo rotulo="Quando você sente falta de ar?">
                <div className="flex flex-col gap-2">
                  <OpcaoBotao selecionado={atividadeHabitual} onClick={() => setAtividadeHabitual((v) => !v)} titulo="Em atividades do dia a dia (ex.: subir escada)" />
                  <OpcaoBotao selecionado={esforcoLeve} onClick={() => setEsforcoLeve((v) => !v)} titulo="Em esforços leves (ex.: andar em casa)" />
                  <OpcaoBotao selecionado={repouso} onClick={() => setRepouso((v) => !v)} titulo="Mesmo parado, sem fazer nada" />
                </div>
              </Campo>

              <SurfaceCard className="bg-cardio-50 border-0">
                <p className="text-sm font-bold uppercase tracking-wide text-primary mb-1">
                  Classe de esforço do coração (NYHA) — classe {nyhaClasse}
                </p>
                <p className="text-base text-foreground leading-relaxed">{NYHA_DESCRICAO[nyhaClasse]}</p>
              </SurfaceCard>

              <Campo rotulo="Quantos travesseiros usa para dormir sem faltar ar?" para="travesseiros">
                <Input id="travesseiros" inputMode="numeric" value={travesseiros} onChange={(e) => setTravesseiros(e.target.value.replace(/\D/g, ""))} className="w-24 tabular-nums" />
              </Campo>

              <OpcaoBotao selecionado={dpn} onClick={() => setDpn((v) => !v)} titulo="Já acordei à noite sem conseguir respirar" />

              <CampoIntensidade
                id="falta-ar-intensidade"
                rotulo="De 0 (nada) a 10 (muito forte), quanta falta de ar?"
                valor={intensidade}
                aoMudar={setIntensidade}
              />

              {/* `nyha` é a classe ABSOLUTA do momento (1–4), não a variação.
                  Quem calcula "piorou" é o motor de risco, comparando com o
                  relato anterior do próprio paciente — antes ele esperava um
                  campo `nyha_change` que ninguém nunca gravou. */}
              <Button
                size="xl" className="w-full" disabled={registrar.isPending}
                onClick={() => salvarESeguir(
                  { [QUALIFICADOR.NYHA]: nyhaClasse, travesseiros: Number(travesseiros), dispneia_paroxistica_noturna: dpn },
                  null
                )}
              >
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "palpitations" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <Campo rotulo="Começou de repente ou foi piorando aos poucos?">
                <LinhaOpcoes>
                  <OpcaoBotao className="w-auto" selecionado={inicioSubito === true} onClick={() => setInicioSubito(true)} titulo="De repente" />
                  <OpcaoBotao className="w-auto" selecionado={inicioSubito === false} onClick={() => setInicioSubito(false)} titulo="Aos poucos" />
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="O batimento estava regular ou desorganizado?">
                <LinhaOpcoes>
                  <OpcaoBotao className="w-auto" selecionado={ritmoRegular === true} onClick={() => setRitmoRegular(true)} titulo="Regular" />
                  <OpcaoBotao className="w-auto" selecionado={ritmoRegular === false} onClick={() => setRitmoRegular(false)} titulo="Irregular" />
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="Quanto tempo durou (minutos)" para="palpitacao-duracao">
                <Input id="palpitacao-duracao" inputMode="numeric" value={duracaoPalpitacao} onChange={(e) => setDuracaoPalpitacao(e.target.value.replace(/\D/g, ""))} className="tabular-nums" />
              </Campo>

              <CampoIntensidade
                id="palpitacao-intensidade"
                rotulo="De 0 (nada) a 10 (muito forte), quanto incomodou?"
                valor={intensidade}
                aoMudar={setIntensidade}
              />

              <Button
                size="xl" className="w-full" disabled={registrar.isPending}
                onClick={() => salvarESeguir(
                  { inicio_subito: !!inicioSubito, ritmo_regular: !!ritmoRegular },
                  duracaoPalpitacao.trim() ? Number(duracaoPalpitacao) : null
                )}
              >
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "edema" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <Campo rotulo="Onde está inchado?">
                <LinhaOpcoes>
                  {["Tornozelo", "Perna", "Abdome"].map((l) => (
                    <OpcaoBotao key={l} className="w-auto" selecionado={localEdema === l} onClick={() => setLocalEdema(l)} titulo={l} />
                  ))}
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="Se apertar com o dedo, fica marcado?">
                <LinhaOpcoes>
                  <OpcaoBotao className="w-auto" selecionado={cacifo === true} onClick={() => setCacifo(true)} titulo="Sim" />
                  <OpcaoBotao className="w-auto" selecionado={cacifo === false} onClick={() => setCacifo(false)} titulo="Não" />
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="Piora em que período?">
                <LinhaOpcoes>
                  {["Manhã", "Fim do dia"].map((p) => (
                    <OpcaoBotao key={p} className="w-auto" selecionado={periodo === p} onClick={() => setPeriodo(p)} titulo={p} />
                  ))}
                </LinhaOpcoes>
              </Campo>

              <Button
                size="xl" className="w-full" disabled={registrar.isPending}
                onClick={() => salvarESeguir({ local: localEdema ?? "", cacifo: !!cacifo, periodo: periodo ?? "" }, null)}
              >
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "presyncope" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <AvisoDaTela tom="atencao">
                Se desmaiar de verdade, pare e procure emergência na hora.
              </AvisoDaTela>

              <Campo rotulo="Aconteceu fazendo o quê?">
                <LinhaOpcoes>
                  {["Esforço", "Ao levantar rápido", "Ao urinar"].map((c) => (
                    <OpcaoBotao key={c} className="w-auto" selecionado={tipo === c} onClick={() => setTipo(c)} titulo={c} />
                  ))}
                </LinhaOpcoes>
              </Campo>

              <Campo rotulo="Quer contar mais alguma coisa?" para="presyncope-notas">
                <Textarea
                  id="presyncope-notas"
                  placeholder="Sentiu algum aviso antes (tontura, visão escura, suor)?"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="min-h-[96px]"
                />
              </Campo>

              <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({ contexto: tipo ?? "" }, null)}>
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "claudication" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <Campo rotulo="Quantos metros/quarteirões você anda até a dor aparecer?" para="claudicacao-distancia">
                <Input id="claudicacao-distancia" value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder="ex.: 2 quarteirões" />
              </Campo>
              <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({ distancia }, null)}>
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {selecionado === "dry_cough" && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              <p className="text-base text-muted-foreground leading-relaxed">Tosse seca pode ser efeito de um dos seus remédios — vale contar ao médico.</p>
              <Campo rotulo="Quer contar mais alguma coisa?" para="tosse-notas">
                <Textarea
                  id="tosse-notas"
                  placeholder="Quando começou, o que piora ou melhora..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="min-h-[96px]"
                />
              </Campo>
              <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({}, null)}>
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}

        {(selecionado === "fatigue" || selecionado === "dizziness") && (
          <SurfaceCard>
            <Formulario className="space-y-5">
              {selecionado === "fatigue" && (
                <CampoIntensidade
                  id="cansaco-intensidade"
                  rotulo="De 0 (nada) a 10 (muito forte), quanto cansaço?"
                  valor={intensidade}
                  aoMudar={setIntensidade}
                />
              )}
              <Campo rotulo="Quer contar mais alguma coisa?" para="sintoma-notas">
                <Textarea
                  id="sintoma-notas"
                  placeholder="Quer contar mais alguma coisa?"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  className="min-h-[96px]"
                />
              </Campo>
              <Button size="xl" className="w-full" disabled={registrar.isPending} onClick={() => salvarESeguir({}, null)}>
                Registrar
              </Button>
            </Formulario>
          </SurfaceCard>
        )}
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Sintomas" subtitle="O que você está sentindo?" />
      {/* Uma coluna abaixo de 380px: "Palpitação (coração disparado)" em duas
          colunas de 160px partia no meio da palavra. */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
        {SINTOMAS.map((s) => (
          <SurfaceCard
            key={s.type}
            onClick={() => escolher(s.type)}
            ariaLabel={s.label}
            className="flex flex-col items-center text-center gap-2 py-6 cursor-pointer min-h-[120px] justify-center hover:shadow-md transition-shadow"
          >
            <div className="h-12 w-12 rounded-full bg-cardio-50 grid place-items-center">
              <s.icon className="h-6 w-6 text-primary" aria-hidden />
            </div>
            <p className="text-base font-semibold text-foreground leading-snug">{s.label}</p>
          </SurfaceCard>
        ))}
      </div>
    </TelaPaciente>
  );
}
