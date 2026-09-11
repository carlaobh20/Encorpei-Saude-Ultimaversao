/**
 * CuidadoresPage — "Quem cuida de mim".
 * docs/ENGAJAMENTO-CARDIO.md §3.3 e §6.4
 *
 * Do ponto de vista do PACIENTE: é ele quem convida, a pessoa convidada só
 * enxerga o que ele liberar, e o acesso pode ser encerrado a qualquer
 * momento. Nada aqui é cadastrado pelo médico ou pela clínica.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhuma permissão, nenhum padrão de convite, nenhum texto — nem o do
 * WhatsApp, nem o da confirmação de encerrar acesso. Mudou:
 *
 *  · Os campos do convite ganharam rótulo de 17px e altura de 48px
 *    (`Formulario` + `Campo`). O modal era o lugar do app onde os campos
 *    ficaram com a altura padrão de 40px do shadcn — a menor da área do
 *    paciente, justo num formulário que ele preenche uma vez e sob pressão
 *    ("quero que minha filha veja isso").
 *
 *  · Os botões de "Copiar código" / "Encerrar acesso" saíram de `sm` (36px)
 *    para alvo de toque de verdade, e os dois botões só de ícone dos
 *    convites pendentes ganharam rótulo acessível — eram dois botões sem
 *    nome nenhum para quem usa leitor de tela.
 *
 *  · "Encerrar acesso" continua vermelho e continua atrás da confirmação.
 */
import { useState } from "react";
import {
  Users, Plus, Copy, Check, Share2, ShieldCheck, Pill, HeartPulse,
  FlaskConical, Bell, Stethoscope, X,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import { AppModal } from "@/components/shell/AppModal";
import { StatusBadge } from "@/components/shell/StatusBadge";
import { TelaPaciente, TituloSecao, Formulario, Campo } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import {
  useMeusCuidadores, PARENTESCOS, PERMISSOES_ROTULO, type PermissoesCuidador,
} from "@/hooks/useCuidadores";
import type { CaregiverLink } from "@/types/cardio";

const PERMISSOES_ICONE: Record<keyof PermissoesCuidador, typeof Pill> = {
  ver_medidas: HeartPulse,
  ver_remedios: Pill,
  ver_sintomas: Stethoscope,
  ver_exames: FlaskConical,
  receber_alertas: Bell,
};

const PADRAO_PERMISSOES: PermissoesCuidador = {
  ver_medidas: true,
  ver_remedios: true,
  ver_sintomas: false,
  ver_exames: false,
  receber_alertas: true,
};

function primeiroNome(nome?: string | null): string {
  if (!nome) return "";
  return nome.trim().split(/\s+/)[0];
}

function fmtData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function mensagemWhatsApp(codigo: string, nomeCuidador: string, nomePaciente: string): string {
  return (
    `Oi, ${nomeCuidador}! Quero que você acompanhe minha saúde do coração pelo Encorpei Cardio.\n\n` +
    `1. Baixe o app Encorpei Cardio\n` +
    `2. Crie sua conta\n` +
    `3. Toque em "Sou cuidador" e digite este código: ${codigo}\n\n` +
    `Assim você vai ver como ${nomePaciente || "eu"} está, sem precisar ficar perguntando toda hora.`
  );
}

/** "Chave grande" — cartão clicável que liga/desliga uma permissão. */
function PermissaoToggle({
  chave, valor, onChange,
}: {
  chave: keyof PermissoesCuidador;
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  const info = PERMISSOES_ROTULO[chave];
  const Icon = PERMISSOES_ICONE[chave];
  return (
    <button
      type="button"
      onClick={() => onChange(!valor)}
      aria-pressed={valor}
      className={cn(
        "w-full min-h-[64px] flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors",
        valor ? "border-primary bg-primary/5" : "border-border bg-card"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-xl grid place-items-center shrink-0",
        valor ? "bg-primary/15" : "bg-secondary"
      )}>
        <Icon className={cn("h-5 w-5", valor ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-foreground leading-snug">{info.titulo}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{info.descricao}</p>
      </div>
      <div className={cn(
        "h-6 w-6 rounded-full border-2 grid place-items-center shrink-0 mt-1",
        valor ? "bg-primary border-primary" : "border-border"
      )}>
        {valor && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
      </div>
    </button>
  );
}

function listaDoQueVe(c: CaregiverLink): string {
  const titulos = (Object.keys(PERMISSOES_ROTULO) as (keyof PermissoesCuidador)[])
    .filter((k) => c[k])
    .map((k) => PERMISSOES_ROTULO[k].titulo);
  return titulos.length > 0 ? titulos.join(" · ") : "Nada liberado ainda";
}

export default function CuidadoresPage() {
  const { profile } = useProfile();
  const { cuidadores, ativos, pendentes, isLoading, convidar, atualizarPermissoes, revogar } = useMeusCuidadores();

  const nomePaciente = primeiroNome(profile?.full_name);

  // ── Convidar ──────────────────────────────────────────────────────
  const [conviteAberto, setConviteAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [parentesco, setParentesco] = useState<string>("");
  const [email, setEmail] = useState("");
  const [permissoes, setPermissoes] = useState<PermissoesCuidador>(PADRAO_PERMISSOES);
  const [codigoGerado, setCodigoGerado] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<"codigo" | "mensagem" | null>(null);

  function fecharConvite(open: boolean) {
    setConviteAberto(open);
    if (!open) {
      setNome(""); setParentesco(""); setEmail("");
      setPermissoes(PADRAO_PERMISSOES);
      setCodigoGerado(null);
      setCopiado(null);
    }
  }

  async function enviarConvite() {
    if (!nome.trim() || !parentesco) return;
    try {
      const codigo = await convidar.mutateAsync({
        nome: nome.trim(),
        parentesco,
        email: email.trim() || undefined,
        ...permissoes,
      });
      if (codigo) setCodigoGerado(codigo);
    } catch {
      // useMeusCuidadores já mostra o toast de erro.
    }
  }

  async function copiar(texto: string, tipo: "codigo" | "mensagem") {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(tipo);
      toast.success(tipo === "codigo" ? "Código copiado." : "Mensagem copiada.");
      setTimeout(() => setCopiado(null), 1500);
    } catch { /* clipboard pode falhar sem https */ }
  }

  // ── Ajustar permissões de um cuidador ativo ─────────────────────────
  const [editando, setEditando] = useState<CaregiverLink | null>(null);
  const [permissoesEdicao, setPermissoesEdicao] = useState<PermissoesCuidador>(PADRAO_PERMISSOES);

  function abrirEdicao(c: CaregiverLink) {
    setEditando(c);
    setPermissoesEdicao({
      ver_medidas: c.ver_medidas,
      ver_remedios: c.ver_remedios,
      ver_sintomas: c.ver_sintomas,
      ver_exames: c.ver_exames,
      receber_alertas: c.receber_alertas,
    });
  }

  function salvarEdicao() {
    if (!editando) return;
    atualizarPermissoes.mutate({ id: editando.id, ...permissoesEdicao });
    setEditando(null);
  }

  // ── Encerrar acesso ──────────────────────────────────────────────────
  const [revogando, setRevogando] = useState<CaregiverLink | null>(null);

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Quem cuida de mim" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader
        title="Quem cuida de mim"
        subtitle="Familiares que acompanham a sua saúde"
        action={
          <Button size="lg" onClick={() => setConviteAberto(true)}>
            <Plus className="h-5 w-5" aria-hidden /> Convidar alguém
          </Button>
        }
      />

      {/* ── O que é ──────────────────────────────────────────────────── */}
      <SurfaceCard className="bg-primary/5 border border-primary/15">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-full bg-card grid place-items-center shrink-0">
            <Users className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-base font-semibold text-foreground leading-snug">
              Alguém da sua família pode acompanhar você por aqui
            </p>
            <p className="text-base text-muted-foreground leading-relaxed">
              A pessoa que você convidar vê seus números e é avisada se algo sair do lugar — sem
              precisar ficar te perguntando. <strong className="text-foreground">Quem convida é você</strong>,
              a pessoa só enxerga o que você liberar, e você pode encerrar o acesso a qualquer
              momento, sem pedir satisfação a ninguém.
            </p>
          </div>
        </div>
      </SurfaceCard>

      {cuidadores.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Você ainda não convidou ninguém"
          description="Convide um familiar para acompanhar sua saúde. É rápido e você decide o que ele vê."
          actionLabel="Convidar alguém"
          onAction={() => setConviteAberto(true)}
          variant="card"
        />
      ) : (
        <>
          {ativos.length > 0 && (
            <section>
              <TituloSecao titulo="Cuidadores ativos" />
              <div className="space-y-3">
                {ativos.map((c) => (
                  <SurfaceCard key={c.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-foreground break-words">{c.caregiver_nome}</p>
                          {c.parentesco && <StatusBadge variant="informativo">{c.parentesco}</StatusBadge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{listaDoQueVe(c)}</p>
                      </div>
                      <ShieldCheck className="h-6 w-6 text-success shrink-0" aria-label="Acesso ativo" />
                    </div>
                    {/* Nenhum azul cheio aqui: a ação azul da tela é convidar
                        alguém, e ela já está no cabeçalho. */}
                    <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border">
                      <Button variant="outline" onClick={() => abrirEdicao(c)}>
                        Ajustar permissões
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-error hover:text-error hover:bg-error/10"
                        onClick={() => setRevogando(c)}
                      >
                        <X className="h-4 w-4" aria-hidden /> Encerrar acesso
                      </Button>
                    </div>
                  </SurfaceCard>
                ))}
              </div>
            </section>
          )}

          {pendentes.length > 0 && (
            <section>
              <TituloSecao titulo="Convites pendentes" subtitulo="ainda não aceitos" />
              <div className="space-y-3">
                {pendentes.map((c) => (
                  <SurfaceCard key={c.id} className="bg-warning-bg/40 border-warning/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-foreground break-words">{c.caregiver_nome}</p>
                          {c.parentesco && <StatusBadge variant="pendente">{c.parentesco}</StatusBadge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1.5">
                          Código: <span className="font-mono font-bold tracking-widest text-foreground">{c.invite_code}</span>
                        </p>
                      </div>
                      {/* Botões só de ícone precisam de nome: eram dois "botão"
                          idênticos para quem usa leitor de tela. */}
                      <div className="flex items-center gap-1 shrink-0">
                        {c.invite_code && (
                          <Button
                            variant="ghost" size="icon"
                            aria-label={`Copiar o código de ${c.caregiver_nome}`}
                            onClick={() => copiar(c.invite_code!, "codigo")}
                          >
                            <Copy className="h-5 w-5" aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="icon"
                          aria-label={`Cancelar o convite de ${c.caregiver_nome}`}
                          className="text-muted-foreground hover:text-error"
                          onClick={() => setRevogando(c)}
                        >
                          <X className="h-5 w-5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </SurfaceCard>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Convidar ─────────────────────────────────────────────────── */}
      <AppModal
        open={conviteAberto}
        onOpenChange={fecharConvite}
        title={codigoGerado ? "Convite pronto" : "Convidar alguém"}
        className={codigoGerado ? "sm:max-w-lg" : undefined}
      >
        {codigoGerado ? (
          <div className="py-2 space-y-4">
            <div className="text-center py-2">
              <p className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Código do convite</p>
              <p className="font-display text-4xl font-bold tracking-[0.2em] text-primary break-all">{codigoGerado}</p>
            </div>
            <p className="text-base text-muted-foreground text-center leading-relaxed">
              Envie para {nome || "a pessoa"}. Ela baixa o app, cria a conta dela, toca em
              "Sou cuidador" e digita este código.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="lg" className="flex-1 min-w-[150px]" onClick={() => copiar(codigoGerado, "codigo")}>
                {copiado === "codigo" ? <Check className="h-5 w-5" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />} Copiar código
              </Button>
              <Button
                size="lg"
                className="flex-1 min-w-[150px]"
                onClick={() => copiar(mensagemWhatsApp(codigoGerado, nome, nomePaciente), "mensagem")}
              >
                <Share2 className="h-5 w-5" aria-hidden /> Copiar mensagem
              </Button>
            </div>
            <Button variant="ghost" size="lg" className="w-full" onClick={() => fecharConvite(false)}>
              Concluir
            </Button>
          </div>
        ) : (
          <Formulario className="py-2 space-y-5">
            <Campo rotulo="Nome da pessoa" para="cuidador-nome">
              <Input
                id="cuidador-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Maria"
              />
            </Campo>
            <Campo rotulo="Parentesco">
              <Select value={parentesco} onValueChange={setParentesco}>
                <SelectTrigger aria-label="Parentesco"><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
                <SelectContent>
                  {PARENTESCOS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="E-mail" ajuda="opcional" para="cuidador-email">
              <Input
                id="cuidador-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="opcional"
              />
            </Campo>
            <Campo rotulo="O que ela vai poder ver">
              <div className="space-y-2.5">
                {(Object.keys(PERMISSOES_ROTULO) as (keyof PermissoesCuidador)[]).map((chave) => (
                  <PermissaoToggle
                    key={chave}
                    chave={chave}
                    valor={permissoes[chave]}
                    onChange={(v) => setPermissoes((p) => ({ ...p, [chave]: v }))}
                  />
                ))}
              </div>
            </Campo>
            <Button
              className="w-full"
              size="xl"
              disabled={!nome.trim() || !parentesco || convidar.isPending}
              onClick={enviarConvite}
            >
              {convidar.isPending ? "Gerando código..." : "Gerar código de convite"}
            </Button>
          </Formulario>
        )}
      </AppModal>

      {/* ── Ajustar permissões ──────────────────────────────────────── */}
      <AppModal
        open={!!editando}
        onOpenChange={(o) => { if (!o) setEditando(null); }}
        title={editando ? `O que ${editando.caregiver_nome} pode ver` : ""}
      >
        <div className="py-2 space-y-4">
          <div className="space-y-2.5">
            {(Object.keys(PERMISSOES_ROTULO) as (keyof PermissoesCuidador)[]).map((chave) => (
              <PermissaoToggle
                key={chave}
                chave={chave}
                valor={permissoesEdicao[chave]}
                onChange={(v) => setPermissoesEdicao((p) => ({ ...p, [chave]: v }))}
              />
            ))}
          </div>
          <Button
            className="w-full"
            size="xl"
            disabled={atualizarPermissoes.isPending}
            onClick={salvarEdicao}
          >
            {atualizarPermissoes.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </AppModal>

      {/* ── Encerrar acesso ─────────────────────────────────────────── */}
      <AlertDialog open={!!revogando} onOpenChange={(o) => { if (!o) setRevogando(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {revogando?.status === "pending" ? "Cancelar este convite?" : "Encerrar este acesso?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {revogando?.caregiver_nome} {revogando?.status === "pending"
                ? "não vai mais poder usar este código."
                : "deixa de ver os seus dados imediatamente. Você pode convidar de novo quando quiser."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-[48px]">Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[48px] bg-error text-white hover:bg-error/90"
              onClick={() => { if (revogando) revogar.mutate(revogando.id); setRevogando(null); }}
            >
              {revogando?.status === "pending" ? "Cancelar convite" : "Encerrar acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TelaPaciente>
  );
}
