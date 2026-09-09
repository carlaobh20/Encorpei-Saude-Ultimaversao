import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProviders } from "@/app/providers";
import { AppRouter } from "@/app/router";

const App = () => (
  <ErrorBoundary scope="AppRoot">
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </ErrorBoundary>
);

export default App;
