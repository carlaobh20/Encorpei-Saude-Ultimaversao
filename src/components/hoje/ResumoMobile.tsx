import { CalendarCheck, ChevronRight, Watch, HeartHandshake } from "lucide-react";
import { Link } from "react-router-dom";
import { useDevices } from "@/hooks/useCardioClinical";
import { useAppointments } from "@/hooks/useProfessional";
import { diasDesde, quandoLegivel } from "./formato";

/** Resumo visual dos mesmos dados utilizados pelos painéis do desktop. */
export function ResumoMobile() {
  const { devices, isLoading } = useDevices();
  const { proxima } = useAppointments();
  const pulseira = devices.find((device) => device.category === "h59");
  const sync = pulseira?.last_sync_at;
  const atrasada = (diasDesde(sync) ?? 0) > 2;
  const detalhe = isLoading ? "Carregando…"
    : !pulseira ? "Conecte sua pulseira"
    : !sync ? "Ainda sem dados sincronizados"
    : `${atrasada ? "Sem dados novos desde" : "Sincronizada"} ${quandoLegivel(sync)?.toLowerCase()}`;

  return (
    <div className="mobile-support lg:hidden">
      <Link to="/pulseira" className="mobile-resource">
        <Watch aria-hidden="true" />
        <span className="mobile-resource-copy">
          <strong>Minha pulseira <span className={`device-dot ${sync ? atrasada ? "device-dot-late" : "device-dot-synced" : ""}`} aria-hidden="true" /></strong>
          <span>{detalhe}</span>
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>
      <Link to="/agenda" className="mobile-resource">
        <CalendarCheck aria-hidden="true" />
        <span className="mobile-resource-copy">
          <strong>Próxima consulta</strong>
          <span>{proxima ? new Date(proxima.scheduled_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "") + " · " + new Date(proxima.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Nenhuma consulta marcada"}</span>
        </span>
        <ChevronRight aria-hidden="true" />
      </Link>
      <Link to="/como-estou" className="mobile-resource mobile-help">
        <HeartHandshake aria-hidden="true" />
        <span className="mobile-resource-copy"><strong>Não estou bem</strong><span>Abrir orientação sobre sintomas</span></span>
        <ChevronRight aria-hidden="true" />
      </Link>
    </div>
  );
}
