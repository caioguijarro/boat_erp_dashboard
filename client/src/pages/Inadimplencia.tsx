import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, DollarSign, Clock, Users, ChevronLeft, ChevronRight, Search } from "lucide-react";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

function diasAtraso(dataPedido: string | Date): number {
  const data = new Date(dataPedido);
  const hoje = new Date();
  const diff = hoje.getTime() - data.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getBadgeAtraso(dias: number) {
  if (dias > 60) return { label: "Crítico", className: "bg-red-500/10 text-red-500 border-red-500/20" };
  if (dias > 30) return { label: "Alto", className: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
  if (dias > 15) return { label: "Médio", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" };
  return { label: "Baixo", className: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
}

export default function Inadimplencia() {
  const [busca, setBusca] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState<string>("todos");

  const { data: inadimplentes = [], isLoading } = trpc.analytics.inadimplencia.useQuery(
    {},
    { staleTime: 5 * 60 * 1000 }
  );

  // Filtrar por busca e vendedor
  const dadosFiltrados = useMemo(() => {
    return inadimplentes.filter(p => {
      const matchBusca = !busca ||
        p.clienteNome?.toLowerCase().includes(busca.toLowerCase()) ||
        p.numero?.includes(busca);
      const matchVendedor = filtroVendedor === "todos" || p.vendedor_nome === filtroVendedor;
      return matchBusca && matchVendedor;
    });
  }, [inadimplentes, busca, filtroVendedor]);

  // Vendedores únicos
  const vendedores = useMemo(() => {
    const nomes = Array.from(new Set(inadimplentes.map(p => p.vendedor_nome).filter(Boolean))) as string[];
    return nomes.sort();
  }, [inadimplentes]);

  // Totais
  const totalInadimplente = dadosFiltrados.reduce((s, p) => s + Number(p.totalPedido ?? 0), 0);
  const totalPedidos = dadosFiltrados.length;

  // Agrupado por vendedor
  const porVendedor = useMemo(() => {
    const grupos: Record<string, { total: number; quantidade: number }> = {};
    dadosFiltrados.forEach(p => {
      const nome = p.vendedor_nome ?? "Sem vendedor";
      if (!grupos[nome]) grupos[nome] = { total: 0, quantidade: 0 };
      grupos[nome].total += Number(p.totalPedido ?? 0);
      grupos[nome].quantidade++;
    });
    return Object.entries(grupos).sort((a, b) => b[1].total - a[1].total);
  }, [dadosFiltrados]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inadimplência</h1>
        <p className="text-muted-foreground text-sm">Pedidos entregues e não pagos</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total em Aberto</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(totalInadimplente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos Inadimplentes</p>
                <p className="text-xl font-bold text-foreground">{totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedores com Inadimplência</p>
                <p className="text-xl font-bold text-foreground">{porVendedor.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo por Vendedor */}
      {porVendedor.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Inadimplência por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {porVendedor.map(([nome, dados]) => {
                const percTotal = totalInadimplente > 0 ? (dados.total / totalInadimplente) * 100 : 0;
                return (
                  <div key={nome} className="flex items-center gap-3">
                    <button
                      className={`text-sm font-medium min-w-[140px] text-left truncate hover:text-blue-500 transition-colors ${filtroVendedor === nome ? "text-blue-500" : "text-foreground"}`}
                      onClick={() => setFiltroVendedor(filtroVendedor === nome ? "todos" : nome)}
                    >
                      {nome}
                    </button>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all"
                        style={{ width: `${percTotal}%` }}
                      />
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className="text-sm font-semibold text-red-500">{formatCurrency(dados.total)}</p>
                      <p className="text-xs text-muted-foreground">{dados.quantidade} pedido{dados.quantidade !== 1 ? "s" : ""}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou número do pedido..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={filtroVendedor === "todos" ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroVendedor("todos")}
          >
            Todos
          </Button>
          {vendedores.map(v => (
            <Button
              key={v}
              variant={filtroVendedor === v ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroVendedor(filtroVendedor === v ? "todos" : v)}
            >
              {v.split(" ")[0]}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista de Pedidos Inadimplentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Pedidos em Aberto
            {dadosFiltrados.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{dadosFiltrados.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando...</div>
          ) : dadosFiltrados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                {inadimplentes.length === 0
                  ? "Nenhum pedido inadimplente encontrado"
                  : "Nenhum resultado para os filtros aplicados"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left pb-3 font-medium">Pedido</th>
                    <th className="text-left pb-3 font-medium">Cliente</th>
                    <th className="text-left pb-3 font-medium">Vendedor</th>
                    <th className="text-left pb-3 font-medium">Data</th>
                    <th className="text-left pb-3 font-medium">Atraso</th>
                    <th className="text-right pb-3 font-medium">Valor</th>
                    <th className="text-left pb-3 font-medium">Risco</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosFiltrados.map((p, i) => {
                    const dias = diasAtraso(p.dataPrevEntrega ?? p.dataPedido);
                    const badge = getBadgeAtraso(dias);
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-3 font-mono text-xs text-muted-foreground">#{p.numero}</td>
                        <td className="py-3 font-medium text-foreground max-w-[150px] truncate">{p.clienteNome ?? "—"}</td>
                        <td className="py-3 text-muted-foreground">{p.vendedor_nome ?? "—"}</td>
                        <td className="py-3 text-muted-foreground">
                          {p.dataPrevEntrega
                            ? new Date(p.dataPrevEntrega).toLocaleDateString("pt-BR")
                            : p.dataPedido
                            ? new Date(p.dataPedido).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{dias}d</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-semibold text-red-500">
                          {formatCurrency(Number(p.totalPedido ?? 0))}
                        </td>
                        <td className="py-3">
                          <Badge variant="outline" className={`text-xs ${badge.className}`}>
                            {badge.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={5} className="pt-3 text-sm font-semibold text-foreground">Total</td>
                    <td className="pt-3 text-right font-bold text-red-500">{formatCurrency(totalInadimplente)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
