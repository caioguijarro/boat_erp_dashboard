import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Beer, BarChart3, Package, DollarSign, Zap } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Beer className="h-10 w-10 text-primary animate-pulse" />
          <p className="text-muted-foreground text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 px-6 py-4">
        <div className="flex items-center gap-2">
          <Beer className="h-6 w-6 text-primary" />
          <span className="font-bold text-primary text-lg">BOAT BEER</span>
          <span className="text-muted-foreground text-sm ml-1">ERP Dashboard</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl w-full text-center space-y-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
              <Zap className="h-3.5 w-3.5" />
              Performance Beer · Santos, SP
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              Central de Operações<br />
              <span className="text-primary">Boat Beer Company</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Dashboard integrado ao Olist ERP para gestão de pedidos, estoque, financeiro e insights em tempo real.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
            {[
              { icon: BarChart3, label: "Vendas", desc: "Métricas em tempo real" },
              { icon: Package, label: "Estoque", desc: "Alertas automáticos" },
              { icon: DollarSign, label: "Financeiro", desc: "Fluxo de caixa" },
              { icon: Zap, label: "Insights IA", desc: "Análises automáticas" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-card border border-border rounded-lg p-3 space-y-1">
                <Icon className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>

          <Button
            size="lg"
            className="px-8 shadow-lg shadow-primary/20"
            onClick={() => { window.location.href = getLoginUrl(); }}
          >
            Acessar Dashboard
          </Button>
        </div>
      </main>

      <footer className="border-t border-border/50 px-6 py-4 text-center text-xs text-muted-foreground">
        Boat Beer Company · A Primeira Performance Beer do Brasil
      </footer>
    </div>
  );
}
