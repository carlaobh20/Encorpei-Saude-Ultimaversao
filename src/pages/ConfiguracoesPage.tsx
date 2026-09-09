import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader, SurfaceCard } from "@/components/shell";
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
      aria-pressed={checked}
      className="w-full flex items-center gap-3.5 py-3.5 text-left"
    >
      <div className="h-10 w-10 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <span className={cn("shrink-0 h-7 w-12 rounded-full transition-colors relative", checked ? "bg-primary" : "bg-secondary")}>
        <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

/**
 * Configurações — preferências do app. Sem dado clínico aqui (guardado só
 * no navegador do paciente); exportar/apagar dados continua vivendo em
 * Minha Conta > Privacidade, onde estão as regras de LGPD.
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
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">
      <PageHeader title="Configurações" subtitle="Preferências do app" />

      <div>
        <h2 className="font-display text-base font-medium tracking-tight text-foreground mb-2 px-1">Lembretes</h2>
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
      </div>

      <div>
        <h2 className="font-display text-base font-medium tracking-tight text-foreground mb-2 px-1">Leitura na tela</h2>
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
      </div>

      <div>
        <h2 className="font-display text-base font-medium tracking-tight text-foreground mb-2 px-1">Seus dados</h2>
        <SurfaceCard variant="interactive" onClick={() => navigate("/conta#privacidade")} ariaLabel="Privacidade e dados">
          <div className="flex items-center gap-3.5">
            <div className="h-10 w-10 rounded-2xl bg-secondary grid place-items-center text-primary shrink-0">
              <Shield className="h-4.5 w-4.5" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-foreground">Privacidade e dados</p>
              <p className="text-xs text-muted-foreground mt-0.5">Exportar ou apagar seus dados</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
