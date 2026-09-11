/**
 * RemediosPage — a tela mais usada no dia a dia.
 *
 * Doses de hoje com botão enorme de "tomei", lista dos remédios ativos em
 * linguagem leiga, adesão dos últimos 7/14/30 dias e aviso de adesão baixa.
 * Nunca sugere mudar dose (regra 1 do contrato).
 *
 * ── O que a passada visual mudou ──────────────────────────────────────
 * O limiar de adesão baixa (0,8 em 14 dias) e o texto de `ALERT_RULES` estão
 * intactos. Mudou:
 *
 *  · A HIERARQUIA DO BOTÃO DE DOSE. Dose pendente é o único azul cheio da
 *    tela — e há um por linha porque cada linha é uma dose diferente. Dose já
 *    tomada perdeu o azul e virou um selo discreto com o check: a ação já
 *    aconteceu, e um botão cheio em cima dela continuava puxando o olho para
 *    o que não precisa mais de nada.
 *
 *  · As barras de adesão passaram a `BarraProporcao`, que exige rótulo em
 *    texto. A versão anterior pintava a barra de amarelo abaixo de 80% e de
 *    verde acima, sem dizer nada — quem não distingue as duas cores via duas
 *    barras iguais.
 *
 *  · A cor verde saiu das barras de adesão. Verde num app de saúde é lido
 *    como "seu resultado está bom", e adesão é quanto do combinado foi
 *    marcado — não um resultado clínico. O tom de atenção continua onde a
 *    regra do hook já o coloca: no cartão de aviso do topo.
 */
import { useMemo } from "react";
import { Pill, Check, Clock } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SurfaceCard } from "@/components/shell/SurfaceCard";
import { EmptyState } from "@/components/shell/EmptyState";
import { TabPageSkeleton } from "@/components/shell/Skeletons";
import {
  TelaPaciente, TituloSecao, BarraProporcao, AvisoDaTela,
} from "@/components/shell";
import { Button } from "@/components/ui/button";
import { useCardioMedications, MED_CLASS_LABEL } from "@/hooks/useCardioMedications";
import { ALERT_RULES } from "@/lib/clinical/cardioAlertRules";
import type { MedClass } from "@/types/cardio";

/** Para que serve cada classe, em linguagem de paciente — nunca conduta. */
const MED_CLASS_PARA_QUE_SERVE: Record<MedClass, string> = {
  acei: "Controla a pressão e protege o coração e os rins.",
  arb: "Controla a pressão e protege o coração e os rins.",
  arni: "Fortalece o coração na insuficiência cardíaca.",
  beta_blocker: "Deixa o coração bater mais devagar e com menos esforço.",
  ccb: "Relaxa os vasos sanguíneos para baixar a pressão.",
  sglt2: "Protege o coração e os rins, e ajuda a controlar o açúcar no sangue.",
  mra: "Ajuda a tirar o excesso de líquido e protege o coração.",
  loop_diuretic: "Tira o excesso de líquido do corpo — o \"diurético\".",
  thiazide: "Tira o excesso de líquido e ajuda a controlar a pressão.",
  statin: "Baixa o colesterol para proteger as artérias.",
  ezetimibe: "Ajuda a baixar o colesterol.",
  pcsk9: "Baixa bastante o colesterol quando os outros remédios não bastam.",
  antiplatelet: "Deixa o sangue menos propenso a formar coágulos.",
  anticoagulant: "Afina o sangue para prevenir coágulos.",
  antiarrhythmic: "Ajuda o coração a manter o ritmo certo.",
  nitrate: "Alivia a dor no peito abrindo os vasos do coração.",
  other: "Faz parte do seu tratamento — pergunte ao seu médico se tiver dúvida.",
};

function pct(n: number | null | undefined): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export default function RemediosPage() {
  const { ativas, dosesDeHoje, adesao, isLoading, marcarDose } = useCardioMedications();

  const porHorario = useMemo(() => {
    const grupos = new Map<string, typeof dosesDeHoje>();
    for (const d of dosesDeHoje) {
      const lista = grupos.get(d.hora) ?? [];
      lista.push(d);
      grupos.set(d.hora, lista);
    }
    return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dosesDeHoje]);

  const adesaoBaixa = adesao != null && adesao.d14 != null && adesao.d14 < 0.8;

  if (isLoading) {
    return (
      <TelaPaciente>
        <PageHeader title="Remédios" />
        <TabPageSkeleton />
      </TelaPaciente>
    );
  }

  return (
    <TelaPaciente>
      <PageHeader title="Remédios" subtitle="Suas doses de hoje" />

      {adesaoBaixa && (
        <AvisoDaTela tom="atencao" titulo={ALERT_RULES.adesao_baixa.label}>
          {ALERT_RULES.adesao_baixa.patientMessage}
        </AvisoDaTela>
      )}

      {/* ── Doses de hoje ────────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Hoje" icone={Clock} />
        {porHorario.length === 0 ? (
          <EmptyState icon={Pill} title="Nenhum remédio cadastrado" description="Quando seu médico prescrever, seus horários aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-5">
            {porHorario.map(([hora, doses]) => (
              <div key={hora}>
                <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">{hora}</p>
                <div className="space-y-2.5">
                  {doses.map((d) => (
                    <SurfaceCard key={`${d.med.id}-${d.hora}`} className="flex flex-wrap items-center justify-between gap-3">
                      {/* `basis-40` dá ao nome uma largura mínima antes de o
                          `flex-wrap` do cartão entrar: sem ela o nome encolhia
                          até partir no meio ("Hidroclorotia/zida" em 360px) em
                          vez de o botão descer para a linha de baixo. */}
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="text-base font-semibold text-foreground break-words">{d.med.name}</p>
                        <p className="text-sm text-muted-foreground">{d.med.dose} · {MED_CLASS_LABEL[d.med.med_class]}</p>
                      </div>
                      {d.taken ? (
                        /* Já feito: selo, não botão azul. Continua clicável —
                           desmarcar é legítimo —, mas parando de disputar a
                           atenção com as doses que ainda faltam. */
                        <Button
                          size="lg"
                          variant="outline"
                          className="shrink-0 gap-2 text-success border-success/30 bg-success-bg hover:bg-success-bg"
                          disabled={marcarDose.isPending}
                          onClick={() =>
                            marcarDose.mutate({ medicationId: d.med.id, hora: d.hora, taken: false })
                          }
                        >
                          <Check className="h-5 w-5" aria-hidden />
                          Tomei
                        </Button>
                      ) : (
                        <Button
                          size="xl"
                          className="shrink-0 gap-2"
                          disabled={marcarDose.isPending}
                          onClick={() =>
                            marcarDose.mutate({ medicationId: d.med.id, hora: d.hora, taken: true })
                          }
                        >
                          <Check className="h-5 w-5" aria-hidden />
                          Marcar
                        </Button>
                      )}
                    </SurfaceCard>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Adesão ───────────────────────────────────────────────── */}
      {adesao && (
        <section>
          <TituloSecao titulo="Sua constância" />
          <SurfaceCard>
            <div className="space-y-4">
              {[
                { label: "Últimos 7 dias", valor: adesao.d7 },
                { label: "Últimos 14 dias", valor: adesao.d14 },
                { label: "Últimos 30 dias", valor: adesao.d30 },
              ].map((linha) => (
                <BarraProporcao
                  key={linha.label}
                  rotulo={linha.label}
                  valor={pct(linha.valor)}
                  percentual={Math.round((linha.valor ?? 0) * 100)}
                  cor={
                    // Atenção tem cor E o texto ao lado já diz o número. Fora
                    // da atenção, o azul da marca — nunca verde de "está bom".
                    (linha.valor ?? 1) < 0.8 ? "hsl(var(--warning))" : "hsl(var(--brand-cardio))"
                  }
                />
              ))}
            </div>
          </SurfaceCard>
        </section>
      )}

      {/* ── Remédios ativos ──────────────────────────────────────── */}
      <section>
        <TituloSecao titulo="Seus remédios" />
        {ativas.length === 0 ? (
          <EmptyState icon={Pill} title="Nenhum remédio ativo" description="Seus remédios prescritos aparecem aqui." variant="card" />
        ) : (
          <div className="space-y-3">
            {ativas.map((m) => (
              <SurfaceCard key={m.id}>
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-xl bg-cardio-50 grid place-items-center shrink-0">
                    <Pill className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground break-words">{m.name}</p>
                    <p className="text-sm text-muted-foreground mb-1.5">{m.dose} · {m.schedule.join(", ")}</p>
                    <p className="text-base text-foreground leading-relaxed">{MED_CLASS_PARA_QUE_SERVE[m.med_class]}</p>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </section>
    </TelaPaciente>
  );
}
