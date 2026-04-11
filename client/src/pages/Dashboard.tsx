import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, ShoppingCart, Package, DollarSign,
  AlertTriangle, CheckCircle, Clock, XCircle, RefreshCw, FlaskConical, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  pendente: "#f59e0b",
  aprovado: "#3b82f6",
  em_andamento: "#8b5cf6",
  enviado: "#06b6d4",
  entregue: "#10b981",
  cancelado: "#ef4444",
  recusado: "#ef4444",
};

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  em_andamento: "Em Andamento",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  recusado: "Recusado",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function MetricCard({
  title, value, subtitle, icon: Icon, color = "text-primary", trend
}: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color?: string; trend?: { value: number; label: string };
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-foreground truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${trend.value >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                <TrendingUp className="h-3 w-3" />
                <span>{trend.value >= 0 ? "+" : ""}{trend.value}% {trend.label}</span>
              </div>
            )}
          </div>
          <div className={`p-2.5 rounded-lg bg-primary/10 shrink-0 ml-3`}>
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [diasGrafico, setDiasGrafico] = useState(30);
  const utils = trpc.useUtils();
  const { data: metricas, isLoading: loadingMetricas, refetch } = trpc.dashboard.metricas.useQuery(undefined, {
    refetchInterval: 60000,
  });
  const { data: grafico, isLoading: loadingGrafico } = trpc.dashboard.graficoVendas.useQuery({ dias: diasGrafico });

  const seedMutation = trpc.demo.seed.useMutation({
    onSuccess: (data) => {
      toast.success(data.mensagem);
      utils.dashboard.metricas.invalidate();
      utils.dashboard.graficoVendas.invalidate();
    },
    onError: (e) => toast.error("Erro ao carregar dados: " + e.message),
  });

  const limparMutation = trpc.demo.limpar.useMutation({
    onSuccess: (data) => {
      toast.success(data.mensagem);
      utils.dashboard.metricas.invalidate();
      utils.dashboard.graficoVendas.invalidate();
    },
    onError: (e) => toast.error("Erro ao limpar dados: " + e.message),
  });

  const pedidosPorStatusData = metricas?.pedidosPorStatus?.map(p => ({
    name: STATUS_LABELS[p.status ?? ""] ?? p.status ?? "Outro",
    value: Number(p.quantidade),
    color: STATUS_COLORS[p.status ?? ""] ?? "#6b7280",
  })) ?? [];

  const graficoData = grafico?.map(d => ({
    data: new Date(d.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    vendas: Number(d.total),
    pedidos: Number(d.quantidade),
  })) ?? [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Visão geral das operações · Atualiza a cada 60s
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Atualizar
            </Button>
            {(metricas?.quantidadeMes === 0) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {seedMutation.isPending ? "Carregando..." : "Carregar Dados Demo"}
              </Button>
            )}
            {(metricas?.quantidadeMes ?? 0) > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => limparMutation.mutate()}
                disabled={limparMutation.isPending}
                className="gap-2 border-red-500/30 text-red-400/70 hover:bg-red-500/10 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                Limpar Demo
              </Button>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        {loadingMetricas ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="pt-5 pb-4 px-5">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-muted rounded w-24" />
                    <div className="h-7 bg-muted rounded w-32" />
                    <div className="h-3 bg-muted rounded w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Vendas Hoje"
              value={formatCurrency(metricas?.vendasHoje ?? 0)}
              subtitle={`${metricas?.quantidadeHoje ?? 0} pedidos`}
              icon={TrendingUp}
              color="text-emerald-400"
            />
            <MetricCard
              title="Vendas do Mês"
              value={formatCurrency(metricas?.vendasMes ?? 0)}
              subtitle={`${metricas?.quantidadeMes ?? 0} pedidos`}
              icon={DollarSign}
              color="text-primary"
            />
            <MetricCard
              title="Pedidos Pendentes"
              value={String(metricas?.pedidosPendentes ?? 0)}
              subtitle="Aguardando processamento"
              icon={ShoppingCart}
              color="text-amber-400"
            />
            <MetricCard
              title="Produtos Críticos"
              value={String((metricas?.estoque?.baixoEstoque ?? 0) + (metricas?.estoque?.semEstoque ?? 0))}
              subtitle={`${metricas?.estoque?.semEstoque ?? 0} sem estoque`}
              icon={Package}
              color="text-red-400"
            />
          </div>
        )}

        {/* Financial Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A Receber (Aberto)</p>
                  <p className="text-lg font-bold text-emerald-400">{formatCurrency(Number(metricas?.contasReceber?.aberto ?? 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <XCircle className="h-4 w-4 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">A Pagar (Aberto)</p>
                  <p className="text-lg font-bold text-red-400">{formatCurrency(Number(metricas?.contasPagar?.aberto ?? 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receber Vencido</p>
                  <p className="text-lg font-bold text-amber-400">{formatCurrency(Number(metricas?.contasReceber?.vencido ?? 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sales Chart */}
          <Card className="bg-card border-border lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Vendas por Dia</CardTitle>
                <div className="flex gap-1">
                  {[7, 14, 30].map(d => (
                    <Button
                      key={d}
                      variant={diasGrafico === d ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setDiasGrafico(d)}
                    >
                      {d}d
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingGrafico ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="animate-pulse text-muted-foreground text-sm">Carregando gráfico...</div>
                </div>
              ) : graficoData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <Clock className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
                  <p className="text-xs text-muted-foreground/60">Os dados aparecerão após os primeiros webhooks do Olist</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={graficoData}>
                    <defs>
                      <linearGradient id="colorVendas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.65 0.18 200)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 240)" />
                    <XAxis dataKey="data" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "oklch(0.16 0.015 240)", border: "1px solid oklch(0.25 0.01 240)", borderRadius: "8px" }}
                      labelStyle={{ color: "oklch(0.95 0.01 240)" }}
                      formatter={(value: number) => [formatCurrency(value), "Vendas"]}
                    />
                    <Area type="monotone" dataKey="vendas" stroke="oklch(0.65 0.18 200)" fill="url(#colorVendas)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Pedidos por Status</CardTitle>
            </CardHeader>
            <CardContent>
              {pedidosPorStatusData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2">
                  <Clock className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Sem pedidos ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={pedidosPorStatusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="value">
                        {pedidosPorStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "oklch(0.16 0.015 240)", border: "1px solid oklch(0.25 0.01 240)", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5">
                    {pedidosPorStatusData.slice(0, 5).map(item => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="text-muted-foreground">{item.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs h-5">{item.value}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
    </div>
  );
}
