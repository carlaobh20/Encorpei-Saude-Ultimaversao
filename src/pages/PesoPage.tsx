/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PESO — a tela que faltava.
 *
 * Por que peso tem tela própria num app de cardiologia: em insuficiência
 * cardíaca, ganho rápido de peso é retenção de líquido, e retenção de líquido
 * antecede a internação em dias. É o dado mais barato de coletar e um dos que
 * mais mudam conduta. Até esta tela existir, o app pedia o peso e não tinha
 * onde recebê-lo.
 *
 * REGRA CLÍNICA: a tela mostra a variação e diz para avisar o médico. Ela
 * NÃO diz "você está descompensando" e NÃO manda tomar diurético.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * O limiar de 2 kg, a escolha da referência (peso seco > medida de 3 dias
 * atrás) e o texto de aviso estão idênticos, palavra por palavra. Mudou:
 * a coluna ganhou teto de largura, o campo virou `Campo` com rótulo de 17px,
 * o bloco de variação passou a `AvisoDaTela` (borda à esquerda em vez de
 * fundo vermelho cheio, que competia com o botão da tela), e o histórico
 * passou a usar a lista comum, com 48px por linha.
 *
 * O estado vazio ganhou a ação que o resolve: antes ele descrevia o que
 * aconteceria se o paciente registrasse, e não oferecia onde registrar.
 *
 * ── O que a auditoria de DESKTOP (setembro/2026) mudou ────────────────
 * Continua sem tocar em limiar, conta ou frase clínica. Mudou:
 *
 *  · Duas colunas a partir de `xl` (`LayoutPainel`): registrar e a leitura do
 *    dia à esquerda, histórico e pontes à direita. Em 1440px a tela usava 768
 *    de 1188 e deixava ~420px de branco.
 *
 *  · O histórico parava em 14 linhas sem dizer que parava. Agora tem período
 *    (7/30/90), a contagem real e o aviso de `truncado`.
 *
 *  · Quando o ganho é rápido, o aviso passou a OFERECER o caminho: relatar
 *    sintoma e falar com a equipe. O texto do aviso é o mesmo — o que ele não
 *    tinha era para onde ir depois de ser lido.
 */

import { useMemo, useState } from "react";
import { MessageCircle, Scale, Stethoscope, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PageHeader, SurfaceCard, EmptyState, PageLoader } from "@/components/shell";
import {
  TelaPaciente, TituloSecao, Formulario, Campo, Lista, ItemLista, AvisoDaTela,
  LayoutPainel, SeletorPeriodo, CoberturaDoPeriodo, Ponte, type PeriodoDias,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWeight } from "@/hooks/useCardioReadings";
import { useTargets } from "@/hooks/useCardioPatient";
import { useProfile } from "@/hooks/useProfile";
// Todo número que o paciente LÊ passa por aqui — `toFixed` escreve "85.2",
// com ponto, dois centímetros acima do campo cujo marcador é "78,5".
import { medida, numero, variacao } from "@/lib/formato";

function dataCurta(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PesoPage() {
  const { readings, ultimo, registrar, isLoading, cobertura } = useWeight();
  const { targets } = useTargets();
  const { profile } = useProfile();
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  // Erro de digitação passou a viver ao lado do campo, e não só no toast: o
  // toast some em três segundos e o paciente volta a olhar para um campo que
  // continua com o número recusado dentro, sem nada dizendo por quê.
  const [erro, setErro] = useState<string | null>(null);
  // Recorte de EXIBIÇÃO do histórico. A janela pedida ao hook continua a
  // padrão (90 dias) — a referência de variação sai dela e não pode encolher
  // porque o paciente escolheu "7 dias" para olhar a lista.
  const [periodo, setPeriodo] = useState<PeriodoDias>(30);
  const [mostrarTudo, setMostrarTudo] = useState(false);

  const alturaM = profile?.height_cm ? Number(profile.height_cm) / 100 : null;

  const analise = useMemo(() => {
    const lista = (readings ?? []) as any[];
    if (lista.length === 0) return null;
    const atual = Number(lista[0].value);

    // Referência: peso seco prescrito pelo médico; na falta, a medida mais
    // próxima de 3 dias atrás. É a variação curta que importa aqui.
    const seco = targets?.dry_weight_kg ? Number(targets.dry_weight_kg) : null;
    const limite = new Date(Date.now() - 3 * 86400000).getTime();
    const antiga = lista.find((r) => new Date(r.recorded_at).getTime() <= limite);
    const base = seco ?? (antiga ? Number(antiga.value) : null);

    const imc = alturaM ? atual / (alturaM * alturaM) : null;
    const delta = base !== null ? +(atual - base).toFixed(1) : null;

    return { atual, base, baseEhSeco: seco !== null, delta, imc };
  }, [readings, targets, alturaM]);

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!v || v < 20 || v > 400) {
      setErro("Digite um peso entre 20 e 400 kg.");
      toast.error("Digite um peso entre 20 e 400 kg.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      await (registrar as any).mutateAsync({ value: v });
      setValor("");
    } catch {
      toast.error("Não consegui registrar agora.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) return <PageLoader />;


  const subiuMuito = analise?.delta !== null && analise?.delta !== undefined && analise.delta >= 2;

  const lista = (readings ?? []) as any[];
  const doPeriodo = lista.filter(
    (r) => new Date(r.recorded_at).getTime() >= Date.now() - periodo * 86400000
  );
  const PRIMEIRAS = 14;
  const visiveis = mostrarTudo ? doPeriodo : doPeriodo.slice(0, PRIMEIRAS);

  const registro = (
    <SurfaceCard>
      <Formulario>
        <Campo rotulo="Peso de hoje" para="peso-hoje" erro={erro}>
          <div className="flex items-center gap-2">
            <Input
              id="peso-hoje"
              inputMode="decimal"
              value={valor}
              onChange={(e) => { setValor(e.target.value); if (erro) setErro(null); }}
              placeholder="78,5"
              className="h-14 text-2xl font-semibold tabular-nums text-center"
            />
            <span className="text-base text-muted-foreground w-10 shrink-0">kg</span>
          </div>
        </Campo>
        <Button onClick={salvar} disabled={salvando} size="xl" className="w-full mt-4">
          {salvando ? "Salvando…" : "Registrar peso"}
        </Button>
      </Formulario>
    </SurfaceCard>
  );

  const leituraDoDia = analise ? (
    <SurfaceCard>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-3xl font-semibold tabular-nums">{medida(analise.atual, "kg", 1)}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ultimo ? `Última medida em ${dataCurta((ultimo as any).recorded_at)}` : ""}
          </p>
        </div>
        {analise.imc ? (
          <div className="text-right shrink-0">
            <p className="text-base font-medium tabular-nums">IMC {numero(analise.imc, 1)}</p>
            <p className="text-sm text-muted-foreground">altura {profile?.height_cm} cm</p>
          </div>
        ) : null}
      </div>

      {analise.delta !== null ? (
        subiuMuito ? (
          /* Ganho rápido: bloco de atenção com a mesma frase de sempre.
             O `AvisoDaTela` traz ícone E texto — cor sozinha não informa. */
          <AvisoDaTela
            tom="atencao"
            titulo={`${variacao(analise.delta, "kg")} em relação ${
              analise.baseEhSeco ? "ao seu peso de referência" : "aos últimos dias"
            }.`}
            className="mt-4"
          >
            Esse ganho rápido costuma ser líquido retido. Avise seu médico hoje.
            Se estiver com falta de ar, pernas inchadas ou não conseguir deitar,
            procure atendimento.

            {/* O aviso mandava avisar o médico e não dizia por onde. Estas duas
                linhas são o caminho, não conduta nova: o texto acima continua
                idêntico e continua sendo quem diz o que fazer. */}
            <div className="mt-3 space-y-2">
              <Ponte
                para="/sintomas"
                icone={Stethoscope}
                titulo="Registrar como estou me sentindo"
                detalhe="Falta de ar, inchaço nas pernas, cansaço"
              />
              <Ponte
                para="/medico"
                icone={MessageCircle}
                titulo="Falar com meu médico"
                detalhe="Mandar uma mensagem para a equipe que te acompanha"
              />
            </div>
          </AvisoDaTela>
        ) : (
          <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3">
            <p className="flex items-center gap-2 text-base font-medium">
              {analise.delta > 0 ? <TrendingUp className="h-5 w-5 shrink-0" aria-hidden />
                : analise.delta < 0 ? <TrendingDown className="h-5 w-5 shrink-0" aria-hidden />
                : <Minus className="h-5 w-5 shrink-0" aria-hidden />}
              {analise.delta === 0
                ? "Mesmo peso da referência."
                : `${variacao(analise.delta, "kg")} em relação ${
                    analise.baseEhSeco ? "ao seu peso de referência" : "aos últimos dias"
                  }.`}
            </p>
          </div>
        )
      ) : null}
    </SurfaceCard>
  ) : (
    <EmptyState
      icon={Scale}
      title="Nenhum peso registrado ainda"
      description="Registre hoje e o app passa a mostrar a variação entre os dias — que é o que seu médico acompanha."
      variant="card"
      actionLabel="Registrar o primeiro peso"
      onAction={() => document.getElementById("peso-hoje")?.focus()}
    />
  );

  /**
   * Histórico. Parava em 14 linhas e não dizia que parava — na consulta é o
   * mês inteiro que interessa. Período, contagem real e aviso de `truncado`.
   */
  const historico = lista.length > 1 ? (
    <SurfaceCard>
      <TituloSecao titulo="Meus registros" />
      <SeletorPeriodo valor={periodo} onMudar={(d) => { setPeriodo(d); setMostrarTudo(false); }} className="mb-3" />
      {doPeriodo.length === 0 ? (
        <p className="text-base text-muted-foreground leading-relaxed">
          Nenhuma pesagem nesse período. Escolha um período maior.
        </p>
      ) : (
        <Lista>
          {visiveis.map((r) => (
            <ItemLista key={r.id}>
              <span className="text-base text-muted-foreground">{dataCurta(r.recorded_at)}</span>
              <span className="text-base font-semibold tabular-nums">{medida(Number(r.value), "kg", 1)}</span>
            </ItemLista>
          ))}
        </Lista>
      )}
      {!mostrarTudo && doPeriodo.length > PRIMEIRAS ? (
        <Button variant="outline" size="lg" className="w-full mt-3" onClick={() => setMostrarTudo(true)}>
          Mostrar as {doPeriodo.length} pesagens do período
        </Button>
      ) : null}
      <CoberturaDoPeriodo
        className="mt-3"
        quantidade={doPeriodo.length}
        dias={periodo}
        substantivo="pesagem"
        truncado={cobertura.truncado}
      />
    </SurfaceCard>
  ) : null;

  const pontes = (
    <section>
      <TituloSecao titulo="Depois de pesar" />
      <div className="space-y-2">
        <Ponte
          para="/sintomas"
          icone={Stethoscope}
          titulo="Registrar um sintoma"
          detalhe="Inchaço, falta de ar e cansaço andam junto com o peso"
        />
        <Ponte
          para="/meu-mes"
          icone={MessageCircle}
          titulo="Levar para a consulta"
          detalhe="O resumo do mês que você mostra para o seu médico"
        />
      </div>
    </section>
  );

  return (
    <TelaPaciente largura="painel">
      <PageHeader title="Peso" subtitle="Meça de manhã, depois do banheiro, antes de comer." />
      {/* Registrar e ler o dia à esquerda; histórico e pontes à direita.
          Abaixo de `xl` vira uma coluna, na mesma ordem. */}
      <LayoutPainel
        principal={<>{registro}{leituraDoDia}</>}
        apoio={<>{historico}{pontes}</>}
      />
    </TelaPaciente>
  );
}
