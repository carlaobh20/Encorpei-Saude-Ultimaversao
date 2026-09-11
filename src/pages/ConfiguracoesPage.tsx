import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader, SurfaceCard, TelaPaciente, TituloSecao } from "@/components/shell";
import { Bell, Pill, Type, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const PREFS_KEY = "encorpei_cardio_preferencias";

interface Prefs {
  lembretesRemedio: boolean;
  notificacoes: boolean;
  fonteGrande: boolean;
  altoContraste: boolean;
}

const PREFS_PADRAO: Prefs = {
  lembretesRemedio: true,
  notificacoes: true,
  fonteGrande: false,
  altoContraste: false,
};

/** Preferências do app — nenhuma delas é dado clínico, por isso vivem só no navegador. */
function lerPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return PREFS_PADRAO;
    return { ...PREFS_PADRAO, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return PREFS_PADRAO;
  }
}

function salvarPrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // modo privado sem storage — preferência simplesmente não persiste
  }
}

function ToggleRow({
  icon: Icon, label, hint, checked, onChange,
}: { icon: React.ElementType; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="w-full min-h-[56px] flex items-center gap-3.5 py-3.5 text-left"
    >
      <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-foreground leading-snug">{label}</p>
        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>
      </div>
      {/* Estado em PALAVRA, não só em cor e posição: esta é a tela de quem
          liga "mais contraste" porque tem dificuldade com exatamente isso. */}
      <span className="shrink-0 flex items-center gap-2">
        <span className={cn("text-sm font-medium", checked ? "text-primary" : "text-muted-foreground")}>
          {checked ? "Ligado" : "Desligado"}
        </span>
        <span
          className={cn("h-7 w-12 rounded-full transition-colors motion-reduce:transition-none relative", checked ? "bg-primary" : "bg-secondary border border-border")}
          aria-hidden
        >
          <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
        </span>
      </span>
    </button>
  );
}

/**
 * PREFERÊNCIAS — como o app se comporta com este paciente.
 *
 * ── Por que esta tela mudou de nome (auditoria de setembro/2026) ───────
 * Existiam "Minha Conta" e "Configurações", e o paciente não tinha como
 * saber qual das duas guardava o quê: os dois nomes prometem "o lugar dos
 * meus ajustes". A divisão passou a ser por PERGUNTA, não por tradição de
 * software:
 *   /conta         → "quem eu sou e o que é meu" (cadastro + privacidade)
 *   /configuracoes → "como o app se comporta comigo" (esta tela)
 *
 * Nada saiu do app. Exportar/apagar dados continua sendo executado só em
 * Minha conta, onde estão as regras de LGPD; aqui embaixo há apenas um
 * atalho, escrito como atalho ("fica em Minha conta") e não como se fosse
 * uma segunda cópia da função.
 *
 * Nenhuma preferência daqui é dado clínico — por isso vivem no navegador.
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * Nenhuma preferência, nenhum efeito, nenhum texto. Mudou:
 *
 *  · A tela tinha padding próprio somado ao do `<main>`, como a Minha conta
 *    tinha. Passou a usar a coluna comum.
 *
 *  · A chave liga/desliga não dizia em que estado estava, a não ser pela cor
 *    e pela posição da bolinha. Ganhou `role="switch"` com `aria-checked` e
 *    uma palavra visível ("Ligado" / "Desligado") ao lado do rótulo — cor e
 *    posição não informam quem não enxerga cor, e "mais contraste" é
 *    exatamente a preferência de quem tem essa dificuldade.
 *
 *  · As linhas subiram para 56px de alvo e o texto para o corpo legível.
 */
export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(PREFS_PADRAO);

  useEffect(() => { setPrefs(lerPrefs()); }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("text-lg", prefs.fonteGrande);
    document.documentElement.classList.toggle("contrast-more", prefs.altoContraste);
  }, [prefs.fonteGrande, prefs.altoContraste]);

  const atualizar = (chave: keyof Prefs) => (valor: boolean) => {
    setPrefs((atual) => {
      const novo = { ...atual, [chave]: valor };
      salvarPrefs(novo);
      return novo;
    });
    toast.success("Preferência salva.");
  };

  return (
    <TelaPaciente>
      <PageHeader title="Preferências" subtitle="Notificações, aparência e acessibilidade" />

      <section>
        <TituloSecao titulo="Notificações e lembretes" />
        <SurfaceCard className="divide-y divide-border p-0 px-4">
          <ToggleRow
            icon={Pill}
            label="Lembrete de remédio"
            hint="Avisa nos horários dos seus medicamentos"
            checked={prefs.lembretesRemedio}
            onChange={atualizar("lembretesRemedio")}
          />
          <ToggleRow
            icon={Bell}
            label="Notificações"
            hint="Avisos do app e mensagens do seu médico"
            checked={prefs.notificacoes}
            onChange={atualizar("notificacoes")}
          />
        </SurfaceCard>
      </section>

      <section>
        <TituloSecao titulo="Aparência e leitura" />
        <SurfaceCard className="divide-y divide-border p-0 px-4">
          <ToggleRow
            icon={Type}
            label="Letra maior"
            hint="Aumenta o tamanho do texto em todo o app"
            checked={prefs.fonteGrande}
            onChange={atualizar("fonteGrande")}
          />
          <ToggleRow
            icon={Type}
            label="Mais contraste"
            hint="Cores mais fortes, texto mais fácil de ler"
            checked={prefs.altoContraste}
            onChange={atualizar("altoContraste")}
          />
        </SurfaceCard>
      </section>

      <section>
        {/* Atalho, não segunda casa: a função mora em Minha conta. O texto
            diz para onde leva, para o paciente não procurar aqui de novo. */}
        <TituloSecao titulo="Seus dados" />
        <SurfaceCard variant="interactive" onClick={() => navigate("/conta#privacidade")} ariaLabel="Privacidade e dados, em Minha conta">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
              <Shield className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-base font-semibold text-foreground">Privacidade e dados</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">Exportar ou apagar seus dados — fica em Minha conta</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
          </div>
        </SurfaceCard>
      </section>
    </TelaPaciente>
  );
}
