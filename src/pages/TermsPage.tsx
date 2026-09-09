import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { EMERGENCIA_TELEFONE } from "@/lib/config";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-4">
          <Link to="/landing" className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" strokeWidth={0} />
            <span className="font-bold text-sm">ENCORPEI CARDIO</span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">Termos de Uso</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Termos de Uso</h1>
          <p className="text-sm text-muted-foreground">Última atualização: setembro de 2026</p>
        </div>

        <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <h2 className="text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
          <p>
            Ao acessar ou usar o aplicativo Encorpei Cardio ("Plataforma"), você concorda com estes
            Termos de Uso. Se não concordar com qualquer parte, não utilize a Plataforma.
          </p>

          <h2 className="text-base font-semibold text-foreground">2. Descrição do Serviço</h2>
          <p>
            O Encorpei Cardio é uma plataforma digital de <strong>registro e acompanhamento
            cardiológico</strong>. Oferecemos ferramentas para registro de pressão arterial,
            frequência cardíaca, peso, oxigenação, sono, atividade física, sintomas, medicações e
            exames — feitos manualmente pelo paciente ou recebidos de dispositivo vestível
            (pulseira) conectado.
          </p>
          <p>
            Para cardiologistas, oferecemos o Encorpei Cardio Pro — um painel de acompanhamento
            remoto de pacientes, com fila de risco, alertas, histórico de titulação de dose e
            relatórios.
          </p>

          <h2 className="text-base font-semibold text-foreground">3. O que a Plataforma não é</h2>
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="font-medium text-foreground">O Encorpei Cardio não substitui atendimento médico.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>A Plataforma <strong>não faz diagnóstico</strong> e não prescreve tratamento.</li>
              <li>Nenhuma tela, alerta ou relatório do app indica o que fazer com uma dose ou medicação — isso é decisão exclusiva do médico responsável pelo paciente.</li>
              <li>Os escores de risco, alertas e resumos são ferramentas de <strong>organização e comunicação</strong>, não substituem o julgamento clínico.</li>
              <li>O app não monitora o paciente 24 horas nem substitui atendimento de urgência ou emergência.</li>
            </ul>
            <p className="font-semibold text-foreground pt-1">
              Em caso de emergência — dor no peito, falta de ar súbita, desmaio ou qualquer sintoma
              grave — ligue imediatamente para o SAMU ({EMERGENCIA_TELEFONE}) ou procure o pronto-socorro
              mais próximo. Não espere resposta do app ou do médico pelo app.
            </p>
          </div>

          <h2 className="text-base font-semibold text-foreground">4. Dados da pulseira e de outros dispositivos</h2>
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p>
              A pulseira e outros dispositivos vestíveis compatíveis com a Plataforma são
              <strong> produtos de consumo</strong>, não dispositivos médicos certificados pela
              ANVISA ou por qualquer outra autoridade regulatória para fins diagnósticos.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Frequência cardíaca, oxigenação (SpO₂), sono e atividade física medidos pelo dispositivo são estimativas de sensor de consumo, sujeitas a erro.</li>
              <li>
                Quando o dispositivo estima <strong>pressão arterial pelo pulso, sem manguito</strong>,
                essa leitura é marcada no app como estimativa e <strong>não deve ser usada para
                decisão terapêutica</strong> — nem por você, nem pelo seu médico. Só a pressão
                medida com aparelho de braço validado conta para ajuste de tratamento.
              </li>
              <li>Falhas de sincronização, bateria ou posicionamento do dispositivo podem causar dados ausentes ou incorretos.</li>
            </ul>
          </div>

          <h2 className="text-base font-semibold text-foreground">5. Conta e Responsabilidades do Paciente</h2>
          <p>
            Você é responsável por manter a confidencialidade de suas credenciais de acesso e pela
            veracidade dos dados que registra. O app depende dos dados que você ou seu dispositivo
            fornecem — dados incompletos ou incorretos podem comprometer a utilidade do
            acompanhamento, mas a responsabilidade pela conduta clínica é sempre do médico
            responsável.
          </p>

          <h2 className="text-base font-semibold text-foreground">6. Encorpei Cardio Pro — Responsabilidade Profissional</h2>
          <p>
            O médico responsável mantém total responsabilidade pelas decisões clínicas tomadas com
            base nos dados da Plataforma, incluindo qualquer ajuste de dose, medicação ou conduta.
            O Encorpei Cardio é uma ferramenta de apoio ao acompanhamento e comunicação — não é um
            sistema de prontuário eletrônico regulamentado, nem substitui o registro clínico
            exigido pelo Conselho Federal de Medicina.
          </p>

          <h2 className="text-base font-semibold text-foreground">7. Assinatura e Pagamento</h2>
          <p>
            O acesso do médico ao painel Pro requer assinatura paga, conforme os planos descritos
            em <Link to="/planos" className="text-primary hover:underline">/planos</Link>. O acesso
            do paciente é sempre gratuito. Assinaturas podem ser canceladas a qualquer momento, com
            efeito ao final do período vigente.
          </p>

          <h2 className="text-base font-semibold text-foreground">8. Propriedade Intelectual</h2>
          <p>
            Todo o conteúdo, design, código e marca Encorpei são protegidos por direitos autorais.
            Você não pode reproduzir, distribuir ou criar derivações sem autorização expressa.
          </p>

          <h2 className="text-base font-semibold text-foreground">9. Limitação de Responsabilidade</h2>
          <p>
            O Encorpei Cardio é fornecido "como está". Não garantimos disponibilidade
            ininterrupta, ausência de erros ou adequação a fins específicos. Em nenhuma
            circunstância seremos responsáveis por danos decorrentes de decisões clínicas tomadas
            com base isolada nos dados do app, sem avaliação médica.
          </p>

          <h2 className="text-base font-semibold text-foreground">10. Modificações</h2>
          <p>
            Podemos atualizar estes Termos periodicamente. Notificaremos sobre mudanças materiais
            por email ou notificação na Plataforma. O uso continuado constitui aceitação.
          </p>

          <h2 className="text-base font-semibold text-foreground">11. Contato</h2>
          <p>
            Para dúvidas sobre estes Termos, entre em contato: <strong>contato@encorpei.com</strong>
          </p>
        </section>

        <div className="flex gap-4 text-sm pt-4 border-t border-border">
          <Link to="/privacidade" className="text-primary hover:underline">Política de Privacidade</Link>
          <Link to="/landing" className="text-muted-foreground hover:text-foreground">Voltar ao início</Link>
        </div>
      </main>
    </div>
  );
}
