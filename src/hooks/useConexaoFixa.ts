/**
 * Mantém a frequência cardíaca depois que o paciente sai de /pulseira.
 *
 * Não pede sono, oxigenação, passos nem pressão. Não roda no iPhone.
 * Fechar o navegador derruba o rádio; ao abrir o app de novo, retoma o
 * aparelho já autorizado, sem arquivo e sem seletor.
 */
import { useEffect, useRef } from "react";
import { useDevices } from "@/hooks/useCardioClinical";
import { useWearableSync } from "@/hooks/useWearableSync";
import { retomarPulseira, temSessaoFixa } from "@/lib/wearable/bleClient";
import {
  algumGravou,
  ambienteDaqui,
  bloqueioDeRetomada,
  filaAposFlush,
  guardarPendente,
  lerFila,
  salvarFila,
  type BatimentoPendente,
} from "@/lib/wearable/conexaoFixa";

export function useConexaoFixa() {
  const sync = useWearableSync();
  const { devices } = useDevices();
  const deviceIdRef = useRef<string | null>(null);
  const nomeRef = useRef("Pulseira");
  const retomou = useRef(false);
  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (sync.demo || typeof localStorage === "undefined") return;
    let cancelado = false;

    const flush = async () => {
      const atual = syncRef.current;
      if (atual.demo) return;
      const fila = lerFila(localStorage);
      if (fila.length === 0) return;
      const gravou: boolean[] = [];
      for (const item of fila) {
        if (cancelado) return;
        try {
          gravou.push(await atual.gravarAmostra(
            { bpm: item.bpm, rmssd: null, sdnn: null, contactDetected: null, at: item.at },
            { deviceId: item.deviceId, deviceName: item.deviceName },
            { forcar: true },
          ));
        } catch {
          gravou.push(false);
        }
      }
      if (cancelado) return;
      salvarFila(localStorage, filaAposFlush(fila, gravou));
      if (!algumGravou(gravou)) return;
      const deviceId = fila.find((_, i) => gravou[i])?.deviceId ?? null;
      if (!deviceId) return;
      try { await atual.marcarSincronizacao(deviceId); } catch { /* a medida já entrou */ }
    };

    void flush();
    window.addEventListener("online", flush);
    return () => {
      cancelado = true;
      window.removeEventListener("online", flush);
    };
  }, [sync.demo]);

  useEffect(() => {
    if (retomou.current || sync.demo || temSessaoFixa()) return;
    if (typeof navigator === "undefined" || typeof window === "undefined") return;
    const bloqueio = bloqueioDeRetomada(ambienteDaqui({
      userAgent: navigator.userAgent,
      bluetooth: (navigator as Navigator & { bluetooth?: { getDevices?: unknown } }).bluetooth,
      secure: window.isSecureContext,
    }));
    if (bloqueio) return;

    const alvos = devices.filter((d) => d.category === "h59" && d.external_id);
    if (alvos.length === 0) return;
    retomou.current = true;

    void (async () => {
      for (const alvo of alvos) {
        if (!alvo.external_id || temSessaoFixa()) return;
        nomeRef.current = alvo.display_name;
        deviceIdRef.current = alvo.id;
        const externa = alvo.external_id;
        const con = await retomarPulseira(externa, {
          onSample: (s) => {
            const atual = syncRef.current;
            void atual.gravarAmostra(s, { deviceId: deviceIdRef.current, deviceName: nomeRef.current })
              .then(async (gravou) => {
                if (!gravou || !deviceIdRef.current) return;
                try { await atual.marcarSincronizacao(deviceIdRef.current); } catch { /* já entrou */ }
              })
              .catch(() => {
                const pendente: BatimentoPendente = {
                  at: s.at,
                  bpm: s.bpm,
                  deviceName: nomeRef.current,
                  deviceId: deviceIdRef.current,
                };
                guardarPendente(pendente);
              });
          },
          onHistorico: async (pontos, deviceName) => {
            nomeRef.current = deviceName;
            await syncRef.current.importar(
              pontos.map((p) => ({ recordedAt: p.at, heartRate: p.bpm, validation: "estimated" as const })),
              { deviceName, protocolo: "ble", externalId: externa, vitalTypes: ["heart_rate"] },
            );
          },
        });
        if (con) return;
      }
    })();
  }, [devices, sync.demo]);
}
