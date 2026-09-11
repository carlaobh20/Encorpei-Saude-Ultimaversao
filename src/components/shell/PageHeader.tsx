import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backLink?: string;
  action?: ReactNode;
}

/**
 * O cabeçalho de toda página — do paciente, do médico e do admin.
 *
 * A escala do título NÃO muda por perfil e não deve mudar: `h1` já é
 * `text-2xl` no tema, e dentro da casca do paciente a classe
 * `leitura-paciente` (index.css) sobe o subtítulo sozinha. Mexer no tamanho
 * aqui mudaria as telas do médico junto — que são densas por contrato.
 *
 * O que mudou nesta passada é só comportamento de quebra. Em 360px, um título
 * como "Alimentação" ao lado de um botão de ação ("Anexar resultado")
 * espremia as duas coisas até o texto sair pela lateral: o `flex` não
 * quebrava, o `truncate` não existia, e a ação ficava fora da tela. Agora a
 * linha quebra — ação desce para baixo do título —, o bloco de texto pode
 * encolher (`min-w-0`) e palavra longa parte em vez de estourar
 * (`break-words`). Em telas largas nada disso tem efeito visível: a linha
 * continua cabendo, e o layout é o mesmo de antes.
 */
export function PageHeader({ title, subtitle, backLink, action }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6">
      {/* `basis-64` é o que faz o `flex-wrap` acima funcionar de verdade: com
          `flex-1` puro (base 0) o bloco de texto encolhia até o título partir no
          meio da palavra ("Exam/es" em 360px) e a ação nunca descia de linha.
          Com uma base de 16rem, quando título + ação não cabem juntos a ação vai
          para a linha de baixo — e em tela larga nada muda, porque continua
          crescendo. */}
      <div className="flex items-start gap-3 min-w-0 flex-1 basis-64">
        {backLink && (
          <Button
            variant="ghost"
            size="icon"
            className="touch-target mt-0.5 shrink-0"
            onClick={() => navigate(backLink)}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}
        <div className="min-w-0">
          <h1 className="break-words">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed break-words">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
