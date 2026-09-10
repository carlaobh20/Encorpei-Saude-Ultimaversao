/**
 * Seletor de emoji simples (médico e paciente compartilham). Sem dependência
 * externa: um popover com uma grade de emojis úteis na conversa entre um
 * adulto em acompanhamento cardiológico e o cardiologista dele. Ao escolher,
 * chama onSelect(emoji) — o pai decide onde inserir (normalmente no fim do
 * texto do composer). Fecha ao clicar fora ou apertar Esc.
 */
import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Conjunto enxuto e adulto — o que este chat realmente precisa dizer.
 *
 * ── Por que este conjunto mudou (auditoria de setembro/2026) ──────────
 * A grade herdada do app de obstetrícia que originou este projeto oferecia
 * 🤰 👶 🍼 a um senhor de 68 anos falando com o cardiologista dele. Além de
 * não fazer sentido, custava espaço numa grade pequena que deveria estar
 * cheia do que ele precisa: dizer como está passando, agradecer, confirmar
 * que tomou o remédio, marcar que algo dói.
 *
 * As quatro linhas respondem quatro necessidades, nesta ordem:
 *   1. como estou hoje (do bem ao mal — sem infantilizar);
 *   2. sinais do corpo que ele relata (peito, tontura, falta de ar, sono);
 *   3. cortesia e combinado (obrigado, entendi, sim/não);
 *   4. rotina de acompanhamento (remédio, pressão, exame, consulta, anexo).
 */
const EMOJIS = [
  "🙂", "😊", "😌", "😐", "😕", "😟", "😣", "😞",
  "❤️", "💙", "💪", "😴", "😮‍💨", "🥵", "🤒", "😵‍💫",
  "👍", "👌", "🙏", "👏", "🤝", "✅", "❌", "❓",
  "💊", "🩺", "🩸", "⚖️", "🚶", "📅", "📝", "📎",
];

export function EmojiPicker({
  onSelect,
  className,
  disabled,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Inserir emoji"
        aria-expanded={open}
        className={className}
      >
        <Smile className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full mb-2 left-0 z-50 w-[268px] rounded-2xl border border-border bg-card shadow-lg p-2 grid grid-cols-8 gap-0.5"
        >
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => { onSelect(e); setOpen(false); }}
              className={cn(
                "h-8 w-8 grid place-items-center rounded-lg text-lg leading-none",
                "hover:bg-secondary transition-colors",
              )}
              aria-label={`Emoji ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
