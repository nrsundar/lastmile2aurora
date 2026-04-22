import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch } from "wouter";
import { AuthProvider } from "./hooks/useAuth";
import AppLayout from "./components/AppLayout";
import AuthPage from "./pages/auth";
import DashboardPage from "./pages/dashboard";
import TranslatePage from "./pages/translate";
import ReportPage from "./pages/report";

const qc = new QueryClient();

function AppRouter() {
  return (
    <Router>
      <AppLayout>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/auth" component={AuthPage} />
          <Route path="/translate" component={TranslatePage} />
          <Route path="/report" component={ReportPage} />
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
