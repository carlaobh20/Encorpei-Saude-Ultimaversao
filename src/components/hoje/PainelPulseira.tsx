/**
 * Painel da pulseira, na coluna de apoio.
 *
 * ── Três cuidados de linguagem que este painel carrega ────────────────
 *
 * 1. "Conectada" ≠ "sincronizada". Bluetooth pareado e dado gravado são
 *    eventos diferentes, e o paciente que lê "conectada" para de conferir.
 *    O que mostramos é a última SINCRONIZAÇÃO — `last_sync_at`, gravação
 *    confirmada —, com a mesma leitura de estado da tela /pulseira.
 *
 * 2. Ícone, não foto. A ficha do modelo não está confirmada (docs §4);
 *    desenhar o produto errado é afirmar algo que não sabemos. `Watch`
 *    resolve o reconhecimento sem inventar hardware.
 *
 * 3. Bateria só quando informada. Hoje `registered_devices` não guarda
 *    nível de bateria — o valor só existe durante uma sessão BLE aberta,
 *    dentro da tela /pulseira. Então aqui ela simplesmente não aparece, em
 *    vez de aparecer como "—" ou, pior, como 0%.
 */

import { Watch, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Painel } from "@/components/shell";
import { useDevices } from "@/hooks/useCardioClinical";
import { quandoLegivel, diasDesde } from "./formato";

/** Acima disso, o aparelho não está trazendo dado novo — e a tela diz isso. */
const DIAS_PARA_ATRASO = 2;

export function PainelPulseira() {
  const { devices, isLoading } = useDevices();

  // "h59" é a categoria da pulseira; o manguito e a balança também moram
  // nesta tabela e não são o assunto deste painel.
  const pulseira = devices.find((d) => d.category === "h59") ?? null;
  const ultimaSync = pulseira?.last_sync_at ?? null;
  const dias = diasDesde(ultimaSync);

  const estado: { marcador: "ok" | "atencao" | "parado"; titulo: string; detalhe: string } =
    !pulseira
      ? {
          marcador: "parado",
          titulo: "Nenhuma pulseira conectada",
          detalhe: "Você ainda não ligou um aparelho a esta conta.",
        }
      : ultimaSync == null
      ? {
          marcador: "parado",
          titulo: pulseira.display_name,
          detalhe: "Ainda sem dados sincronizados.",
        }
      : dias != null && dias > DIAS_PARA_ATRASO
      ? {
          marcador: "atencao",
          titulo: pulseira.display_name,
          detalhe: `Sem dados novos desde ${quandoLegivel(ultimaSync)}.`,
        }
      : {
          marcador: "ok",
          titulo: pulseira.display_name,
          detalhe: `Dados sincronizados ${quandoLegivel(ultimaSync)?.toLowerCase()}.`,
        };

  return (
    <Painel titulo="Minha pulseira">
      {isLoading ? (
        <p className="text-base text-muted-foreground">Carregando…</p>
      ) : (
        <Link
          to="/pulseira"
          className="flex items-center gap-3 -mx-1 px-1 py-1 rounded-xl"
          aria-label="Abrir a tela da minha pulseira"
        >
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
            <Watch className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              {/* Sem `truncate`: na coluna de apoio de 1280px o nome do aparelho
                  virava "Pulseira H59 (De…". Ele quebra de linha em vez de
                  sumir — são duas palavras, não um parágrafo. */}
              <span className="block text-base font-semibold text-foreground min-w-0 break-words">
                {estado.titulo}
              </span>
              {/* Pontinho SEMPRE acompanhado do texto abaixo: cor sozinha não
                  informa quem não enxerga cor. */}
              <span
                className={
                  "h-2 w-2 rounded-full shrink-0 " +
                  (estado.marcador === "ok"
                    ? "bg-progresso"
                    : estado.marcador === "atencao"
                    ? "bg-warning"
                    : "bg-muted-foreground/40")
                }
                aria-hidden
              />
            </span>
            <span className="block text-sm text-muted-foreground mt-0.5 leading-relaxed">
              {estado.detalhe}
            </span>
          </span>

          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
        </Link>
      )}
    </Painel>
  );
}
