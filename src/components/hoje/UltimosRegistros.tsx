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
import { Gauge, HeartPulse, Scale, Stethoscope, Heart, FileText, Watch, ChevronRight } from "lucide-react";
import { CartaoMedida, type MedidaExibida } from "@/components/shell";
import { useBloodPressure, useHeartRate, useWeight } from "@/hooks/useCardioReadings";
import { rotuloProveniencia } from "@/lib/wearable/normalize";
import { quandoLegivel } from "./formato";

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
      weight.ultimo ? String(weight.ultimo.value) : null, "kg"),
  ];

  return (
    <section className="latest-readings">
      <div className="latest-readings-heading flex items-baseline justify-between gap-3 mb-3">
        <h2 className="font-display text-xl font-semibold leading-tight">Seus últimos registros</h2>
        <Link
          to="/meu-coracao"
          className="text-base font-medium text-primary shrink-0 rounded-lg px-1"
        >
          Ver todos <ChevronRight className="inline h-4 w-4 lg:hidden" aria-hidden="true" />
        </Link>
      </div>

      {/*
        1 coluna no muito estreito (≤ 380px, onde dois cartões fariam "124/78"
        quebrar no meio), 2 no celular comum, 3 no desktop. `min-w-0` vive
        dentro do primitivo, então nada estoura a grade.
      */}
      <div className="mobile-readings-grid lg:hidden">
        {medidas.slice(0, 2).map((m, i) => {
          const Icon = i === 0 ? Stethoscope : Heart;
          const SourceIcon = m.origem?.toLowerCase().includes("manual") ? FileText : Watch;
          return (
            <Link to={m.para ?? "/meu-coracao"} key={m.rotulo} className="mobile-reading-card">
              <div className="mobile-reading-label"><Icon aria-hidden="true" /><span>{m.rotulo}</span></div>
              <p className={m.valor == null ? "mobile-reading-empty" : "mobile-reading-value"}>{m.valor ?? "Sem registro"}{i === 1 && m.valor != null && <span> bpm</span>}</p>
              {m.quando && <p className="mobile-reading-time">{i === 0 ? "mmHg · " : ""}{m.quando}</p>}
              {m.origem && <p className="mobile-reading-source"><SourceIcon aria-hidden="true" />{m.origem === "Registro manual" ? "Manual" : m.origem}</p>}
              {m.estimativa && <p className="mobile-reading-estimate">Estimativa do aparelho</p>}
            </Link>
          );
        })}
      </div>
      <div className="hidden lg:grid grid-cols-2 xl:grid-cols-3 gap-3">
        {medidas.map((m) => (
          <CartaoMedida key={m.rotulo} m={m} />
        ))}
      </div>
    </section>
  );
}
