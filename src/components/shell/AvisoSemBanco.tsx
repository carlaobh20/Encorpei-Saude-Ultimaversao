import { AlertTriangle } from "lucide-react";
import { SUPABASE_CONFIGURADO } from "@/lib/config";

/**
 * Aviso nas telas de login quando o app está publicado sem banco.
 *
 * Sem isso, quem abre o endereço da Vercel antes de configurar o Supabase
 * tenta entrar, recebe um erro de rede genérico e conclui que o app está
 * quebrado — quando na verdade só falta a configuração.
 */
export function AvisoSemBanco() {
  if (SUPABASE_CONFIGURADO) return null;

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-3.5 text-[13px] leading-relaxed text-foreground">
      <p className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-warning" />
        <span>
          <strong className="font-semibold">Banco de dados ainda não configurado.</strong> Criar conta e
          entrar não vão funcionar por enquanto. Para conhecer o app agora, use o
          botão de demonstração na página inicial.
        </span>
      </p>
    </div>
  );
}
