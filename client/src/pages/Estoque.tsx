import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Package, Search, TrendingDown, XCircle } from "lucide-react";
import { useState } from "react";

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function StockBadge({ saldo, estoqueMinimo }: { saldo: string | null | undefined; estoqueMinimo: string | null | undefined }) {
  const qty = Number(saldo ?? 0);
  const min = Number(estoqueMinimo ?? 0);
  if (qty <= 0) return (
    <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1">
      <XCircle className="h-3 w-3" /> Sem Estoque
    </Badge>
  );
  if (min > 0 && qty <= min) return (
    <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs gap-1">
      <AlertTriangle className="h-3 w-3" /> Estoque Baixo
    </Badge>
  );
  return (
    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs">
      Normal
    </Badge>
  );
}

export default function Estoque() {
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [page, setPage] = useState(0);
  const LIMIT = 25;

  const { data: produtos, isLoading } = trpc.estoque.listar.useQuery({
    limit: LIMIT,
    offset: page * LIMIT,
    apenasAlerta: filtroStatus === "alerta",
    apenasSemEstoque: filtroStatus === "sem_estoque",
  }, { refetchInterval: 60000 });

  const { data: resumo } = trpc.estoque.resumo.useQuery(undefined, { refetchInterval: 60000 });

  const filteredProdutos = produtos?.filter(p =>
    !search ||
    p.nome?.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Controle de produtos e alertas de estoque</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total de Produtos", value: resumo?.total ?? 0, icon: Package, color: "text-primary" },
            { label: "Em Estoque", value: (resumo?.total ?? 0) - (resumo?.semEstoque ?? 0), icon: Package, color: "text-emerald-400" },
            { label: "Estoque Baixo", value: resumo?.baixoEstoque ?? 0, icon: TrendingDown, color: "text-amber-400" },
            { label: "Sem Estoque", value: resumo?.semEstoque ?? 0, icon: XCircle, color: "text-red-400" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-card border-border">
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold text-foreground">{value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, SKU ou código..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-input border-border"
                />
              </div>
              <Select value={filtroStatus} onValueChange={v => { setFiltroStatus(v); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-48 bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  <SelectItem value="alerta">Estoque baixo</SelectItem>
                  <SelectItem value="sem_estoque">Sem estoque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">
              {isLoading ? "Carregando..." : `${filteredProdutos.length} produto(s)`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8">
                <div className="animate-pulse space-y-3">
                  {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
                </div>
              </div>
            ) : filteredProdutos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Package className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">Nenhum produto encontrado</p>
                <p className="text-xs text-muted-foreground/60">Os produtos aparecerão aqui após os webhooks do Olist serem configurados</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground text-xs">Produto</TableHead>
                      <TableHead className="text-muted-foreground text-xs">SKU / Código</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Categoria</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Saldo</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Mínimo</TableHead>
                      <TableHead className="text-muted-foreground text-xs text-right">Preço</TableHead>
                      <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProdutos.map(produto => (
                      <TableRow key={produto.id} className="border-border hover:bg-muted/30">
                        <TableCell className="font-medium text-sm text-foreground max-w-[200px]">
                          <div className="truncate">{produto.nome ?? "-"}</div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {produto.codigo ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {produto.categoria ?? "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-bold ${Number(produto.estoqueAtual ?? 0) <= 0 ? "text-red-400" : Number(produto.estoqueMinimo ?? 0) > 0 && Number(produto.estoqueAtual ?? 0) <= Number(produto.estoqueMinimo ?? 0) ? "text-amber-400" : "text-emerald-400"}`}>
                            {Number(produto.estoqueAtual ?? 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {produto.estoqueMinimo ?? "-"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-foreground">
                          {formatCurrency(produto.preco)}
                        </TableCell>
                        <TableCell>
                          <StockBadge saldo={produto.estoqueAtual} estoqueMinimo={produto.estoqueMinimo} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && filteredProdutos.length >= LIMIT && (
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
  );
}
