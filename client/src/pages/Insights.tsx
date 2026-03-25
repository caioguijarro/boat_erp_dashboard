import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart2, Brain, RefreshCw, ShoppingCart, TrendingUp, Warehouse } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

type InsightTipo = "vendas" | "estoque" | "financeiro" | "resumo_semanal";

const INSIGHTS: { tipo: InsightTipo; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { tipo: "vendas", label: "Análise de Vendas", desc: "Tendências, produtos mais vendidos e oportunidades", icon: TrendingUp },
  { tipo: "estoque", label: "Análise de Estoque", desc: "Produtos para reposição e previsão de demanda", icon: Warehouse },
  { tipo: "financeiro", label: "Análise Financeira", desc: "Fluxo de caixa, inadimplência e projeções", icon: BarChart2 },
  { tipo: "resumo_semanal", label: "Resumo Semanal", desc: "Resumo executivo completo da semana", icon: Brain },
];

export default function Insights() {
  const [tipoAtivo, setTipoAtivo] = useState<InsightTipo>("resumo_semanal");
  const [resultados, setResultados] = useState<Record<string, string>>({});

  const analisar = trpc.insights.analisar.useMutation({
    onSuccess: (data, variables) => {
      setResultados(prev => ({ ...prev, [variables.tipo]: typeof data.analise === 'string' ? data.analise : JSON.stringify(data.analise) }));
    },
    onError: () => {
      toast.error("Erro ao gerar análise. Tente novamente.");
    },
  });

  const handleAnalisar = (tipo: InsightTipo) => {
    setTipoAtivo(tipo);
    analisar.mutate({ tipo });
  };

  const insightAtual = INSIGHTS.find(i => i.tipo === tipoAtivo);

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights com IA</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Análises automáticas dos dados do ERP geradas por inteligência artificial</p>
        </div>

        {/* Insight Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {INSIGHTS.map(({ tipo, label, desc, icon: Icon }) => (
            <Card
              key={tipo}
              className={`bg-card border-border cursor-pointer transition-all hover:border-primary/50 ${tipoAtivo === tipo ? "border-primary ring-1 ring-primary/20" : ""}`}
              onClick={() => setTipoAtivo(tipo)}
            >
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${tipoAtivo === tipo ? "bg-primary/20" : "bg-muted/50"}`}>
                    <Icon className={`h-4 w-4 ${tipoAtivo === tipo ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${tipoAtivo === tipo ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 leading-tight">{desc}</p>
                    {resultados[tipo] && (
                      <span className="inline-block mt-1.5 text-xs text-emerald-400 font-medium">✓ Gerado</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Generate Button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => handleAnalisar(tipoAtivo)}
            disabled={analisar.isPending}
            className="gap-2"
          >
            {analisar.isPending ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Analisando...</>
            ) : (
              <><Brain className="h-4 w-4" /> Gerar {insightAtual?.label}</>
            )}
          </Button>
          {resultados[tipoAtivo] && (
            <Button variant="outline" size="sm" onClick={() => handleAnalisar(tipoAtivo)} disabled={analisar.isPending} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          )}
        </div>

        {/* Result */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              {insightAtual && <insightAtual.icon className="h-4 w-4 text-primary" />}
              <CardTitle className="text-base font-semibold text-foreground">{insightAtual?.label}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {analisar.isPending ? (
              <div className="space-y-3 animate-pulse">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`h-3 bg-muted rounded ${i % 3 === 2 ? "w-3/4" : "w-full"}`} />
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">Analisando dados do ERP com IA...</p>
              </div>
            ) : resultados[tipoAtivo] ? (
              <div className="prose prose-sm prose-invert max-w-none">
                <Streamdown>{resultados[tipoAtivo]}</Streamdown>
              </div>
            ) : (
              <div className="py-12 text-center space-y-3">
                <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground">Clique em "Gerar {insightAtual?.label}" para obter uma análise inteligente dos seus dados</p>
                <p className="text-xs text-muted-foreground/60">A IA analisará os dados do ERP e fornecerá insights acionáveis</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
