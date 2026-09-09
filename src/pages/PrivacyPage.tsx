import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-3xl flex items-center gap-3 px-4 py-4">
          <Link to="/landing" className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" strokeWidth={0} />
            <span className="font-bold text-sm">ENCORPEI CARDIO</span>
          </Link>
          <span className="text-muted-foreground text-sm">/</span>
          <span className="text-sm font-medium">Política de Privacidade</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Política de Privacidade</h1>
          <p className="text-sm text-muted-foreground">Última atualização: setembro de 2026</p>
        </div>

        <section className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="font-medium text-foreground">Tratamos dados sensíveis de saúde</p>
            <p>
              Seus dados cardiológicos — pressão, frequência cardíaca, peso, sono, sintomas,
              medicações e exames — são <strong className="text-foreground">dados pessoais
              sensíveis</strong> nos termos do art. 11 da Lei Geral de Proteção de Dados (LGPD,
              Lei 13.709/2018). Por isso, só os tratamos mediante o seu
              <strong className="text-foreground"> consentimento específico e destacado</strong>,
              dado no cadastro, ou para a tutela da sua saúde junto ao médico que você autorizar.
            </p>
          </div>

          <h2 className="text-base font-semibold text-foreground">1. Dados que Coletamos</h2>
          <p>Coletamos os seguintes tipos de dados:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dados de cadastro:</strong> nome, email, telefone, data de nascimento, sexo biológico.</li>
            <li><strong>Dados clínicos de base:</strong> comorbidades, história cardiovascular, procedimentos, alergias, medicações em uso — registrados por você ou pelo seu médico.</li>
            <li><strong>Dados de monitoramento:</strong> pressão arterial, frequência cardíaca, peso, SpO₂, glicemia, sono, passos e atividade física, sintomas relatados e adesão medicamentosa.</li>
            <li>
              <strong>Dados da pulseira e de outros dispositivos conectados:</strong> frequência
              cardíaca, oxigenação, sono e atividade capturados automaticamente por Bluetooth ou
              importação de arquivo, incluindo a estimativa de pressão por pulso, sempre marcada
              como estimativa e identificada pela origem (pulseira, manual ou importada).
            </li>
            <li><strong>Dados de exames:</strong> resultados laboratoriais e de imagem que você ou seu médico registrarem.</li>
            <li><strong>Dados de uso:</strong> eventos de navegação, funcionalidades utilizadas e dispositivo de acesso.</li>
            <li><strong>Dados profissionais (Pro):</strong> nome, especialidade, número de registro no conselho profissional, clínica.</li>
          </ul>

          <h2 className="text-base font-semibold text-foreground">2. Finalidade do Tratamento</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Registrar e organizar seu histórico de acompanhamento cardiológico.</li>
            <li>Gerar alertas, fila de risco e resumos para o médico vinculado — sempre como apoio à decisão dele, nunca como diagnóstico automático.</li>
            <li>Permitir a comunicação entre você e o médico vinculado.</li>
            <li>Gerar relatórios em PDF para o prontuário do seu médico.</li>
            <li>Melhorar o produto com base em dados agregados e anonimizados.</li>
          </ul>

          <h2 className="text-base font-semibold text-foreground">3. Base Legal</h2>
          <p>Tratamos cada dado com uma base legal definida (LGPD art. 7 e 11):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dados de saúde (sensíveis):</strong> consentimento específico e destacado (art. 11, I), coletado no cadastro e renovável a qualquer momento, e tutela da saúde exercida por profissional de saúde (art. 11, II, "f").</li>
            <li><strong>Dados de cadastro:</strong> execução do contrato de uso da plataforma (art. 7, V).</li>
            <li><strong>Dados de uso/analytics:</strong> legítimo interesse para melhoria do produto, sempre anonimizados (art. 7, IX).</li>
          </ul>

          <h2 className="text-base font-semibold text-foreground">4. Com quem Compartilhamos</h2>
          <div className="rounded-xl bg-muted p-4 space-y-2">
            <p className="font-medium text-foreground">Seus dados de saúde só são compartilhados com o médico que você vincular.</p>
            <p>
              Ao aceitar o convite de um cardiologista, seus registros de saúde passam a ser
              visíveis para ele(a) no painel Encorpei Cardio Pro. Você pode revogar esse vínculo a
              qualquer momento, e o médico deixa de ter acesso aos seus dados a partir daí.
            </p>
          </div>
          <p>Compartilhamos dados também com operadores que nos prestam serviço, sob contrato:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase:</strong> hospedagem, banco de dados e autenticação.</li>
            <li><strong>Médico vinculado:</strong> apenas quando você autoriza o vínculo, e apenas os dados clínicos necessários ao acompanhamento.</li>
          </ul>
          <p className="text-xs">
            Não vendemos dados pessoais nem de saúde a terceiros para fins de marketing ou
            publicidade. Parte da infraestrutura pode estar localizada fora do Brasil — nesses
            casos, a transferência internacional segue as salvaguardas previstas na LGPD (art. 33).
          </p>

          <h2 className="text-base font-semibold text-foreground">5. Seus Direitos (LGPD art. 18)</h2>
          <p>Em conformidade com a LGPD, você tem direito a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirmar a existência de tratamento e acessar seus dados.</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados.</li>
            <li>Solicitar anonimização, bloqueio ou <strong>eliminação</strong> de dados desnecessários ou tratados em desconformidade com a lei.</li>
            <li>Solicitar a portabilidade de seus dados a outro fornecedor.</li>
            <li>Revogar o consentimento e se opor a tratamentos realizados com base em legítimo interesse.</li>
            <li>Ser informado sobre entidades públicas e privadas com quem seus dados foram compartilhados.</li>
            <li>Solicitar revisão de decisões automatizadas que afetem seus interesses.</li>
          </ul>
          <p>
            Você pode exercer os direitos de <strong className="text-foreground">acesso
            (exportação)</strong> e <strong className="text-foreground">eliminação</strong>
            diretamente no app, em <strong className="text-foreground">Conta → Privacidade e
            dados</strong>. Para os demais direitos, escreva para o encarregado indicado na seção
            10.
          </p>
          <p className="text-xs">
            Você também tem o direito de peticionar à Autoridade Nacional de Proteção de Dados
            (ANPD) caso entenda que seus direitos não foram atendidos.
          </p>

          <h2 className="text-base font-semibold text-foreground">6. Retenção de Dados</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa e pelo prazo necessário ao
            cumprimento de obrigações legais e regulatórias aplicáveis a registros de saúde. Após
            solicitação de exclusão da conta, seus dados pessoais identificáveis são removidos em
            até 30 dias, ressalvado o que a lei exigir manter. Dados agregados e anonimizados podem
            ser mantidos para fins estatísticos.
          </p>

          <h2 className="text-base font-semibold text-foreground">7. Segurança</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Criptografia em trânsito (TLS) e em repouso.</li>
            <li>Controle de acesso por <strong>Row Level Security (RLS)</strong>: cada paciente só é visível ao médico com vínculo ativo e aprovado.</li>
            <li><strong>Registro de auditoria</strong> de acessos e alterações em dados clínicos.</li>
            <li>Autenticação segregada entre conta de paciente e conta de médico, sem login cruzado.</li>
          </ul>

          <h2 className="text-base font-semibold text-foreground">8. Cookies e Analytics</h2>
          <p>
            Utilizamos eventos de analytics internos para entender o uso do produto. Não usamos
            cookies de terceiros para publicidade. Dados de analytics não contêm informações
            pessoais de saúde identificáveis.
          </p>

          <h2 className="text-base font-semibold text-foreground">9. Menores de Idade</h2>
          <p>
            A Plataforma é destinada a maiores de 18 anos. Não coletamos intencionalmente dados de
            menores de idade.
          </p>

          <h2 className="text-base font-semibold text-foreground">10. Encarregado e Contato</h2>
          <p>
            Encarregado de Proteção de Dados (DPO): <strong>privacidade@encorpei.com</strong>. Para
            qualquer dúvida sobre esta política ou sobre o tratamento dos seus dados, escreva para
            esse endereço.
          </p>

          <h2 className="text-base font-semibold text-foreground">11. Alterações</h2>
          <p>
            Esta política pode ser atualizada periodicamente. Notificaremos sobre mudanças
            relevantes por email ou notificação na Plataforma.
          </p>
        </section>

        <div className="flex gap-4 text-sm pt-4 border-t border-border">
          <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>
          <Link to="/landing" className="text-muted-foreground hover:text-foreground">Voltar ao início</Link>
        </div>
      </main>
    </div>
  );
}
