import { useEffect, useState } from "react";

/**
 * Estado de conexão do navegador, atualizado ao vivo — usado pela
 * experiência de convite (27/08/2026) pra avisar o médico antes de tentar
 * abrir o WhatsApp sem internet, em vez de deixar o clique falhar em
 * silêncio.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
