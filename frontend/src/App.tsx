import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import TranslatePage from "./pages/translate";
import ReportPage from "./pages/report";
import AdminPage from "./pages/admin";
import PresentationPage from "./pages/presentation";
import Box from "@cloudscape-design/components/box";
import Spinner from "@cloudscape-design/components/spinner";

const qc = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <Box textAlign="center" padding="xxl"><Spinner size="large" /> Loading...</Box>;
  if (!user) return <AuthPage />;
  return <Component />;
}

function AppRouter() {
  return (
    <Router>
      <AppLayout>
        <Switch>
          <Route path="/" component={AuthPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/dashboard">{() => <ProtectedRoute component={DashboardPage} />}</Route>
          <Route path="/translate">{() => <ProtectedRoute component={TranslatePage} />}</Route>
          <Route path="/report">{() => <ProtectedRoute component={ReportPage} />}</Route>
          <Route path="/admin">{() => <ProtectedRoute component={AdminPage} />}</Route>
          <Route path="/presentation" component={PresentationPage} />
        </Switch>
      </AppLayout>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
