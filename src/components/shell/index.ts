export { PageHeader } from "./PageHeader";
export { SectionHeader } from "./SectionHeader";
export { SurfaceCard } from "./SurfaceCard";
export { ContentGrid } from "./ContentGrid";
export { EmptyState } from "./EmptyState";
export { PageTransition } from "./PageTransition";
export { PageHeaderSkeleton, SurfaceCardSkeleton, GridSkeleton } from "./Skeletons";
export { PageError, CardError, OfflineError, EmptyData } from "./ErrorStates";
export { PageLoader } from "./PageLoader";
export { UpgradeGate } from "./UpgradeGate";
export { StatusBadge } from "./StatusBadge";
export { StatCard } from "./StatCard";
export {
  CartaoDestaque, BarraProgresso, CartaoMedida, LinhaRecurso,
  Atalho, Painel, LayoutPainel, type MedidaExibida,
} from "./Primitivos";
// Linguagem visual das telas do paciente FORA da home. Ver o cabeçalho de
// Paciente.tsx para por que é componente novo, e não variante do compartilhado.
export {
  TelaPaciente, TituloSecao, Formulario, Campo, OpcaoBotao, GradeOpcoes,
  Lista, ItemLista, BarraProporcao, AvisoDaTela, CartaoErro,
} from "./Paciente";
export {
  usePrefereMenosMovimento, AreaGrafico, LegendaGrafico, NotaGrafico,
  gradeGrafico, eixoX, eixoY, dicaGrafico,
  COR_SERIE, COR_SERIE_APOIO, COR_REFERENCIA,
} from "./Grafico";
