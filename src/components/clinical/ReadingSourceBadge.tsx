/**
 * Badge que exibe a origem de um dado clínico.
 * Preparado para quando devices começarem a enviar dados.
 *
 * Uso: <ReadingSourceBadge source="manual" />
 *      <ReadingSourceBadge source="device" deviceName="Omron HEM-7600T" />
 */

import { Smartphone, Wifi, Upload, Cpu } from "lucide-react";
import type { DataSourceType } from "@/types/cardio";

interface Props {
  source: DataSourceType;
  deviceName?: string;
  className?: string;
}

const SOURCE_CONFIG: Record<DataSourceType, {
  label: string;
  icon: typeof Smartphone;
  className: string;
}> = {
  lab: {
    label: "Laboratório",
    icon: Smartphone,
    className: "text-muted-foreground bg-muted",
  },
  manual: {
    label: "Manual",
    icon: Smartphone,
    className: "text-muted-foreground bg-muted",
  },
  device: {
    label: "Device",
    icon: Wifi,
    className: "text-success bg-success-bg",
  },
  import: {
    label: "Importado",
    icon: Upload,
    className: "text-info bg-info-bg",
  },
  system: {
    label: "Sistema",
    icon: Cpu,
    className: "text-purple-700 bg-purple-500/10",
  },
};

export function ReadingSourceBadge({ source, deviceName, className = "" }: Props) {
  const config = SOURCE_CONFIG[source];
  const Icon = config.icon;
  const label = source === "device" && deviceName ? deviceName : config.label;

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${config.className} ${className}`}
      title={`Origem: ${label}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
