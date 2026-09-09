/**
 * Seletor de emoji simples (médico e mamãe compartilham). Sem dependência
 * externa: um popover com uma grade de emojis frequentes no contexto de
 * acompanhamento de gestação. Ao escolher, chama onSelect(emoji) — o pai
 * decide onde inserir (normalmente no fim do texto do composer). Fecha ao
 * clicar fora ou apertar Esc.
 */
import { useState, useRef, useEffect } from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// Conjunto enxuto e útil — reações, apoio, gestação e agenda.
const EMOJIS = [
  "😊", "😀", "😍", "🥰", "😂", "😅", "😌", "🙂",
  "😢", "😟", "😰", "🤗", "😴", "🤒", "🤢", "🥴",
  "👍", "👏", "🙏", "🙌", "💪", "🤝", "👌", "✌️",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "💕", "🌸",
  "🤰", "👶", "🍼", "🎉", "✨", "⭐", "🔥", "💧",
  "✅", "❌", "⏰", "📅", "📎", "📸", "📝", "❓",
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
