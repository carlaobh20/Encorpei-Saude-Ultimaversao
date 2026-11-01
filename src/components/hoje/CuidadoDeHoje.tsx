/** Cartão único de ação do dia. O plano e a prioridade vêm dos hooks clínicos. */
import {
  CheckCircle2, ChevronRight, CalendarCheck, Gauge, Scale, HeartPulse,
  Activity, Droplet, Pill, Stethoscope, Footprints, Salad, Moon, Smile,
  type LucideIcon,
} from "lucide-react";
import { CartaoDestaque, BarraProgresso } from "@/components/shell";
import {
  ROTULO_METRICA, type MetricaPlano, type Pendencia,
} from "@/hooks/usePlanoMonitoramento";

/** Só ícone — nenhum juízo clínico mora neste mapa. */
const ICONE_DA_METRICA: Record<MetricaPlano, LucideIcon> = {
  bp: Gauge,
  weight: Scale,
  hr: HeartPulse,
  spo2: Activity,
  glucose: Droplet,
  steps: Footprints,
  sleep: Moon,
  symptoms: Stethoscope,
  medication: Pill,
  sodium: Salad,
  wellbeing: Smile,
  walk: Footprints,
};

export interface CuidadoDeHojeProps {
  /** Verdadeiro quando o plano veio do médico; falso quando é sugestão do app. */
  prescrito: boolean;
  total: number;
  concluidasCount: number;
  prioritaria: Pendencia | null;
  demaisAbertas: Pendencia[];
  concluidas: Pendencia[];
  /** Rótulo do botão da tarefa prioritária ("Medir a pressão"). */
  rotuloAcao: string;
  onResolver: (metric: MetricaPlano) => void;
}

export function CuidadoDeHoje({
  prescrito, total, concluidasCount, prioritaria, demaisAbertas, concluidas,
  rotuloAcao, onResolver,
}: CuidadoDeHojeProps) {
  const origem = prescrito
    ? "Plano definido pelo seu cardiologista"
    : "Sugestão do app — seu médico ainda não definiu um plano";

  const Icone = prioritaria ? ICONE_DA_METRICA[prioritaria.metric] : CalendarCheck;

  return (
    <CartaoDestaque className="care-today patient-care-card">
      <div className="care-heading">
        <div>
          <h2>Cuidados de hoje</h2>
          <p className="care-origin">{origem}</p>
        </div>
        {total > 0 && (
          <div className="care-count" aria-hidden="true">
            <strong>{concluidasCount}</strong><span>/{total}</span>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="care-progress">
          <BarraProgresso feitos={concluidasCount} total={total} tom="escuro" />
          <p>{concluidasCount} de {total} cuidados concluídos</p>
        </div>
      )}

      {prioritaria ? (
        <button type="button" className="care-next" onClick={() => onResolver(prioritaria.metric)}>
          <span className="care-next-icon"><Icone aria-hidden="true" /></span>
          <span className="care-next-copy">
            <strong>{rotuloAcao}</strong>
            {prioritaria.esperados > 1 && <small>{prioritaria.feitos} de {prioritaria.esperados} registros hoje</small>}
            {prioritaria.instrucao && <small>{prioritaria.instrucao}</small>}
          </span>
          <ChevronRight className="care-next-arrow" aria-hidden="true" />
        </button>
      ) : (
        <div className="care-finished">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <p>{total > 0 ? "Tudo registrado por hoje." : "Nada combinado para hoje."}</p>
            <p>{total > 0
              ? "Seus registros de hoje estão disponíveis no histórico."
              : "Quando houver algo a registrar, ele aparece aqui."}</p>
          </div>
        </div>
      )}

      <div className="care-checklist">
      {demaisAbertas.length > 0 && (
        <div className="care-other" role="group" aria-label="Também combinado para hoje">
          {demaisAbertas.map((p) => (
            <button type="button" key={p.metric} onClick={() => onResolver(p.metric)}>
              {ROTULO_METRICA[p.metric]}
            </button>
          ))}
        </div>
      )}

      {concluidas.length > 0 && (
        <ul className="care-completed" aria-label="Cuidados registrados">
          {concluidas.map((p) => (
            <li key={p.metric}><CheckCircle2 aria-hidden="true" />{ROTULO_METRICA[p.metric]}</li>
          ))}
        </ul>
      )}
      </div>
    </CartaoDestaque>
  );
}
