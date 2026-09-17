import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Scale, Moon, Utensils, HeartPulse, Pill, MessageCircleHeart,
  FlaskConical, Watch, Calendar, Lock, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Scale, title: "Peso", desc: "Registre e veja sua evolução ao longo do tempo, sem planilha." },
  { icon: Moon, title: "Sono", desc: "Horários e qualidade, pra entender seu padrão real." },
  { icon: Utensils, title: "Alimentação", desc: "O que você comeu, no seu ritmo — sem julgamento e sem contar caloria." },
  { icon: HeartPulse, title: "Pressão e coração", desc: "Pressão no aparelho de braço e batimentos, com o histórico no mesmo lugar." },
  { icon: Pill, title: "Remédios", desc: "O que tomar, em que horário — e o que o médico mudou de dose." },
  { icon: MessageCircleHeart, title: "Como estou me sentindo", desc: "Registre sintomas do dia em poucos toques." },
  { icon: FlaskConical, title: "Exames", desc: "Guarde seus resultados e veja a evolução dos marcadores." },
  { icon: Watch, title: "Pulseira", desc: "Frequência, oxigenação, sono e passos entram sozinhos, sem você precisar digitar." },
  { icon: Calendar, title: "Agenda", desc: "Consultas e o que você quer perguntar, num só lugar." },
];

const SHARE_POINTS = [
  "Você decide quem vê seus dados — e pode tirar o acesso quando quiser",
  "Ele nunca vê mais do que você autorizou no convite",
  "Vocês combinam juntos o que conta como alerta antes de qualquer coisa acontecer",
];

const WAYS = [
  {
    t: "Você começa sozinho",
    d: "Registre peso, sono, alimentação, pressão e como está se sentindo, no seu ritmo. O app organiza tudo e mostra sua evolução — sem planilha, sem precisar de médico pra começar.",
  },
  {
    t: "Você convida quem cuida de você",
    d: "Quando fizer sentido, convide seu médico ou quem te acompanha com um código simples. Vocês combinam juntos o plano de acompanhamento — ele só vê o que você autorizar.",
  },
  {
    t: "Seu médico já usa o Encorpei e te convida",
    d: "Se o profissional que cuida de você já acompanha outros pacientes pelo Encorpei, ele pode te convidar direto. O plano de monitoramento só entra em vigor depois que vocês dois combinam as regras juntos — a decisão nunca é só dele.",
  },
];

const FAQ = [
  {
    q: "Preciso ter médico pra usar?",
    a: "Não. Você pode registrar sozinho, do seu jeito, e decidir depois se quer convidar alguém — ou nunca convidar ninguém.",
  },
  {
    q: "Quem manda o convite, eu ou o profissional?",
    a: "Pode ser dos dois jeitos. Você pode convidar seu médico quando quiser; ou, se ele já usa o Encorpei com outros pacientes, ele pode te convidar direto. Nos dois casos, o plano de acompanhamento só começa a valer depois que vocês combinam juntos o que conta como alerta.",
  },
  {
    q: "É pago?",
    a: "Não. O acesso do paciente é sempre gratuito.",
  },
  {
    q: "Meus dados ficam visíveis pra qualquer profissional?",
    a: "Não. Só quem você convidar, e só enquanto você autorizar. Você revoga o acesso quando quiser.",
  },
  {
    q: "O app substitui consulta médica ou detecta emergência?",
    a: "Não. Ele organiza o que você registra; a decisão de saúde continua sendo do profissional. Em qualquer emergência, ligue 192 (SAMU).",
  },
];

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-6xl px-5 md:px-8 ${className}`}>{children}</section>;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [faqAberto, setFaqAberto] = useState(0);

  const goPaciente = () => navigate("/auth");
  const goProfissional = () => navigate("/pro/auth");
  const goPlanos = () => navigate("/planos");
  const goCuidador = () => navigate("/cuidador");

  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
      <nav className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="mx-auto w-full max-w-6xl flex items-center justify-between px-5 h-16 md:px-8">
          <a href="/landing" className="flex items-center gap-2.5 min-h-[44px]">
            <img src="/logo-symbol.png" alt="Encorpei Saúde" width={40} height={40} className="object-contain shrink-0" />
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">Encorpei</div>
              <div className="text-[13px] text-primary -mt-0.5 font-medium">Saúde</div>
            </div>
          </a>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={goProfissional} className="rounded-full">
              Sou profissional
            </Button>
            <Button size="sm" onClick={goPaciente} className="rounded-full">
              Entrar
            </Button>
          </div>
        </div>
      </nav>

      <header className="w-full">
        <img
          src="/hero-encorpei.jpg"
          alt="Encorpei — acompanhamento em tempo real que leva você a outro nível de vida. Dados. Consistência. Estratégia. Resultados que transformam."
          className="w-full h-auto block"
          loading="eager"
        />
        <img
          src="/hero-dashboard.jpg"
          alt="Painel do profissional de saúde — visão geral dos pacientes, alertas e evolução em tempo real"
          className="w-full h-auto block"
          loading="eager"
        />
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 py-5 sm:py-7 px-5 bg-card border-b border-border">
          <Button size="lg" onClick={goPaciente} className="rounded-2xl min-w-[160px]">
            Entrar
          </Button>
          <Button variant="outline" size="lg" onClick={goProfissional} className="rounded-2xl min-w-[160px]">
            Sou profissional
          </Button>
        </div>
      </header>

      <Section className="py-16 md:py-20">
        <h2 className="font-display text-[26px] md:text-[34px] font-semibold tracking-tight text-center text-foreground">
          Tudo que o seu corpo precisa, num só app
        </h2>
        <p className="text-center text-sm md:text-base mt-2 max-w-lg mx-auto text-muted-foreground">
          Sem planilha, sem cinco aplicativos diferentes — e sem depender de ninguém pra começar.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 mt-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl p-3 sm:p-4 bg-card border border-border">
              <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center text-primary mb-2">
                <f.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="text-[12.5px] sm:text-[14px] font-semibold text-foreground">{f.title}</div>
              <p className="text-[11px] sm:text-[12.5px] mt-1 leading-snug text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <section className="bg-foreground py-16 mt-6">
        <Section className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-primary/20 text-cardio-light">
              Opcional, sempre no seu controle
            </span>
            <h3 className="font-display text-[24px] md:text-[30px] font-semibold mt-4 tracking-tight text-background leading-tight">
              Onde você estiver, a qualquer hora, o acompanhamento é pensado na sua saúde.
            </h3>
            <p className="text-base font-semibold mt-3 text-cardio-light">
              Venha fazer parte do time Encorpei.
            </p>
            <p className="text-sm mt-3 leading-relaxed text-background/70">
              Convide seu médico ou quem cuida de você quando fizer sentido. Ele monta um plano com você e só recebe um aviso se algo sair da faixa que vocês combinaram — o resto continua só seu.
            </p>
            <div className="mt-6 space-y-2.5">
              {SHARE_POINTS.map((t) => (
                <div key={t} className="flex items-start gap-2.5">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cardio-light" strokeWidth={2} />
                  <span className="text-[13px] leading-snug text-background/80">{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] overflow-hidden shadow-2xl">
            <img
              src="/care-team.jpg"
              alt="Time de profissionais de saúde da Encorpei"
              className="w-full h-auto block"
              loading="lazy"
            />
          </div>
        </Section>
      </section>

      <Section className="py-16 md:py-20">
        <h2 className="font-display text-[26px] md:text-[32px] font-semibold tracking-tight text-center text-foreground">
          Do seu jeito, no seu tempo
        </h2>
        <p className="text-center text-sm mt-2 max-w-lg mx-auto text-muted-foreground">
          Três caminhos, o mesmo cuidado — você escolhe o que faz sentido agora.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-10">
          {WAYS.map((s, i) => (
            <div key={s.t} className="rounded-2xl p-5 bg-card border border-border">
              <div className="h-8 w-8 rounded-full grid place-items-center text-[13px] font-bold text-primary-foreground mb-3 bg-primary">
                {i + 1}
              </div>
              <div className="text-sm font-semibold text-foreground">{s.t}</div>
              <p className="text-[13px] mt-1 leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="py-10">
        <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-[26px] md:text-[32px] font-semibold tracking-tight text-center text-foreground">
          Perguntas frequentes
        </h2>
        <div className="mt-8 space-y-2">
          {FAQ.map((f, i) => {
            const aberto = faqAberto === i;
            return (
              <div key={f.q} className="rounded-2xl overflow-hidden bg-card border border-border">
                <button
                  type="button"
                  onClick={() => setFaqAberto(aberto ? -1 : i)}
                  aria-expanded={aberto}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left min-h-[44px]"
                >
                  <span className="text-sm font-semibold text-foreground">{f.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
                  />
                </button>
                {aberto && (
                  <p className="px-5 pb-4 text-[13px] leading-relaxed text-muted-foreground">{f.a}</p>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </Section>

      <Section className="py-16 text-center">
        <div className="rounded-[28px] px-6 py-14 md:py-16 gradient-brand">
          <h3 className="font-display text-[26px] md:text-[34px] font-semibold tracking-tight text-primary-foreground leading-tight">
            Comece a cuidar do seu corpo hoje.
          </h3>
          <p className="text-sm mt-3 max-w-md mx-auto text-primary-foreground/80">
            Grátis, sem precisar de médico pra começar. Convide quem cuida de você quando quiser.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={goPaciente} className="rounded-2xl bg-card text-foreground hover:bg-card/90">
              Entrar
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={goProfissional}
              className="rounded-2xl border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              Sou profissional
            </Button>
          </div>
          <button
            type="button"
            onClick={goPlanos}
            className="mt-5 text-sm text-primary-foreground/80 hover:text-primary-foreground hover:underline"
          >
            Cardiologista? Veja os planos do consultório
          </button>
        </div>
      </Section>

      <footer className="border-t border-border py-10">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-symbol.png" alt="" width={28} height={28} className="object-contain shrink-0" />
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">encorpei saúde</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <button type="button" onClick={goPaciente} className="hover:text-foreground transition-colors">
              Criar conta
            </button>
            <a href="/termos" className="hover:text-foreground transition-colors">Termos</a>
            <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
            <button type="button" onClick={goPlanos} className="hover:text-foreground transition-colors">
              Planos
            </button>
            <button type="button" onClick={goCuidador} className="hover:text-foreground transition-colors">
              Fui convidado para cuidar de alguém
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Encorpei · Cuidado contínuo do seu jeito · LGPD
          </p>
        </div>
      </footer>
    </div>
  );
}
