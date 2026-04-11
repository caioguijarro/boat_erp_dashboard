import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Pedidos from "./pages/Pedidos";
import Estoque from "./pages/Estoque";
import Financeiro from "./pages/Financeiro";
import Insights from "./pages/Insights";
import WebhookLogs from "./pages/WebhookLogs";
import Vendas from "./pages/Vendas";
import Vendedores from "./pages/Vendedores";
import Inadimplencia from "./pages/Inadimplencia";
import Clientes from "./pages/Clientes";

import DashboardLayout from "@/components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      <Route>
        <DashboardLayout>
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/pedidos" component={Pedidos} />
            <Route path="/estoque" component={Estoque} />
            <Route path="/financeiro" component={Financeiro} />
            <Route path="/insights" component={Insights} />
            <Route path="/webhooks" component={WebhookLogs} />
            <Route path="/vendas" component={Vendas} />
            <Route path="/vendedores" component={Vendedores} />
            <Route path="/inadimplencia" component={Inadimplencia} />
            <Route path="/clientes" component={Clientes} />
            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster theme="dark" position="top-right" richColors />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
