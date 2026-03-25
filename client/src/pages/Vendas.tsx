import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend, BarChart, Bar,
} from "recharts";
import { TrendingUp, Target, DollarSign, ShoppingCart, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

function getDiasUteis(ano: number, mes: number): number {
  const diasNoMes = new Date(ano, mes, 0).getDate();
  let diasUteis = 0;
  for (let d = 1; d <= diasNoMes; d++) {
    const dow = new Date(ano, mes - 1, d).getDay();
    if (dow !== 0 && dow !== 6) diasUteis++;
  }
  return diasUteis;
}

function getDiaAtual(ano: number, mes: number): number {
  const hoje = new Date();
  if (hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes) {
    return hoje.getDate();
  }
  return new Date(ano, mes, 0).getDate();
}

export default function Vendas() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [novaMetaValor, setNovaMetaValor] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const dataInicio = useMemo(() => new Date(ano, mes - 1, 1), [ano, mes]);
  const dataFim = useMemo(() => new Date(ano, mes, 0, 23, 59, 59), [ano, mes]);

  const { data: vendasDia = [], isLoading: loadingVendas } = trpc.analytics.vendasPorDia.useQuery(
    { dataInicio, dataFim },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: metasList = [], refetch: refetchMetas } = trpc.metas.listar.useQuery(
    { ano, mes },
    { staleTime: 60 * 1000 }
  );

  const utils = trpc.useUtils();
  const salvarMeta = trpc.metas.salvar.useMutation({
    onSuccess: () => {
      refetchMetas();
      setDialogOpen(false);
      setNovaMetaValor("");
    },
  });

  const metaGeral = metasList.find(m => !m.vendedorId);
  const metaValor = metaGeral ? Number(metaGeral.valorMeta) : 0;

  // Calcular totais
  const totalVendas = vendasDia.reduce((sum, d) => sum + Number(d.total), 0);
  const totalPedidos = vendasDia.reduce((sum, d) => sum + Number(d.quantidade), 0);
  const percMeta = metaValor > 0 ? (totalVendas / metaValor) * 100 : 0;

  // Calcular meta diária proporcional
  const diasUteis = getDiasUteis(ano, mes);
  const diaAtual = getDiaAtual(ano, mes);
  const metaDiaria = diasUteis > 0 ? metaValor / diasUteis : 0;

  // Construir dados do gráfico com meta acumulada
  const diasNoMes = new Date(ano, mes, 0).getDate();
  const chartData = useMemo(() => {
    const dados: { dia: string; vendas: number; metaAcumulada: number; vendasAcumuladas: number }[] = [];
    let acumulado = 0;
    let metaAcum = 0;
    let diasUteisContados = 0;

    for (let d = 1; d <= diasNoMes; d++) {
      const dataStr = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const diaData = vendasDia.find(v => v.data === dataStr);
      const vendaDia = diaData ? Number(diaData.total) : 0;
      acumulado += vendaDia;

      const dow = new Date(ano, mes - 1, d).getDay();
      const isUtil = dow !== 0 && dow !== 6;
      if (isUtil) diasUteisContados++;
      metaAcum = metaDiaria * diasUteisContados;

      const isPassado = d <= diaAtual;
      dados.push({
        dia: `${d}/${mes}`,
        vendas: isPassado ? vendaDia : 0,
        metaAcumulada: metaAcum,
        vendasAcumuladas: isPassado ? acumulado : 0,
      });
    }
    return dados;
  }, [vendasDia, ano, mes, metaDiaria, diaAtual, diasNoMes]);

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
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
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground text-sm">Tendência e acompanhamento de metas</p>
        </div>
        <div className="flex items-center gap-3">
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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Target className="h-4 w-4" />
                {metaValor > 0 ? `Meta: ${formatCurrency(metaValor)}` : "Definir Meta"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Meta de Vendas — {MESES[mes - 1]} {ano}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Valor da Meta (R$)</label>
                  <Input
                    type="number"
                    placeholder="Ex: 50000"
                    value={novaMetaValor}
                    onChange={e => setNovaMetaValor(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => salvarMeta.mutate({ ano, mes, vendedorId: null, valorMeta: novaMetaValor })}
                  disabled={!novaMetaValor || salvarMeta.isPending}
                >
                  {salvarMeta.isPending ? "Salvando..." : "Salvar Meta"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendas no Mês</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalVendas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% da Meta</p>
                <p className="text-xl font-bold text-foreground">
                  {metaValor > 0 ? `${percMeta.toFixed(1)}%` : "—"}
                </p>
              </div>
            </div>
            {metaValor > 0 && (
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${percMeta >= 100 ? "bg-green-500" : percMeta >= 70 ? "bg-yellow-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(percMeta, 100)}%` }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos</p>
                <p className="text-xl font-bold text-foreground">{totalPedidos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
                <p className="text-xl font-bold text-foreground">
                  {totalPedidos > 0 ? formatCurrency(totalVendas / totalPedidos) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tendência Acumulada */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            Evolução Acumulada vs. Meta
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVendas ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="dia"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={4}
                />
                <YAxis
                  tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="vendasAcumuladas"
                  name="Vendas Acumuladas"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
                {metaValor > 0 && (
                  <Line
                    type="monotone"
                    dataKey="metaAcumulada"
                    name="Meta Proporcional"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="6 3"
                    dot={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Gráfico de Barras Diário */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-purple-500" />
            Vendas por Dia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVendas ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground">Carregando...</div>
          ) : vendasDia.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma venda registrada neste período</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData.filter(d => d.vendas > 0)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis
                  tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                {metaDiaria > 0 && (
                  <ReferenceLine y={metaDiaria} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "Meta/dia", fill: "#22c55e", fontSize: 11 }} />
                )}
                <Bar dataKey="vendas" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
