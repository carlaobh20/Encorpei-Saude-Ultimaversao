import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart, Activity, ShieldCheck, ArrowRight, Check, ChevronRight,
  ListOrdered, FileText, Pill, Watch, Users, AlertTriangle,
  Stethoscope, Smartphone, Moon, Footprints, Wind, Gauge, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/config/plans";
import { setDevBypass } from "@/contexts/DevBypass";
import { cn } from "@/lib/utils";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const PROVAS = [
  {
    icon: ListOrdered,
    title: "Fila de risco, não lista alfabética",
    text: "Seus pacientes chegam ordenados por quem precisa de você hoje. Vermelho primeiro, sempre.",
  },
  {
    icon: FileText,
    title: "Resumo entre consultas",
    text: "Abra o paciente e leia 8 linhas — média de pressão, adesão, eventos e exames novos desde a última vez — em vez de perguntar tudo de novo.",
  },
  {
    icon: Pill,
    title: "Titulação registrada",
    // Antes: "o paciente recebe no celular dele agora" — o que implica push, e
    // o envio de push não existe (lib/notifications.ts só registra a assinatura
    // no cliente; não há backend que dispare). O que existe de verdade é a
    // titulação gravada e visível no app do paciente na próxima abertura.
    text: "Mudou a dose aqui, o app do paciente já mostra a dose nova para ele. Fica registrado o que mudou, quando e por quê.",
  },
  {
    icon: FileText,
    title: "Relatório para impressão",
    // "Enviar ao convênio" saiu: não há envio nenhum, nem integração de
    // faturamento. O que existe é a tela de relatório com window.print().
    text: "Resumo do período com a origem de cada número, pronto para imprimir, salvar em PDF ou colar no prontuário.",
  },
  {
    icon: Watch,
    // Não existe programa de pulseira com marca de clínica — nada no código,
    // nem operação de hardware por trás. O que existe é a importação dos dados
    // da pulseira, e é só isso que a landing pode afirmar.
    title: "Dados da pulseira sem digitação",
    text: "Frequência cardíaca, oxigenação, sono e passos entram sozinhos — sem depender do paciente lembrar de digitar.",
  },
];

const COMO_FUNCIONA = [
  {
    icon: Users,
    title: "Você convida o paciente",
    text: "Um código de convite. Ele entra, o app já sabe que é seu paciente.",
  },
  {
    icon: Activity,
    title: "O paciente registra, a pulseira envia",
    text: "Pressão manual quando ele mede, frequência cardíaca e sono importados da pulseira — sem esforço no dia a dia dele.",
  },
  {
    icon: Gauge,
    title: "Você abre o painel e já sabe quem precisa de você",
    text: "Fila de risco, alertas e resumo prontos antes de você abrir a ficha.",
  },
];

const H59_REAL = [
  { icon: Heart, label: "Frequência cardíaca" },
  { icon: Wind, label: "Oxigenação (SpO₂)" },
  { icon: Moon, label: "Sono" },
  { icon: Footprints, label: "Atividade e passos" },
];

const FAQ = [
  {
    q: "A pulseira mede pressão arterial de verdade?",
    a: "Mede uma estimativa por sensor óptico no pulso, sem manguito. É útil como tendência, mas o app marca claramente essa leitura como estimativa e ela nunca entra na média de MRPA nem dispara alerta de pressão. Só aparelho de braço validado conta para isso.",
  },
  {
    q: "O app substitui a consulta?",
    a: "Não. O app organiza registro, comunicação e alerta. Quem decide conduta é você, na consulta ou pelo canal com o paciente.",
  },
  {
    q: "O paciente paga alguma coisa?",
    a: "Não. Quem assina é o consultório ou a clínica. O app do paciente é sempre gratuito.",
  },
  {
    q: "Os dados são seguros?",
    a: "Sim. Dado de saúde é dado sensível pela LGPD: acesso restrito ao médico vinculado, registro de auditoria e criptografia em trânsito e em repouso.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const goMedico = () => navigate("/pro/auth");
  const goPaciente = () => navigate("/auth");
  /**
   * "Falar com comercial" mandava para /pro/auth — o mesmo cadastro do botão
   * de contratar. Fingir um funil comercial que não existe é pior do que não
   * ter funil: vira mailto para uma pessoa de verdade (mesmo endereço já
   * publicado nos Termos).
   */
  const falarComercial = () => {
    const assunto = encodeURIComponent("Encorpei Cardio — quero conversar");
    window.location.href = `mailto:contato@encorpei.com?subject=${assunto}`;
  };
  const verDemo = () => {
    setDevBypass("medico");
    navigate("/pro/dashboard");
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl flex items-center justify-between px-5 py-3.5 md:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/logo-symbol.png" alt="Encorpei Cardio" width={40} height={40} className="object-contain shrink-0" style={{ width: 40, height: 40 }} />
            <div className="leading-tight">
              <div className="font-display text-base font-semibold tracking-tight">Encorpei</div>
              <div className="text-[13px] text-primary -mt-0.5 font-medium">Cardio</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={goPaciente} className="hidden md:inline-flex text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3.5 py-2 rounded-full hover:bg-muted/60">
              Sou paciente
            </button>
            <Button size="sm" onClick={goMedico} className="rounded-full shadow-sm">
              Sou cardiologista
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cardio-50/70 via-background to-background" />
          <div className="absolute -top-48 -right-40 w-[560px] h-[560px] rounded-full bg-gradient-to-br from-primary/25 to-cardio-light/20 opacity-60 blur-[120px]" />
        </div>

        <div className="mx-auto w-full max-w-6xl px-5 md:px-8 pt-14 md:pt-24 pb-16 md:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
          <motion.div initial="hidden" animate="show" variants={fadeUp}>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur px-3.5 py-1.5 text-[12px] font-medium text-muted-foreground shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Feito para o consultório de cardiologia
            </div>
            <h1 className="font-display text-[38px] md:text-[56px] font-semibold leading-[1.06] tracking-tight text-foreground mt-5">
              Saiba o que aconteceu com seu paciente <span className="text-primary">entre as consultas.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Hoje você recebe o paciente a cada 6 meses e adivinha o que aconteceu no meio.
              O Encorpei Cardio registra pressão, frequência cardíaca, peso, sono, adesão e
              sintomas todos os dias — e te mostra, em uma tela, quem precisa de você agora.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="xl" onClick={goMedico} className="rounded-full shadow-md">
                Começar como cardiologista <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="xl" variant="outline" onClick={verDemo} className="rounded-full">
                Ver demonstração
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sem cartão de crédito. O app do seu paciente é sempre gratuito.
            </p>
          </motion.div>

          {/* Mock do painel */}
          <motion.div
            className="relative"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          >
            <div className="absolute -inset-6 bg-gradient-to-br from-primary/20 to-cardio-light/20 rounded-[40px] blur-3xl -z-10" />
            <div className="rounded-[28px] bg-card border border-border shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-card">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg gradient-brand grid place-items-center">
                    <Heart className="h-3.5 w-3.5 text-white" fill="white" strokeWidth={0} />
                  </div>
                  <span className="text-[13px] font-semibold tracking-tight">Fila de risco</span>
                </div>
                {/* "Atualizado agora" com pacientes e números inventados lia
                    como painel real de alguém. É um mock de interface — passa a
                    dizer isso, porque os nomes e as métricas abaixo são fictícios. */}
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Exemplo ilustrativo
                </div>
              </div>

              <div className="divide-y divide-border">
                {[
                  { n: "Antônio R.", d: "PA 148/96 · 3 medidas acima do alvo em 7 dias", risk: "red" as const },
                  { n: "Marisa P.", d: "Ganho de 1,8 kg em 3 dias — atenção IC", risk: "yellow" as const },
                  { n: "João C.", d: "Dentro dos alvos · adesão 96%", risk: "green" as const },
                ].map((p) => (
                  <div key={p.n} className="flex items-center gap-3 px-5 py-3.5">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        p.risk === "red" && "bg-error",
                        p.risk === "yellow" && "bg-warning",
                        p.risk === "green" && "bg-success"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-foreground truncate">{p.n}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{p.d}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-px bg-border">
                {[
                  { label: "Pacientes ativos", value: "58" },
                  { label: "Precisam de você", value: "3" },
                  { label: "Adesão média", value: "88%" },
                ].map((k) => (
                  <div key={k.label} className="bg-card px-3 py-3 text-center">
                    <div className="font-display text-lg font-semibold text-foreground leading-none">{k.value}</div>
                    <div className="text-[9px] text-muted-foreground mt-1">{k.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden xl:flex absolute -top-6 -left-14 items-center gap-2.5 bg-card border border-border rounded-2xl px-3.5 py-2.5 shadow-xl">
              <div className="h-8 w-8 rounded-xl bg-error/10 grid place-items-center">
                <AlertTriangle className="h-3.5 w-3.5 text-error" strokeWidth={2} />
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Alerta</div>
                <div className="text-[12px] font-semibold text-foreground">PA em crise · Antônio</div>
              </div>
            </div>

            <div className="hidden lg:flex absolute -bottom-6 -right-6 items-center gap-2.5 bg-card border border-border rounded-2xl px-3.5 py-2.5 shadow-xl">
              <div className="h-8 w-8 rounded-xl bg-success-bg grid place-items-center">
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Titulação</div>
                <div className="text-[12px] font-semibold text-foreground">Dose enviada ao paciente</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* A DOR */}
      <section className="border-t border-border py-16 md:py-20 bg-cardio-50/40">
        <div className="mx-auto w-full max-w-4xl px-5 md:px-8 text-center">
          <p className="section-eyebrow">O problema de sempre</p>
          <h2 className="font-display text-2xl md:text-[34px] font-semibold tracking-tight text-foreground mt-2 leading-[1.15]">
            Consulta de 6 em 6 meses. No meio, silêncio.
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            O paciente hipertenso ou com insuficiência cardíaca não avisa quando a pressão sobe,
            quando para de tomar o remédio ou quando o peso muda de repente. Ele só volta a
            aparecer — bem ou mal — na próxima consulta marcada. Até lá, você conduz um tratamento
            crônico no escuro.
          </p>
        </div>
      </section>

      {/* AS 5 PROVAS */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="max-w-2xl">
            <p className="section-eyebrow">O que muda na sua rotina</p>
            <h2 className="font-display text-3xl md:text-[40px] font-semibold tracking-tight text-foreground mt-2 leading-[1.1]">
              Tempo de consulta e segurança na conduta.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-12">
            {PROVAS.map((p) => (
              <div
                key={p.title}
                className="rounded-[24px] border border-border bg-card p-6 md:p-7 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="rounded-2xl bg-cardio-50 grid place-items-center text-primary shrink-0" style={{ height: 48, width: 48 }}>
                  <p.icon className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mt-5 leading-tight">
                  {p.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2.5 leading-relaxed">{p.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section className="py-20 md:py-28 border-t border-border bg-cardio-50/40">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="max-w-2xl">
            <p className="section-eyebrow">Como funciona</p>
            <h2 className="font-display text-3xl md:text-[40px] font-semibold tracking-tight text-foreground mt-2 leading-[1.1]">
              Três passos, sem trabalho extra para você.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {COMO_FUNCIONA.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="font-display text-3xl font-semibold text-primary/30">{String(i + 1).padStart(2, "0")}</span>
                  <div className="h-10 w-10 rounded-xl bg-card border border-border grid place-items-center text-primary shadow-sm">
                    <s.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                  </div>
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mt-4">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PULSEIRA H59 — HONESTO */}
      <section className="py-20 md:py-28 border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8 grid lg:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <p className="section-eyebrow">A pulseira H59</p>
            <h2 className="font-display text-3xl md:text-[40px] font-semibold tracking-tight text-foreground mt-2 leading-[1.1]">
              O que ela mede de verdade — e o que é estimativa.
            </h2>
            <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-lg">
              Frequência cardíaca, oxigenação, sono e atividade entram automaticamente, sem o
              paciente precisar lembrar de nada. É o que resolve o maior risco do acompanhamento
              crônico: paciente que não registra.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-7">
              {H59_REAL.map((it) => (
                <div key={it.label} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <div className="h-9 w-9 rounded-xl bg-cardio-50 grid place-items-center shrink-0 text-primary">
                    <it.icon className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <span className="text-[13px] font-medium text-foreground">{it.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-warning/30 bg-warning/5 p-5">
              <div className="flex items-start gap-3">
                <Gauge className="h-4.5 w-4.5 text-warning shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-sm text-foreground leading-relaxed">
                  <strong>A pressão arterial da pulseira é estimativa</strong>, medida por sensor
                  óptico no pulso, sem manguito. O app marca isso com clareza no dado e nunca deixa
                  essa leitura entrar na média de MRPA nem disparar alerta de pressão — só aparelho
                  de braço validado conta para decisão clínica. Preferimos te contar isso agora a
                  perder sua confiança depois.
                </p>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-br from-primary/15 to-cardio-light/15 rounded-[40px] blur-2xl -z-10" />
            <div className="rounded-[32px] bg-card border border-border shadow-2xl overflow-hidden p-7">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Pulseira H59 · exemplo ilustrativo</span>
                <Watch className="h-4 w-4 text-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="rounded-2xl bg-cardio-50 p-4">
                  <Heart className="h-4 w-4 text-primary" strokeWidth={2} />
                  <div className="font-display text-2xl font-semibold text-foreground mt-2">72 bpm</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Frequência de repouso</div>
                </div>
                <div className="rounded-2xl bg-cardio-50 p-4">
                  <Wind className="h-4 w-4 text-primary" strokeWidth={2} />
                  <div className="font-display text-2xl font-semibold text-foreground mt-2">97%</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">SpO₂ noturna</div>
                </div>
                <div className="rounded-2xl bg-cardio-50 p-4">
                  <Moon className="h-4 w-4 text-primary" strokeWidth={2} />
                  <div className="font-display text-2xl font-semibold text-foreground mt-2">6h40</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">Sono na última noite</div>
                </div>
                <div className="rounded-2xl border border-dashed border-warning/40 bg-warning/5 p-4">
                  <Gauge className="h-4 w-4 text-warning" strokeWidth={2} />
                  <div className="font-display text-2xl font-semibold text-foreground mt-2">132/84</div>
                  <div className="text-[11px] text-warning font-medium mt-0.5">Estimativa — não usar para decisão clínica</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section className="py-20 md:py-28 border-t border-border bg-cardio-50/40">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8">
          <div className="max-w-2xl mx-auto text-center">
            <p className="section-eyebrow">Planos</p>
            <h2 className="font-display text-3xl md:text-[40px] font-semibold tracking-tight text-foreground mt-2 leading-[1.1]">
              Você paga. Seu paciente usa de graça.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              No paciente crônico isso se sustenta melhor do que em qualquer outro modelo: você
              acompanha por anos, não por meses.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={cn(
                  "rounded-[24px] bg-card border p-6 md:p-7 flex flex-col",
                  plan.highlighted ? "border-primary shadow-lg ring-1 ring-primary/20" : "border-border shadow-sm"
                )}
              >
                {plan.badge && (
                  <span className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary mb-3 bg-cardio-50 rounded-full px-2.5 py-1">
                    {plan.badge}
                  </span>
                )}
                <h3 className="font-display text-xl font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 mb-5 leading-relaxed">{plan.description}</p>
                <div className="mb-6">
                  {plan.price === -1 ? (
                    <span className="text-2xl font-semibold text-foreground">{plan.priceLabel}</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </>
                  )}
                </div>
                {/* A lista de 6 itens saiu daqui.
                    Motivo: ela vinha direto de config/plans.ts com um Check em
                    cada linha — inclusive em "Alertas por push + SMS", "Equipe
                    multidisciplinar", "Multiunidade" e "API + PEP/HIS", que não
                    existem no produto. Marcar item por item aqui exigiria
                    duplicar a lista de pendências que vive em PlansPage; a
                    landing não precisa dela. Aqui fica o resumo do que já está
                    no ar, e /planos mostra a oferta completa com o que ainda
                    está em desenvolvimento devidamente marcado. */}
                <div className="mb-7 flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Já no ar: fila de risco, plano de monitoramento, alertas, mensagens com o
                    paciente, exames, relatórios e importação dos dados da pulseira.
                  </p>
                  <a
                    href="/planos"
                    className="inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline mt-3"
                  >
                    Ver a lista completa e o que está em desenvolvimento
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                {plan.price === -1 ? (
                  <Button
                    variant="outline"
                    className="w-full rounded-full touch-target"
                    onClick={falarComercial}
                  >
                    <Mail className="h-4 w-4" /> Escrever para o comercial
                  </Button>
                ) : (
                  <Button
                    variant={plan.highlighted ? "default" : "outline"}
                    className="w-full rounded-full touch-target"
                    onClick={goMedico}
                  >
                    Criar conta de cardiologista
                  </Button>
                )}
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  {plan.price === -1
                    ? "Abre seu e-mail. Nenhuma contratação acontece no app."
                    : "Sem cartão. O cadastro não cobra nada."}
                </p>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Quer ver todos os detalhes? <a href="/planos" className="text-primary hover:underline font-medium">Comparar planos completos</a>
          </p>
        </div>
      </section>

      {/* SEGURANÇA / LGPD */}
      <section className="py-20 md:py-24 border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-5 md:px-8">
          <div className="rounded-[28px] border border-border bg-card p-8 md:p-10 grid md:grid-cols-[auto_1fr] gap-6 items-start shadow-sm">
            <div className="h-14 w-14 rounded-2xl gradient-brand grid place-items-center shrink-0">
              <ShieldCheck className="h-6 w-6 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Dado de saúde é dado sensível — e é tratado como tal.
              </h2>
              <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed max-w-2xl">
                Conforme a LGPD (art. 11), os dados clínicos do seu paciente só ficam visíveis para
                o médico vinculado a ele. Todo acesso é auditado, os dados trafegam e ficam
                armazenados criptografados, e o paciente pode revogar o vínculo ou pedir exclusão
                a qualquer momento.
              </p>
              <div className="flex flex-wrap gap-2 mt-5">
                {["Consentimento específico", "Registro de auditoria", "Criptografia em trânsito e repouso", "Acesso restrito ao médico vinculado"].map((t) => (
                  <span key={t} className="text-xs font-medium text-foreground bg-cardio-50 rounded-full px-3 py-1.5">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-24 border-t border-border bg-cardio-50/40">
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8">
          <p className="section-eyebrow text-center">Perguntas frequentes</p>
          <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-foreground mt-2 text-center">
            Direto ao ponto.
          </h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-card p-5 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-foreground">{item.q}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="relative py-24 md:py-28 border-t border-border overflow-hidden">
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[380px] rounded-full bg-gradient-to-br from-primary/20 to-cardio-light/15 blur-[120px]" />
        </div>
        <div className="mx-auto w-full max-w-3xl px-5 md:px-8 text-center">
          <p className="section-eyebrow">Comece hoje</p>
          <h2 className="font-display text-3xl md:text-[48px] font-semibold tracking-tight text-foreground mt-3 leading-[1.08]">
            Veja a fila de risco dos seus pacientes em 30 segundos.
          </h2>
          <p className="text-base md:text-lg text-muted-foreground mt-6 max-w-xl mx-auto leading-relaxed">
            Sem cadastro, sem cartão. Entre no painel de demonstração e navegue como se fosse a
            sua rotina de amanhã.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="xl" onClick={verDemo} className="rounded-full shadow-md">
              Ver demonstração <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="xl" variant="outline" onClick={goMedico} className="rounded-full">
              <Stethoscope className="h-4 w-4" /> Criar minha conta
            </Button>
          </div>
          <button onClick={goPaciente} className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Smartphone className="h-3.5 w-3.5" /> Sou paciente e recebi um convite
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto w-full max-w-6xl px-5 md:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo-symbol.png" alt="Encorpei Cardio" width={28} height={28} className="object-contain shrink-0" style={{ width: 28, height: 28 }} />
            <div className="leading-tight">
              <div className="font-display text-sm font-semibold">Encorpei</div>
              <div className="text-xs text-primary -mt-0.5 font-medium">Cardio</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="/termos" className="hover:text-foreground transition-colors">Termos</a>
            <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="/planos" className="hover:text-foreground transition-colors">Planos</a>
          </div>
          <div className="text-xs text-muted-foreground">© 2026 Encorpei Saúde</div>
        </div>
      </footer>
    </div>
  );
}
