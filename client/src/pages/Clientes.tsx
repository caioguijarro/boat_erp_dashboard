import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Users, DollarSign, CheckCircle, XCircle, TrendingUp, ShoppingCart } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

export default function Clientes() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [abaAtiva, setAbaAtiva] = useState<"clientes" | "conciliacao">("clientes");

  const dataInicio = useMemo(() => new Date(ano, mes - 1, 1), [ano, mes]);
  const dataFim = useMemo(() => new Date(ano, mes, 0, 23, 59, 59), [ano, mes]);

  const { data: topClientes = [], isLoading: loadingClientes } = trpc.analytics.topClientes.useQuery(
    { dataInicio, dataFim, limit: 10 },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: conciliacao = [], isLoading: loadingConciliacao } = trpc.analytics.conciliacao.useQuery(
    { dataInicio, dataFim },
    { staleTime: 5 * 60 * 1000 }
  );

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  // Totais de conciliação
  const totalEntregues = conciliacao.reduce((s, p) => s + (p.status === "entregue" || p.status === "pago" ? Number(p.totalPedido ?? 0) : 0), 0);
  const totalPagos = conciliacao.filter(p => p.status === "pago").reduce((s, p) => s + Number(p.totalPedido ?? 0), 0);
  const totalPendente = totalEntregues - totalPagos;

  const chartData = topClientes.slice(0, 10).map(c => ({
    nome: (c.clienteNome ?? "Desconhecido").split(" ")[0],
    total: Number(c.total_compras),
    pedidos: Number(c.total_pedidos),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {p.dataKey === "total" ? formatCurrency(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Top clientes e conciliação de pedidos</p>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button variant="ghost" size="sm" onClick={() => navMes(-1)} className="h-8 w-8 p-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium px-2 min-w-[100px] text-center">
            {MESES[mes - 1]} {ano}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navMes(1)} className="h-8 w-8 p-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-border">
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${abaAtiva === "clientes" ? "border-blue-500 text-blue-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setAbaAtiva("clientes")}
        >
          Top 10 Clientes
        </button>
        <button
          className={`pb-2 px-1 text-sm font-medium transition-colors border-b-2 ${abaAtiva === "conciliacao" ? "border-blue-500 text-blue-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          onClick={() => setAbaAtiva("conciliacao")}
        >
          Conciliação
        </button>
      </div>

      {/* ABA: Top Clientes */}
      {abaAtiva === "clientes" && (
        <>
          {/* Gráfico */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Top 10 Clientes por Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClientes ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div>
              ) : chartData.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <Users className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Nenhum dado neste período</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="nome"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      width={70}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="total" name="Vendas" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Ranking de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingClientes ? (
                <div className="py-8 text-center text-muted-foreground">Carregando...</div>
              ) : topClientes.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Nenhum cliente neste período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left pb-2 font-medium">#</th>
                        <th className="text-left pb-2 font-medium">Cliente</th>
                        <th className="text-right pb-2 font-medium">Pedidos</th>
                        <th className="text-right pb-2 font-medium">Total</th>
                        <th className="text-right pb-2 font-medium">Ticket Médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topClientes.map((c, i) => {
                        const total = Number(c.total_compras);
                        const qtd = Number(c.total_pedidos);
                        return (
                          <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                            <td className="py-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-yellow-500/20 text-yellow-600" : i === 1 ? "bg-gray-400/20 text-gray-500" : i === 2 ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground"}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-3 font-medium text-foreground">{c.clienteNome ?? "Desconhecido"}</td>
                            <td className="py-3 text-right text-muted-foreground">{qtd}</td>
                            <td className="py-3 text-right font-semibold text-foreground">{formatCurrency(total)}</td>
                            <td className="py-3 text-right text-muted-foreground">{qtd > 0 ? formatCurrency(total / qtd) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ABA: Conciliação */}
      {abaAtiva === "conciliacao" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <ShoppingCart className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Entregue</p>
                    <p className="text-xl font-bold text-foreground">{formatCurrency(totalEntregues)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Pago</p>
                    <p className="text-xl font-bold text-green-500">{formatCurrency(totalPagos)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <XCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Gap (Entregue - Pago)</p>
                    <p className="text-xl font-bold text-red-500">{formatCurrency(totalPendente)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de Conciliação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                Pedidos Entregues vs. Pagos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingConciliacao ? (
                <div className="py-8 text-center text-muted-foreground">Carregando...</div>
              ) : conciliacao.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Nenhum pedido neste período</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th className="text-left pb-2 font-medium">Pedido</th>
                        <th className="text-left pb-2 font-medium">Cliente</th>
                        <th className="text-left pb-2 font-medium">Data</th>
                        <th className="text-left pb-2 font-medium">Status</th>
                        <th className="text-right pb-2 font-medium">Valor</th>
                        <th className="text-left pb-2 font-medium">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conciliacao.map((p, i) => (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 font-mono text-xs text-muted-foreground">#{p.numero}</td>
                          <td className="py-2 font-medium text-foreground max-w-[150px] truncate">{p.clienteNome ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">
                            {p.dataPedido ? new Date(p.dataPedido).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td className="py-2">
                            <Badge
                              variant="outline"
                              className={`text-xs ${p.status === "pago" ? "bg-green-500/10 text-green-600 border-green-500/20" : p.status === "entregue" ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-muted text-muted-foreground"}`}
                            >
                              {p.status === "pago" ? "Pago" : p.status === "entregue" ? "Entregue" : p.status ?? "—"}
                            </Badge>
                          </td>
                          <td className="py-2 text-right font-semibold text-foreground">
                            {formatCurrency(Number(p.totalPedido ?? 0))}
                          </td>
                          <td className="py-2">
                            {p.status === "pago" ? (
                              <span className="flex items-center gap-1 text-green-600 text-xs">
                                <CheckCircle className="h-3 w-3" /> Confirmado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                                <XCircle className="h-3 w-3" /> Pendente
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
