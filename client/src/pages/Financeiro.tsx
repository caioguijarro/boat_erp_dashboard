import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AlertTriangle, CheckCircle, DollarSign, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { useState } from "react";

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const STATUS_RECEBER: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  recebido: { label: "Recebido", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelado: { label: "Cancelado", cls: "bg-muted/50 text-muted-foreground" },
  vencido: { label: "Vencido", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const STATUS_PAGAR: Record<string, { label: string; cls: string }> = {
  aberto: { label: "Aberto", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  pago: { label: "Pago", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelado: { label: "Cancelado", cls: "bg-muted/50 text-muted-foreground" },
  vencido: { label: "Vencido", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export default function Financeiro() {
  const [tabAtiva, setTabAtiva] = useState<"receber" | "pagar">("receber");
  const [statusReceber, setStatusReceber] = useState("todos");
  const [statusPagar, setStatusPagar] = useState("todos");

  const { data: resumo, isLoading: loadingResumo } = trpc.financeiro.resumo.useQuery(undefined, { refetchInterval: 60000 });
  const { data: contasReceber, isLoading: loadingReceber } = trpc.financeiro.contasReceber.useQuery({
    status: statusReceber !== "todos" ? statusReceber : undefined,
  }, { refetchInterval: 60000 });
  const { data: contasPagar, isLoading: loadingPagar } = trpc.financeiro.contasPagar.useQuery({
    status: statusPagar !== "todos" ? statusPagar : undefined,
  }, { refetchInterval: 60000 });

  const chartData = [
    {
      name: "Aberto",
      "A Receber": Number(resumo?.receber?.aberto ?? 0),
      "A Pagar": Number(resumo?.pagar?.aberto ?? 0),
    },
    {
      name: "Vencido",
      "A Receber": Number(resumo?.receber?.vencido ?? 0),
      "A Pagar": Number(resumo?.pagar?.vencido ?? 0),
    },
    {
      name: "Recebido/Pago",
      "A Receber": Number(resumo?.receber?.recebido ?? 0),
      "A Pagar": Number(resumo?.pagar?.pago ?? 0),
    },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Contas a receber, a pagar e fluxo de caixa</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {loadingResumo ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 bg-muted rounded w-24" />
                    <div className="h-6 bg-muted rounded w-32" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">A Receber (Aberto)</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(resumo?.receber?.aberto)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-500/10">
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">A Pagar (Aberto)</p>
                      <p className="text-lg font-bold text-red-400">{formatCurrency(resumo?.pagar?.aberto)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${Number(resumo?.saldoProjetado ?? 0) >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                      <DollarSign className={`h-4 w-4 ${Number(resumo?.saldoProjetado ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo Projetado</p>
                      <p className={`text-lg font-bold ${Number(resumo?.saldoProjetado ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {formatCurrency(resumo?.saldoProjetado)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-card border-border">
                <CardContent className="pt-4 pb-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Vencidos (Receber)</p>
                      <p className="text-lg font-bold text-amber-400">{formatCurrency(resumo?.receber?.vencido)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-foreground">Comparativo Financeiro</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.every(d => d["A Receber"] === 0 && d["A Pagar"] === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2">
                <DollarSign className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sem dados financeiros ainda</p>
                <p className="text-xs text-muted-foreground/60">Os dados aparecerão após os webhooks do Olist serem configurados</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.01 240)" />
                  <XAxis dataKey="name" tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 12 }} />
                  <YAxis tick={{ fill: "oklch(0.55 0.01 240)", fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "oklch(0.16 0.015 240)", border: "1px solid oklch(0.25 0.01 240)", borderRadius: "8px" }}
                    formatter={(value: number) => [formatCurrency(value)]}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="A Receber" fill="oklch(0.70 0.18 150)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="A Pagar" fill="oklch(0.60 0.22 25)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTabAtiva("receber")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tabAtiva === "receber" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Contas a Receber
          </button>
          <button
            onClick={() => setTabAtiva("pagar")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tabAtiva === "pagar" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"}`}
          >
            Contas a Pagar
          </button>
        </div>

        {/* Tables */}
        {tabAtiva === "receber" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Contas a Receber</CardTitle>
                <Select value={statusReceber} onValueChange={setStatusReceber}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Object.entries(STATUS_RECEBER).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingReceber ? (
                <div className="p-8 animate-pulse space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
                </div>
              ) : !contasReceber?.length ? (
                <div className="p-12 text-center">
                  <CheckCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma conta a receber encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Cliente</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Vencimento</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Forma Pgto</TableHead>
                        <TableHead className="text-muted-foreground text-xs text-right">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasReceber.map(conta => (
                        <TableRow key={conta.id} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm text-foreground max-w-[200px] truncate">{conta.descricao ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{conta.clienteNome ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(conta.dataVencimento)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{conta.formaPagamento ?? "-"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-foreground">{formatCurrency(conta.valor)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${STATUS_RECEBER[conta.status ?? ""]?.cls ?? ""}`}>
                              {STATUS_RECEBER[conta.status ?? ""]?.label ?? conta.status ?? "-"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tabAtiva === "pagar" && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Contas a Pagar</CardTitle>
                <Select value={statusPagar} onValueChange={setStatusPagar}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {Object.entries(STATUS_PAGAR).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingPagar ? (
                <div className="p-8 animate-pulse space-y-3">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
                </div>
              ) : !contasPagar?.length ? (
                <div className="p-12 text-center">
                  <XCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">Nenhuma conta a pagar encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground text-xs">Descrição</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Fornecedor</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Vencimento</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Forma Pgto</TableHead>
                        <TableHead className="text-muted-foreground text-xs text-right">Valor</TableHead>
                        <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contasPagar.map(conta => (
                        <TableRow key={conta.id} className="border-border hover:bg-muted/30">
                          <TableCell className="text-sm text-foreground max-w-[200px] truncate">{conta.descricao ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{conta.fornecedorNome ?? "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(conta.dataVencimento)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{conta.formaPagamento ?? "-"}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-foreground">{formatCurrency(conta.valor)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${STATUS_PAGAR[conta.status ?? ""]?.cls ?? ""}`}>
                              {STATUS_PAGAR[conta.status ?? ""]?.label ?? conta.status ?? "-"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
    </div>
  );
}
