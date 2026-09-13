/**
 * "Seus últimos registros" — a grade de números do corpo.
 *
 * ── Por que grade e não uma medida só ─────────────────────────────────
 * A versão anterior mostrava UM "último registro" — o mais recente entre
 * pressão, peso e batimentos. Na prática isso escondia as outras duas: quem
 * pesou de manhã via o peso e ficava sem saber que a pressão não era medida
 * havia cinco dias. A grade mostra as três lado a lado, cada uma com a SUA
 * data — que é justamente a informação que diz o que está atrasado.
 *
 * ── As duas regras que este bloco não pode quebrar ────────────────────
 * 1. Ausência não vira zero. `valor: null` faz o primitivo escrever "Sem
 *    registro"; zero é um valor clínico legítimo e usá-lo como buraco é
 *    mentir com cara de dado (shell/Primitivos, `CartaoMedida`).
 * 2. Estimativa de sensor anda marcada. `rotuloProveniencia()` devolve
 *    tone "warning" para `validation_status === "estimated"`, e é isso que
 *    liga o aviso no cartão (CONTRATO-DE-CODIGO.md, regra 2).
 *
 * Nenhum cartão diz se o número é bom. Ele diz o número, quando, e de onde.
 */

import { Link } from "react-router-dom";
import { Gauge, HeartPulse, Scale } from "lucide-react";
import { CartaoMedida, type MedidaExibida } from "@/components/shell";
import { useBloodPressure, useHeartRate, useWeight } from "@/hooks/useCardioReadings";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import { numero, quandoLegivel } from "@/lib/formato";

/** Campos de proveniência comuns a toda leitura clínica. */
interface ComProveniencia {
  recorded_at: string;
  source_type: string;
  validation_status: string;
  source_device_name?: string | null;
}

/**
 * Monta o cartão de uma leitura. Recebe `null` sem reclamar: a ausência é um
 * caso normal desta tela, não um erro a ser escondido.
 */
function medida(
  rotulo: string,
  icone: MedidaExibida["icone"],
  para: string,
  leitura: ComProveniencia | null,
  valor: string | null,
  unidade?: string,
): MedidaExibida {
  const proveniencia = leitura
    ? rotuloProveniencia(leitura.source_type, leitura.validation_status, leitura.source_device_name)
    : null;

  return {
    rotulo,
    icone,
    valor: leitura ? valor : null,
    unidade: leitura ? unidade : undefined,
    quando: leitura ? quandoLegivel(leitura.recorded_at) : null,
    origem: proveniencia?.label ?? null,
    estimativa: proveniencia?.tone === "warning",
    para,
  };
}

export function UltimosRegistros() {
  // Os mesmos hooks já usados pela página: o react-query devolve do cache,
  // então chamar aqui não custa consulta nova — custa menos prop plumbing.
  const bp = useBloodPressure();
  const hr = useHeartRate();
  const weight = useWeight();

  const medidas: MedidaExibida[] = [
    medida("Pressão", Gauge, "/pressao", bp.ultima,
      bp.ultima ? `${bp.ultima.systolic}/${bp.ultima.diastolic}` : null, "mmHg"),
    medida("Batimentos", HeartPulse, "/pressao", hr.ultima,
      hr.ultima ? String(hr.ultima.bpm) : null, "bpm"),
    medida("Peso", Scale, "/peso", weight.ultimo,
      // `String(valor)` escrevia "85.2" com ponto, na mesma tela em que o
      // campo de digitar peso tem "78,5" como marcador.
      weight.ultimo ? numero(Number(weight.ultimo.value), 1) : null, "kg"),
  ];

  return (
    <section>
      {/*
        "Ver todos" apontava para /meu-coracao — que é "Minha evolução"
        (percentual na meta, capacidade, idade do coração) e não tem lista de
        registro nenhuma. O paciente clicava esperando o histórico e caía num
        painel de indicadores. Link que promete o que não entrega custa mais
        que link que não existe: da segunda vez, ele não clica em nenhum.

        O destino honesto é o resumo do mês, que é onde os registros das
        várias medidas aparecem juntos — e o rótulo agora diz isso. O
        histórico linha a linha de cada medida mora na tela da medida, e é
        para lá que cada cartão da grade já leva; a frase abaixo explicita
        isso, porque cartão clicável sem pista de que é clicável não é acesso.
      */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3">
        <h2 className="font-display text-xl font-semibold leading-tight">Seus últimos registros</h2>
        <Link
          to="/meu-mes"
          className="text-base font-medium text-primary shrink-0 rounded-lg px-1"
        >
          Ver o resumo do mês
        </Link>
      </div>

      {/*
        1 coluna no muito estreito (≤ 380px, onde dois cartões fariam "124/78"
        quebrar no meio), 2 no celular comum, 3 no desktop. `min-w-0` vive
        dentro do primitivo, então nada estoura a grade.
      */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 xl:grid-cols-3 gap-3">
        {medidas.map((m) => (
          <CartaoMedida key={m.rotulo} m={m} />
        ))}
      </div>

      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Toque em uma medida para ver o histórico completo dela, com o período que você escolher.
      </p>
    </section>
  );
}
