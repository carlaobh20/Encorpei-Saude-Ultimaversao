/**
 * ══════════════════════════════════════════════════════════════════════
 * LINGUAGEM VISUAL DAS TELAS DO PACIENTE
 * ══════════════════════════════════════════════════════════════════════
 *
 * Por que este arquivo existe, e por que ele NÃO é `Primitivos.tsx`:
 *
 * `Primitivos.tsx` guarda as peças que a tela inicial inventou — o cartão
 * azul, a barra de progresso, o cartão de medida. Elas resolvem a HOME. Só
 * que a casca nova parou ali: as outras vinte e tantas telas do paciente
 * continuaram cada uma com o seu título de seção, o seu jeito de empilhar
 * rótulo e campo, o seu cinza de separador. O resultado era o mesmo problema
 * que os primitivos resolveram na home, espalhado por fora dela.
 *
 * O que mora aqui é o que se repete FORA da home: cabeçalho de seção,
 * formulário, escolha entre opções, lista, estado de carregar/erro/vazio.
 *
 * ── A regra que separa este arquivo do `shell/` antigo ────────────────
 * `SectionHeader`, `StatCard` e `EmptyState` continuam existindo e continuam
 * sendo usados pelas telas do MÉDICO e do ADMIN, que são densas por contrato
 * (CONTRATO-DE-CODIGO.md, "Tom de escrita"). Subir a escala tipográfica
 * dentro deles tiraria informação da primeira dobra de quem precisa de
 * informação. Por isso a variante do paciente é COMPONENTE NOVO, e não
 * `variant="paciente"` enfiado no componente compartilhado: variante nova
 * não tem como quebrar tela alheia.
 *
 * ── E a regra que atravessa tudo que está aqui ────────────────────────
 * Nada nestes componentes interpreta número. Não existe "verde = bom".
 * Estado sempre traz TEXTO junto da cor — cor sozinha não informa quem não
 * enxerga cor, e num app de 60–75 anos isso é a maioria mais do que se supõe.
 */

import { type ReactNode } from "react";
import { AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── A coluna da tela ─────────────────────────────────────────────────

/**
 * O invólucro de toda tela do paciente que não é a home.
 *
 * ── Por que existe um teto de largura ─────────────────────────────────
 * O `<main>` do AppShell não tem largura máxima — quem a define é a página.
 * A home define a dela com `LayoutPainel` (duas colunas, teto de 1440px);
 * todas as outras não definiam nenhuma. Num monitor de 1440px isso produzia
 * cartões de 1.300px de largura com uma frase de oito palavras dentro, campos
 * de formulário do tamanho da mesa, e listas em que a data ficava a meio metro
 * do valor. `max-w-3xl` (768px) é onde a linha de texto fica em torno de 80
 * caracteres — o limite clássico de leitura — e onde um gráfico de 14 barras
 * ainda respira.
 *
 * ── Por que NÃO é `LayoutPainel` ──────────────────────────────────────
 * Duas colunas só fazem sentido quando existe conteúdo de CONSULTA para pôr
 * na coluna de apoio, que é o caso da home (pulseira, equipe, atalhos). Nas
 * telas de assunto único — pressão, peso, glicemia — a segunda coluna seria
 * preenchida com pedaço arbitrário do fluxo principal, e o paciente passaria
 * a ler em zigue-zague.
 *
 * `space-y-5` é o respiro entre blocos, igual em todas as telas: a diferença
 * de espaçamento entre telas era o que mais fazia o app parecer costurado de
 * pedaços. O `pb` cobre a barra inferior e o botão flutuante de socorro — o
 * `<main>` já reserva o espaço, e este é só a folga de leitura no fim.
 */
export function TelaPaciente({
  children,
  className,
  largura = "leitura",
}: {
  children: ReactNode;
  className?: string;
  /** "leitura" (padrão, 768px) · "larga" para grades de cartão (1024px). */
  largura?: "leitura" | "larga";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-5 pb-6",
        largura === "larga" ? "max-w-5xl" : "max-w-3xl",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Cabeçalho de seção ───────────────────────────────────────────────

/**
 * O título que divide a tela do paciente.
 *
 * Some do `SectionHeader` antigo: `text-sm` (que virava 17px na escala do
 * paciente e ficava do mesmo tamanho do corpo do texto — ou seja, deixava de
 * ser título). Aqui é `text-xl` em `font-display`, a mesma voz de "Minha
 * evolução" e "Seus últimos registros" na home.
 *
 * `acao` é o link discreto da direita ("Ver todos"), nunca um segundo botão
 * azul: a tela já tem o dela.
 */
export function TituloSecao({
  titulo,
  subtitulo,
  icone: Icone,
  acao,
  className,
}: {
  titulo: string;
  subtitulo?: string;
  icone?: LucideIcon;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    // `flex-wrap` + `min-w-0`: em 360px um título de quatro palavras com ação
    // à direita não pode empurrar a ação para fora da tela — ela desce.
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-3", className)}>
      <div className="flex items-baseline gap-2 min-w-0">
        {Icone ? (
          <Icone className="h-5 w-5 shrink-0 text-muted-foreground translate-y-0.5" strokeWidth={1.75} aria-hidden />
        ) : null}
        <h2 className="font-display text-xl font-semibold leading-tight text-foreground break-words">
          {titulo}
        </h2>
      </div>
      {subtitulo ? (
        <p className="text-sm text-muted-foreground min-w-0 break-words">{subtitulo}</p>
      ) : null}
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}

// ── Formulário ───────────────────────────────────────────────────────

/**
 * A coluna de leitura de um formulário.
 *
 * `max-w-2xl` não é preferência: num monitor de 1440px o formulário herdava a
 * largura do painel e o campo "Sistólica" virava uma faixa de 900px com um
 * número de três dígitos dentro. Campo largo demais aumenta o caminho do olho
 * entre o rótulo e o que se digita, e é exatamente aí que o paciente de 68
 * anos erra a linha.
 *
 * As variantes de seletor engordam campo e área de toque de uma vez só: 48px
 * de altura em `input`/`textarea`/gatilho de `Select`, cantos `rounded-xl`,
 * texto no piso legível. Sem isso, cada tela repetia `h-12 rounded-xl
 * text-base` em cada campo — e esquecia num deles.
 */
export function Formulario({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl",
        // Altura, canto e corpo do campo aplicados UMA vez, por seletor, em
        // vez de repetir `h-12 rounded-xl text-base` em cada `<Input>` — que é
        // como a repetição começava e como um campo sempre ficava de fora.
        //
        // O `:not([class*=...])` NÃO é preciosismo. Um seletor descendente
        // (`.classe input`) tem especificidade maior que a classe utilitária
        // no próprio elemento (`.h-14`), então sem a guarda estas regras
        // venceriam TODO ajuste local — e os campos de número grande da
        // pressão, da glicemia e dos testes de capacidade encolheriam de 56px
        // para 48px, com o número caindo de 24px para 17px. A guarda inverte
        // isso: quem já declarou a própria altura, o próprio canto ou
        // QUALQUER classe `text-*` fica de fora e continua mandando. A guarda
        // de texto é grosseira de propósito — é substring, não análise de
        // utilitário: se o autor do campo escreveu alguma coisa de texto ali,
        // a decisão é dele e a regra genérica não entra por cima.
        "[&_input:not([class*=h-])]:h-12",
        "[&_input:not([class*=rounded])]:rounded-xl",
        "[&_input:not([class*=text-])]:text-base",
        "[&_textarea:not([class*=rounded])]:rounded-xl",
        "[&_textarea:not([class*=text-])]:text-base",
        "[&_textarea]:leading-relaxed",
        "[&_[role=combobox]]:h-12 [&_[role=combobox]]:rounded-xl [&_[role=combobox]]:text-base",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Rótulo + campo + ajuda + erro, sempre nesta ordem.
 *
 * A ajuda vem ANTES do campo e o erro DEPOIS, de propósito: ajuda que aparece
 * embaixo é lida depois de já ter errado, e erro que aparece em cima é lido
 * antes de existir. O erro carrega ícone e texto — nunca só a borda vermelha,
 * que não existe para quem não enxerga cor.
 */
export function Campo({
  rotulo,
  para,
  ajuda,
  erro,
  children,
  className,
}: {
  rotulo: ReactNode;
  /** `htmlFor` do controle. Sem ele o rótulo não é clicável — e 44px de alvo se perdem. */
  para?: string;
  ajuda?: ReactNode;
  erro?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label
        htmlFor={para}
        className="block text-base font-medium text-foreground leading-snug"
      >
        {rotulo}
      </label>
      {ajuda ? (
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{ajuda}</p>
      ) : null}
      <div className="mt-2">{children}</div>
      {erro ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-error" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>{erro}</span>
        </p>
      ) : null}
    </div>
  );
}

// ── Escolha entre opções ─────────────────────────────────────────────

/**
 * O botão de escolha que aparece em Pressão, Glicemia, Sintomas, Alimentação
 * e "Como estou" — cinco telas que o desenhavam de cinco jeitos (altura 44,
 * 48 ou 11×4, borda simples ou dupla, selecionado em azul cheio ou em fundo
 * claro). Agora é um só: 48px, borda que engrossa quando marcado, fundo
 * `cardio-50` e texto em `primary`.
 *
 * O `aria-pressed` não é enfeite de acessibilidade: sem ele, quem usa leitor
 * de tela ouve "Em jejum, botão" e não tem como saber que já escolheu.
 */
export function OpcaoBotao({
  selecionado,
  onClick,
  titulo,
  descricao,
  className,
  disabled,
}: {
  selecionado: boolean;
  onClick: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      disabled={disabled}
      className={cn(
        "min-h-[48px] w-full rounded-xl border px-4 py-2.5 text-left text-base font-medium",
        "transition-colors disabled:opacity-50",
        selecionado
          ? "border-primary bg-cardio-50 text-primary font-semibold"
          : "border-border bg-card text-foreground hover:border-primary/40",
        className
      )}
    >
      <span className="block leading-snug break-words">{titulo}</span>
      {descricao ? (
        <span className="mt-0.5 block text-sm font-normal text-muted-foreground leading-snug">
          {descricao}
        </span>
      ) : null}
    </button>
  );
}

/** Grade de opções. Uma coluna no muito estreito; duas a partir de 420px. */
export function GradeOpcoes({
  children,
  colunas = 2,
  className,
}: {
  children: ReactNode;
  colunas?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        colunas === 1 && "grid-cols-1",
        colunas === 2 && "grid-cols-1 min-[420px]:grid-cols-2",
        colunas === 3 && "grid-cols-2 min-[420px]:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

// ── Listas ───────────────────────────────────────────────────────────

/**
 * Lista com separador fino e respiro.
 *
 * O separador é `border-border` e nada mais — linha forte entre itens de uma
 * mesma lista transforma dez registros em dez caixas, e o olho passa a contar
 * caixas em vez de ler valores.
 */
export function Lista({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("divide-y divide-border", className)}>{children}</ul>;
}

/**
 * Linha de lista. 48px de altura mínima porque 44 é o piso do alvo de toque e
 * um piso exato não sobrevive ao primeiro texto que quebra em duas linhas.
 */
export function ItemLista({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "flex min-h-[48px] items-center justify-between gap-3 py-3 first:pt-0 last:pb-0",
        className
      )}
    >
      {children}
    </li>
  );
}

// ── Barra de proporção genérica ──────────────────────────────────────

/**
 * Barra para quando o número NÃO é "quanto do combinado eu fiz" — adesão de
 * remédio, composição do sono, minutos da semana. `BarraProgresso` (em
 * Primitivos) fala de tarefa do dia e vem sempre em teal; esta aceita a cor
 * do assunto.
 *
 * `rotulo` é obrigatório e não é decoração: a barra sozinha é cor e
 * comprimento, e nenhum dos dois é lido por quem usa leitor de tela.
 */
export function BarraProporcao({
  percentual,
  rotulo,
  valor,
  cor,
  className,
}: {
  /** 0–100. Quem chama já arredondou. */
  percentual: number;
  rotulo: string;
  /** O número em texto ("82%", "6h30 · 34%"). Fica à direita do rótulo. */
  valor: string;
  /** CSS color. Sem cor, usa o azul da marca. */
  cor?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, percentual));
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-base text-muted-foreground min-w-0 break-words">{rotulo}</span>
        <span className="text-base font-semibold text-foreground tabular-nums shrink-0">{valor}</span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${rotulo}: ${valor}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%`, background: cor ?? "hsl(var(--brand-cardio))" }}
        />
      </div>
    </div>
  );
}

// ── Aviso da tela (atenção / informação) ─────────────────────────────

/**
 * O bloco de aviso que a home desenhou e que todas as telas copiaram mal.
 *
 * Borda grossa à ESQUERDA em vez de cartão inteiro colorido: o fundo colorido
 * cheio compete com o cartão azul de ação da tela, e dois blocos de cor
 * gritando ao mesmo tempo é o mesmo que nenhum. `tom` nunca substitui texto —
 * o título e o corpo dizem o que é.
 */
export function AvisoDaTela({
  tom = "atencao",
  titulo,
  children,
  className,
}: {
  tom?: "atencao" | "grave" | "informacao";
  titulo?: string;
  children: ReactNode;
  className?: string;
}) {
  const estilo =
    tom === "grave" ? "bg-error-bg border-error"
    : tom === "atencao" ? "bg-warning-bg border-warning"
    : "bg-cardio-50 border-primary";

  const corIcone =
    tom === "grave" ? "text-error"
    : tom === "atencao" ? "text-warning"
    : "text-primary";

  return (
    <section
      className={cn("rounded-2xl border-l-4 p-4 md:p-5", estilo, className)}
      aria-label={titulo ?? "Aviso"}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("h-6 w-6 shrink-0 mt-0.5", corIcone)} aria-hidden />
        <div className="min-w-0">
          {titulo ? (
            <p className="text-lg font-semibold text-foreground leading-snug">{titulo}</p>
          ) : null}
          <div className={cn("text-base text-foreground leading-relaxed", titulo && "mt-1")}>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Erro de bloco ────────────────────────────────────────────────────

/**
 * Erro dentro de um cartão, na escala do paciente.
 *
 * `CardError` (ErrorStates.tsx) continua servindo as telas do médico, onde a
 * mensagem de 14px no meio de uma grade densa está certa. Aqui a mensagem é
 * frase inteira e o botão é alvo de toque de verdade: quem falhou em carregar
 * precisa conseguir tentar de novo com o polegar.
 */
export function CartaoErro({
  mensagem = "Não consegui carregar isto agora.",
  onTentarDeNovo,
  className,
}: {
  mensagem?: string;
  onTentarDeNovo?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-error/25 bg-error-bg p-4 md:p-5", className)}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 shrink-0 text-error mt-0.5" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base text-foreground leading-relaxed">{mensagem}</p>
          {onTentarDeNovo ? (
            <Button
              variant="outline"
              className="mt-3 h-12 gap-2 text-base"
              onClick={onTentarDeNovo}
            >
              <RefreshCw className="h-5 w-5" aria-hidden />
              Tentar de novo
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
