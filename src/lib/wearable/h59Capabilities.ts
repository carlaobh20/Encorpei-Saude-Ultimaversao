/** LOKMAT H59MAX / C4001B: etiqueta enviada em 05/11/2026.
 * Função anunciada pelo fabricante não comprova transmissão pelo firmware.
 * Evidências e limites: docs/H59MAX-COMPATIBILIDADE.md.
 */
export const H59_METRICAS = ["heart_rate", "spo2", "sleep", "activity", "blood_pressure"] as const;

export function metricaDisponivelH59(tipo: string): boolean {
  return (H59_METRICAS as readonly string[]).includes(tipo);
}

export function origemDeAparelho(origem: string): boolean {
  return origem === "device" || origem === "import";
}

export const H59_RECURSOS = [
  { nome: "Batimentos", envio: "Leitura Bluetooth implementada; depende da compatibilidade do firmware e do navegador." },
  { nome: "Oxigenação (SpO₂)", envio: "Importação de arquivo compatível. Leitura Bluetooth ainda não implementada." },
  { nome: "Sono", envio: "Importação de duração e estágios quando presentes no arquivo. Sem busca automática do histórico da pulseira." },
  { nome: "Passos e calorias", envio: "Importação de arquivo compatível. São estimativas de atividade." },
  { nome: "Pressão estimada", envio: "Importação de arquivo compatível. Não entra na média de pressão nem nos alertas clínicos." },
] as const;
