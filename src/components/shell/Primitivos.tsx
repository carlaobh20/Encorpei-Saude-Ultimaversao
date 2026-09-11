/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ══════════════════════════════════════════════════════════════════════
 * PRIMITIVOS DE APRESENTAÇÃO — a base visual da área do paciente
 * ══════════════════════════════════════════════════════════════════════
 *
 * Por que existem: antes disso, cada tela desenhava o próprio cartão de
 * medida, a própria barra de progresso, o próprio atalho. O resultado eram
 * doze variações da mesma coisa, e qualquer ajuste de identidade virava uma
 * caçada por arquivo. Estes componentes são a resposta — e são deliberadamente
 * BURROS: recebem valor pronto, não decidem nada clínico.
 *
 * REGRA QUE ATRAVESSA TODOS ELES: nenhum primitivo interpreta número. Não
 * existe "verde = bom" aqui. Cor de estado só entra quando quem chama passa
 * um estado que veio de regra clínica, e sempre acompanhada de TEXTO — cor
 * sozinha não informa quem não enxerga cor.
 */

import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Cartão de destaque (o azul da tela inicial) ──────────────────────

/**
 * O único bloco azul cheio da tela. Existe para responder "o que eu preciso
 * fazer agora" — e por isso é um por página, no máximo. Dois blocos azuis
 * competindo é o mesmo que nenhum.
 */
export function CartaoDestaque({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-cardio))] to-[hsl(var(--brand-cardio-dark))]",
        "text-white p-5 md:p-6 shadow-lg shadow-[hsl(var(--brand-cardio))]/20",
        className
      )}
    >
      {children}
    </section>
  );
}

// ── Barra de progresso ───────────────────────────────────────────────

/**
 * Progresso em teal, nunca em verde: verde lido num app de saúde é entendido
 * como "seu resultado está bom", e isto aqui mede apenas quanto do combinado
 * do dia foi registrado. O rótulo textual é obrigatório justamente por isso.
 */
export function BarraProgresso({
  feitos,
  total,
  className,
  tom = "claro",
}: {
  feitos: number;
  total: number;
  className?: string;
  /** "claro" = sobre fundo azul; "escuro" = sobre fundo branco. */
  tom?: "claro" | "escuro";
}) {
  const pct = total > 0 ? Math.min(100, Math.round((feitos / total) * 100)) : 0;
  return (
    <div
      className={cn("h-2.5 w-full rounded-full overflow-hidden", tom === "claro" ? "bg-white/25" : "bg-muted", className)}
      role="progressbar"
      aria-valuenow={feitos}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${feitos} de ${total} concluídos`}
    >
      <div
        className="h-full rounded-full bg-progresso transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Cartão de medida ─────────────────────────────────────────────────

export interface MedidaExibida {
  rotulo: string;
  icone: LucideIcon;
  /** Já formatado. `null` significa AUSÊNCIA — nunca passe zero no lugar. */
  valor: string | null;
  unidade?: string;
  /** "Hoje, 08:10" — já formatado por quem chama. */
  quando?: string | null;
  /** "Manual", "Pulseira", "Importado" — a procedência do dado. */
  origem?: string | null;
  /** Verdadeiro quando o valor é estimativa de sensor, não medida validada. */
  estimativa?: boolean;
  para?: string;
}

/**
 * Um número do corpo, com tudo que o torna interpretável: quando foi medido e
 * de onde veio. Sem esses dois, "124/78" é um número sem dono.
 *
 * Ausência de dado NÃO vira zero e não vira traço solto: vira a frase "sem
 * registro". Zero é um valor clínico legítimo em várias medidas, e usá-lo como
 * placeholder é como mentir com aparência de dado.
 */
export function CartaoMedida({ m, className }: { m: MedidaExibida; className?: string }) {
  const conteudo = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <m.icone className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} aria-hidden />
        <span className="text-sm font-medium text-muted-foreground truncate">{m.rotulo}</span>
      </div>

      {m.valor === null ? (
        <p className="text-base text-muted-foreground">Sem registro</p>
      ) : (
        // `flex flex-wrap` em vez de número e unidade colados: sem nenhum ponto
        // de quebra entre "129/77" e "mmHg", a unidade saía por fora do cartão
        // (29px além da borda em 390px). Agora ela desce de linha quando não
        // cabe — e continua ao lado do número sempre que cabe.
        <p className="flex flex-wrap items-baseline gap-x-1 text-[28px] leading-none font-semibold tabular-nums text-foreground">
          <span>{m.valor}</span>
          {m.unidade ? <span className="text-base font-medium text-muted-foreground">{m.unidade}</span> : null}
        </p>
      )}

      <div className="mt-2 space-y-1">
        {m.quando ? <p className="text-xs text-muted-foreground">{m.quando}</p> : null}
        {m.origem ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {m.origem}
          </span>
        ) : null}
        {m.estimativa ? (
          <p className="text-xs text-warning-forte">Estimativa do aparelho</p>
        ) : null}
      </div>
    </>
  );

  const base = "rounded-2xl border border-border bg-card p-4 shadow-sm min-w-0";

  if (m.para) {
    return (
      <Link to={m.para} className={cn(base, "block transition-shadow hover:shadow-md focus-visible:shadow-md", className)}>
        {conteudo}
      </Link>
    );
  }
  return <div className={cn(base, className)}>{conteudo}</div>;
}

// ── Linha de recurso (pulseira, consulta, atalho de lista) ───────────

export function LinhaRecurso({
  icone: Icone,
  titulo,
  detalhe,
  para,
  onClick,
  marcador,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  detalhe?: ReactNode;
  para?: string;
  onClick?: () => void;
  /** Pontinho de estado. Sempre acompanhado de texto em `detalhe`. */
  marcador?: "ok" | "atencao" | "parado" | null;
  className?: string;
}) {
  const corMarcador =
    marcador === "ok" ? "bg-progresso"
    : marcador === "atencao" ? "bg-warning"
    : marcador === "parado" ? "bg-muted-foreground/40"
    : null;

  const dentro = (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
        <Icone className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-2">
          <span className="block text-base font-semibold text-foreground truncate">{titulo}</span>
          {corMarcador ? <span className={cn("h-2 w-2 rounded-full shrink-0", corMarcador)} aria-hidden /> : null}
        </span>
        {detalhe ? <span className="block text-sm text-muted-foreground mt-0.5">{detalhe}</span> : null}
      </span>
      <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
    </>
  );

  const base =
    "flex items-center gap-3 w-full min-h-[64px] rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md";

  if (para) return <Link to={para} className={cn(base, className)}>{dentro}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={cn(base, className)}>{dentro}</button>;
  return <div className={cn(base, className)}>{dentro}</div>;
}

// ── Atalho compacto (grade de 2 colunas) ─────────────────────────────

export function Atalho({
  icone: Icone,
  rotulo,
  para,
}: {
  icone: LucideIcon;
  rotulo: string;
  para: string;
}) {
  return (
    <Link
      to={para}
      className="flex items-center gap-2.5 min-h-[52px] rounded-xl border border-border bg-card px-3 py-2.5 text-base font-medium shadow-sm transition-shadow hover:shadow-md"
    >
      <Icone className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="truncate">{rotulo}</span>
    </Link>
  );
}

// ── Painel da coluna de apoio ────────────────────────────────────────

export function Painel({
  titulo,
  acao,
  children,
  className,
}: {
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 md:p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold leading-tight">{titulo}</h2>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
      {children}
    </section>
  );
}

// ── Estrutura de duas colunas do painel ──────────────────────────────

/**
 * Duas terças / uma terça em telas largas, empilhado abaixo disso.
 *
 * O `max-w-[1440px]` não é enfeite: sem teto, num monitor ultrawide a linha
 * de texto passa de 200 caracteres e fica ilegível; com teto baixo demais,
 * sobra faixa cinza dos dois lados e o painel parece um app de celular
 * esticado. 1440 é onde as duas colunas ainda respiram.
 */
export function LayoutPainel({
  principal,
  apoio,
}: {
  principal: ReactNode;
  apoio: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1440px] grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-4 lg:gap-6 items-start">
      <div className="min-w-0 space-y-4 lg:space-y-6">{principal}</div>
      <div className="min-w-0 space-y-4 lg:space-y-6">{apoio}</div>
    </div>
  );
}
