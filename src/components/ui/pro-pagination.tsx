/**
 * Paginação simples para listas do lado médico (Resumo entre consultas, 28/08/2026).
 * Não existia nenhum componente de paginação no app — esse é novo e local,
 * pensado pra listas de até algumas dezenas de pacientes (sem "..." de
 * truncamento, que não compensa nesse volume).
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function ProPagination({ page, pageSize, total, onPageChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between gap-2 px-1 pt-2 flex-wrap">
      <p className="text-[11px] text-muted-foreground">
        Mostrando {from} a {to} de {total} {total === 1 ? "paciente" : "pacientes"}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-7 w-7 grid place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={cn(
              "h-7 min-w-7 px-1.5 rounded-lg text-xs font-semibold transition-colors",
              p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/40",
            )}
          >
            {p}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-7 w-7 grid place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary/40 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Próxima página"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
