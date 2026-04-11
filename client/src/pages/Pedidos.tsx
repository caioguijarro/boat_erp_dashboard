import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Eye, Package, Search, Truck } from "lucide-react";
import { useState } from "react";

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  aprovado: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  em_andamento: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  enviado: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  entregue: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelado: "bg-red-500/10 text-red-400 border-red-500/20",
  recusado: "bg-red-500/10 text-red-400 border-red-500/20",
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

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function Pedidos() {
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [search, setSearch] = useState("");
  const [selectedPedidoId, setSelectedPedidoId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const { data: pedidos, isLoading } = trpc.pedidos.listar.useQuery({
    status: statusFilter !== "todos" ? statusFilter : undefined,
    limit: LIMIT,
    offset: page * LIMIT,
  }, { refetchInterval: 30000 });

  const { data: detalhe, isLoading: loadingDetalhe } = trpc.pedidos.detalhe.useQuery(
    { id: selectedPedidoId! },
    { enabled: selectedPedidoId !== null }
  );

  const filteredPedidos = pedidos?.filter(p =>
    !search || p.numero?.toLowerCase().includes(search.toLowerCase()) ||
    p.clienteNome?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gerenciamento de pedidos do Olist ERP</p>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número ou cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-input border-border"
                />
              </div>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-48 bg-input border-border">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              {isLoading ? "Carregando..." : `${filteredPedidos.length} pedido(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-pulse space-y-3">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
                </div>
              </div>
            ) : filteredPedidos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">Nenhum pedido encontrado</p>
                <p className="text-xs text-muted-foreground/60">Os pedidos aparecerão aqui após os webhooks do Olist serem configurados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Número</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Cliente</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Data</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Valor</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPedidos.map(pedido => (
                      <TableRow key={pedido.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-mono text-sm text-foreground">
                          #{pedido.numero ?? pedido.id}
                        </TableCell>
                        <TableCell className="text-sm text-foreground max-w-[180px] truncate">
                          {pedido.clienteNome ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(pedido.dataPedido)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-xs ${STATUS_COLORS[pedido.status ?? ""] ?? "bg-muted/50 text-muted-foreground"}`}
                          >
                            {STATUS_LABELS[pedido.status ?? ""] ?? pedido.status ?? "N/A"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          {formatCurrency(pedido.totalPedido)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedPedidoId(pedido.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && filteredPedidos.length >= LIMIT && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground">Página {page + 1}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)}>
                  Próxima
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={selectedPedidoId !== null} onOpenChange={open => !open && setSelectedPedidoId(null)}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Pedido #{detalhe?.pedido?.numero ?? selectedPedidoId}
            </DialogTitle>
          </DialogHeader>
          {loadingDetalhe ? (
            <div className="animate-pulse space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-muted rounded" />)}
            </div>
          ) : detalhe?.pedido ? (
            <div className="space-y-5">
              {/* Status and value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={STATUS_COLORS[detalhe.pedido.status ?? ""] ?? ""}>
                    {STATUS_LABELS[detalhe.pedido.status ?? ""] ?? detalhe.pedido.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-lg font-bold text-foreground">{formatCurrency(detalhe.pedido.totalPedido)}</p>
                </div>
              </div>

              {/* Client info */}
              <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-medium text-foreground">{detalhe.pedido.clienteNome ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{detalhe.pedido.clienteEmail ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{detalhe.pedido.clienteCpfCnpj ?? "-"}</p>
              </div>

              {/* Order details */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Data do Pedido</p><p className="text-foreground">{formatDate(detalhe.pedido.dataPedido)}</p></div>
                <div><p className="text-xs text-muted-foreground">Prev. Entrega</p><p className="text-foreground">{formatDate(detalhe.pedido.dataPrevEntrega)}</p></div>
                <div><p className="text-xs text-muted-foreground">Forma de Pagamento</p><p className="text-foreground">{detalhe.pedido.formaPagamento ?? "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Canal</p><p className="text-foreground">{detalhe.pedido.canal ?? "-"}</p></div>
                <div><p className="text-xs text-muted-foreground">Frete</p><p className="text-foreground">{formatCurrency(detalhe.pedido.totalFrete)}</p></div>
                <div><p className="text-xs text-muted-foreground">Desconto</p><p className="text-foreground">{formatCurrency(detalhe.pedido.totalDesconto)}</p></div>
              </div>

              {/* Items */}
              {detalhe.itens && detalhe.itens.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Itens do Pedido</p>
                  <div className="space-y-1">
                    {detalhe.itens.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                        <div>
                          <p className="text-foreground font-medium">{item.produtoNome ?? "-"}</p>
                          <p className="text-xs text-muted-foreground">Qtd: {item.quantidade} × {formatCurrency(item.valorUnitario)}</p>
                        </div>
                        <p className="font-medium text-foreground">{formatCurrency(item.valorTotal)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shipping */}
              {detalhe.expedicao && (
                <div className="space-y-2 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-primary" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Expedição</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Transportadora</p><p className="text-foreground">{detalhe.expedicao.transportadora ?? "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Rastreio</p><p className="text-foreground font-mono text-xs">{detalhe.expedicao.codigoRastreio ?? "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Status</p><p className="text-foreground">{detalhe.expedicao.status ?? "-"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Entrega</p><p className="text-foreground">{formatDate(detalhe.expedicao.dataEntrega)}</p></div>
                  </div>
                  {detalhe.expedicao.urlRastreio && (
                    <a href={detalhe.expedicao.urlRastreio} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                      Rastrear envio →
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
