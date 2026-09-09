import { Link } from "react-router-dom";
import { Users, Stethoscope, Clock3, Link2, MessageSquareWarning, MessagesSquare, Loader2 } from "lucide-react";
import { useAdminStats } from "@/hooks/useAdminStats";

const CARDS = [
  { key: "total_patients" as const, label: "Pacientes cadastradas", icon: Users },
  { key: "total_professionals" as const, label: "Médicos cadastrados", icon: Stethoscope },
  { key: "pending_professionals" as const, label: "Médicos aguardando aprovação", icon: Clock3, link: "/admin/medicos", highlight: true },
  { key: "active_links" as const, label: "Vínculos ativos", icon: Link2 },
  { key: "feedback_new" as const, label: "Feedbacks novos", icon: MessageSquareWarning },
  { key: "feedback_total" as const, label: "Feedbacks (total)", icon: MessageSquareWarning },
  { key: "messages_last_24h" as const, label: "Mensagens (24h)", icon: MessagesSquare },
];

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isError, error } = useAdminStats();

  return (
    <div className="px-5 md:px-8 py-6 md:py-8 max-w-[900px] mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-white/50 mt-1">
          Números reais do banco — nada aqui é estimativa. v1: contagens gerais e feedbacks.
        </p>
      </header>

      {isLoading && (
        <div className="flex items-center gap-2 text-white/60 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          Não foi possível carregar os números. {(error as any)?.message}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CARDS.map((c) => {
            const value = stats[c.key] ?? 0;
            const isPendingHighlight = "highlight" in c && c.highlight && value > 0;
            const card = (
              <div
                className={
                  isPendingHighlight
                    ? "rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"
                    : "rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                }
              >
                <c.icon className={isPendingHighlight ? "h-4 w-4 text-amber-300 mb-2" : "h-4 w-4 text-white/40 mb-2"} strokeWidth={1.75} />
                <p className={isPendingHighlight ? "text-2xl font-semibold tabular-nums text-amber-300" : "text-2xl font-semibold tabular-nums"}>
                  {value}
                </p>
                <p className="text-[11.5px] text-white/50 mt-1">{c.label}</p>
              </div>
            );
            return "link" in c && c.link ? (
              <Link key={c.key} to={c.link}>{card}</Link>
            ) : (
              <div key={c.key}>{card}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
