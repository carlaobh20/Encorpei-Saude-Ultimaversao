import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppShell } from "@/components/shell/AppShell";
import {
  HojePage, PressaoPage, PesoPage, GlicemiaPage, AtividadePage, SonoPage, RemediosPage, ExamesPage,
  AgendaPage, MetasPage, PulseiraPage, SintomasPage, EmergenciaPage,
  MedicoChatPage, ContaPage, ConfiguracoesPage, FeedbackPage,
  MeuCoracaoPage, ComoEstouPage, CaminhadaPage, AlimentacaoPage,
  AprenderPage, MeuMesPage, CuidadoresPage,
} from "@/routes/lazy";

export const appRoutes = (
  <Route element={<ProtectedRoute />}>
    <Route element={<AppShell />}>
      <Route path="/hoje"          element={<HojePage />} />
      <Route path="/meu-coracao"   element={<MeuCoracaoPage />} />
      <Route path="/como-estou"    element={<ComoEstouPage />} />
      <Route path="/caminhada"     element={<CaminhadaPage />} />
      <Route path="/alimentacao"   element={<AlimentacaoPage />} />
      <Route path="/aprender"      element={<AprenderPage />} />
      <Route path="/meu-mes"       element={<MeuMesPage />} />
      <Route path="/cuidadores"    element={<CuidadoresPage />} />
      <Route path="/pressao"       element={<PressaoPage />} />
      <Route path="/peso"          element={<PesoPage />} />
      <Route path="/glicemia"      element={<GlicemiaPage />} />
      <Route path="/atividade"     element={<AtividadePage />} />
      <Route path="/sono"          element={<SonoPage />} />
      <Route path="/remedios"      element={<RemediosPage />} />
      <Route path="/exames"        element={<ExamesPage />} />
      <Route path="/agenda"        element={<AgendaPage />} />
      <Route path="/metas"         element={<MetasPage />} />
      <Route path="/pulseira"      element={<PulseiraPage />} />
      {/* /sintomas não tem item de menu de propósito: chega-se por ele pelo
          Registro Rápido e pelo cartão do Hoje, que é quando o paciente
          realmente tem um sintoma para contar. Não é rota órfã. */}
      <Route path="/sintomas"      element={<SintomasPage />} />
      <Route path="/emergencia"    element={<EmergenciaPage />} />
      <Route path="/medico"        element={<MedicoChatPage />} />
      <Route path="/conta"         element={<ContaPage />} />
      <Route path="/configuracoes" element={<ConfiguracoesPage />} />
      <Route path="/feedback"      element={<FeedbackPage />} />

      {/* Atalhos e nomes alternativos que as pessoas tentam digitar. */}
      {/* /minha-semana era a home do app de obstetrícia que originou este
          projeto. Fica só como redirect para não quebrar link antigo,
          atalho salvo ou PWA instalado antes da troca do start_url. */}
      <Route path="/minha-semana"  element={<Navigate to="/hoje" replace />} />
      <Route path="/pressao-arterial" element={<Navigate to="/pressao" replace />} />
      <Route path="/medicamentos"  element={<Navigate to="/remedios" replace />} />
      {/* "Açúcar no sangue" é como o paciente chama; "glicose" é como o exame
          vem escrito no papel. Os dois caem na mesma tela. */}
      <Route path="/glicose"       element={<Navigate to="/glicemia" replace />} />
      <Route path="/acucar"        element={<Navigate to="/glicemia" replace />} />
      <Route path="/consultas"     element={<Navigate to="/agenda" replace />} />
    </Route>
  </Route>
);
