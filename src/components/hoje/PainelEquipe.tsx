/**
 * "Minha equipe" — quem cuida do paciente e quando ele os vê.
 *
 * ── Iniciais, não foto ────────────────────────────────────────────────
 * `avatar_url` existe no perfil do profissional, mas quase nunca está
 * preenchido; um <img> quebrado ou um boneco genérico no lugar do
 * cardiologista dá menos identidade que duas letras estáveis. Quando o
 * médico subir foto, a troca é de uma linha.
 *
 * ── Estado vazio é conteúdo ───────────────────────────────────────────
 * Sem vínculo, o painel não some: ele explica o que falta e oferece a ação
 * que já existe no app (vincular pelo código, em /conta). Sem consulta
 * marcada, idem — a agenda continua a um toque. Painel que desaparece
 * ensina o paciente a não procurar mais ali.
 */

import { Link } from "react-router-dom";
import { CalendarClock, HelpCircle, MessageCircle, Stethoscope, Users } from "lucide-react";
import { Painel } from "@/components/shell";
import { useMyProfessionals } from "@/hooks/useMyProfessionals";
import { useMedicoVinculado } from "@/hooks/useMarcaClinica";
import { useAppointments } from "@/hooks/useProfessional";
import { dataHoraPorExtenso, iniciais } from "@/lib/formato";

/** Modalidade da consulta. Chave desconhecida cai no texto cru — não some. */
const ROTULO_TIPO: Record<string, string> = {
  consulta: "Consulta presencial",
  retorno: "Retorno",
  telemedicina: "Teleconsulta",
  teleconsulta: "Teleconsulta",
  exame: "Exame",
};

export function PainelEquipe() {
  const { proxima } = useAppointments();

  /**
   * ── "Nenhum médico vinculado" que não era verdade ──────────────────
   *
   * A auditoria pegou a mesma sessão dizendo três coisas incompatíveis:
   * este painel afirmando que não há médico, uma conversa ativa com a
   * cardiologista em /medico, e uma faixa de treino "definida pelo seu
   * médico". A causa: o painel lia a lista crua de `useMyProfessionals`,
   * que no modo demonstração nunca chega a perguntar nada ao banco e
   * devolve lista vazia.
   *
   * Quem responde "tenho médico?" agora é `useMedicoVinculado` — a mesma
   * resposta em demonstração e fora dela. E lista vazia porque não há
   * vínculo continua sendo diferente de lista vazia porque ninguém
   * perguntou: `consultado` é o que separa os dois, e só quando ele é
   * verdadeiro o painel tem o direito de NEGAR o vínculo.
   */
  const { medico } = useMedicoVinculado();
  const { consultado } = useMyProfessionals();

  return (
    <Painel titulo="Minha equipe">
      {medico ? (
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full
                       bg-cardio-50 text-primary text-base font-semibold"
            aria-hidden
          >
            {iniciais(medico.nome)}
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground truncate">
              {medico.nome || "Seu cardiologista"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {medico.clinica || "Cardiologia"}
            </p>
          </div>
        </div>
      ) : consultado ? (
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Stethoscope className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium text-foreground leading-snug">
              Nenhum médico vinculado
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              Com o código que ele te passa, seus registros chegam até ele.
            </p>
            <Link to="/conta" className="inline-block text-base font-medium text-primary mt-1 rounded-lg">
              Vincular meu médico
            </Link>
          </div>
        </div>
      ) : (
        /* Não sabemos — e dizer "não sabemos" é a única coisa honesta a
           dizer. Os dois caminhos ficam à mão: o canal (que confirma na
           prática se existe alguém do outro lado) e o vínculo por código,
           para quem de fato ainda não tem médico. */
        <div className="flex items-start gap-3">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <HelpCircle className="h-6 w-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-base font-medium text-foreground leading-snug">
              Não consegui confirmar quem é o seu médico agora
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
              Isso não quer dizer que você não tenha um. Abra as mensagens para ver com quem você
              já conversa, ou use o código do consultório se ainda não fez o vínculo.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              <Link to="/medico" className="inline-block text-base font-medium text-primary rounded-lg">
                Ver minhas mensagens
              </Link>
              <Link to="/conta" className="inline-block text-base font-medium text-primary rounded-lg">
                Vincular meu médico
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* A consulta é um bloco à parte porque ela existe (ou não) independente
          do vínculo: consulta pode estar marcada antes do código ser usado. */}
      <div className="mt-4 pt-4 border-t border-border">
        {proxima ? (
          <Link to="/agenda" className="flex items-start gap-3 -mx-1 px-1 py-1 rounded-xl">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
              <CalendarClock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm text-muted-foreground">Próxima consulta</span>
              <span className="block text-base font-semibold text-foreground leading-snug">
                {dataHoraPorExtenso(proxima.scheduled_at)}
              </span>
              <span className="block text-sm text-muted-foreground mt-0.5 leading-relaxed">
                {ROTULO_TIPO[proxima.kind] ?? proxima.kind}
                {proxima.location ? ` · ${proxima.location}` : " · Local a confirmar"}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CalendarClock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-base font-medium text-foreground">Sem consulta marcada</p>
              <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                Quando seu médico agendar, ela aparece aqui.
              </p>
              <Link to="/agenda" className="inline-block text-base font-medium text-primary mt-1 rounded-lg">
                Ver minhas consultas
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Dois caminhos, dois destinos diferentes — nenhum deles repetido na
          grade de Acesso rápido, que cobre outro assunto. */}
      {/* `xl:grid-cols-1`: a partir de 1280px este painel vive na coluna de
          apoio (~320px), e duas colunas ali cortavam os dois rótulos
          ("Mensa…", "Quem …"). Entre 640 e 1279px ele ocupa a largura toda da
          página e as duas colunas cabem. */}
      <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
        <Link
          to="/medico"
          className="flex items-center gap-2 min-h-[48px] rounded-xl border border-border px-3 py-2 text-base font-medium"
        >
          <MessageCircle className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="truncate">Mensagens</span>
        </Link>
        <Link
          to="/cuidadores"
          className="flex items-center gap-2 min-h-[48px] rounded-xl border border-border px-3 py-2 text-base font-medium"
        >
          <Users className="h-5 w-5 text-primary shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="truncate">Quem cuida de mim</span>
        </Link>
      </div>
    </Painel>
  );
}
