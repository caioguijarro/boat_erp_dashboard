import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";
import { TrendingUp, Target, DollarSign, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const PERIODOS = [
  { label: "7 dias", dias: 7 },
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
] as const;

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
  const [modo, setModo] = useState<"periodo" | "mes">("periodo");
  const [diasSelecionados, setDiasSelecionados] = useState(30);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [novaMetaValor, setNovaMetaValor] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  // Datas para consulta
  const { dataInicio, dataFim } = useMemo(() => {
    if (modo === "mes") {
      return {
        dataInicio: new Date(ano, mes - 1, 1),
        dataFim: new Date(ano, mes, 0, 23, 59, 59),
      };
    }
    const fim = new Date();
    fim.setHours(23, 59, 59, 999);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - diasSelecionados);
    inicio.setHours(0, 0, 0, 0);
    return { dataInicio: inicio, dataFim: fim };
  }, [modo, ano, mes, diasSelecionados]);

  const { data: vendasDia = [], isLoading: loadingVendas } = trpc.analytics.vendasPorDia.useQuery(
    { dataInicio, dataFim },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: metasList = [], refetch: refetchMetas } = trpc.metas.listar.useQuery(
    { ano, mes },
    { staleTime: 60 * 1000, enabled: modo === "mes" }
  );

  const salvarMeta = trpc.metas.salvar.useMutation({
    onSuccess: () => {
      refetchMetas();
      setDialogOpen(false);
      setNovaMetaValor("");
    },
  });

  const metaGeral = metasList.find(m => !m.vendedorId);
  const metaValor = metaGeral ? Number(metaGeral.valorMeta) : 0;

  const totalVendas = vendasDia.reduce((sum, d) => sum + Number(d.total), 0);
  const totalPedidos = vendasDia.reduce((sum, d) => sum + Number(d.quantidade), 0);
  const percMeta = metaValor > 0 ? (totalVendas / metaValor) * 100 : 0;

  // Para o modo mês: acumulado vs meta diária
  const diasUteis = getDiasUteis(ano, mes);
  const diaAtual = getDiaAtual(ano, mes);
  const metaDiaria = diasUteis > 0 ? metaValor / diasUteis : 0;

  // Dados do gráfico
  const chartData = useMemo(() => {
    if (modo === "mes") {
      const diasNoMes = new Date(ano, mes, 0).getDate();
      const dados: { label: string; vendas: number; metaAcumulada: number; vendasAcumuladas: number }[] = [];
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
          label: `${d}/${mes}`,
          vendas: isPassado ? vendaDia : 0,
          metaAcumulada: metaAcum,
          vendasAcumuladas: isPassado ? acumulado : 0,
        });
      }
      return dados;
    }

    // Modo período: mostrar cada dia com vendas
    return vendasDia.map(d => {
      const [, mm, dd] = d.data.split("-");
      return {
        label: `${dd}/${mm}`,
        vendas: Number(d.total),
        metaAcumulada: 0,
        vendasAcumuladas: 0,
        quantidade: Number(d.quantidade),
      };
    });
  }, [vendasDia, modo, ano, mes, metaDiaria, diaAtual]);

  // Média diária para o período
  const mediaDiaria = vendasDia.length > 0 ? totalVendas / vendasDia.length : 0;

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
            {p.name}: {p.dataKey === "quantidade" ? p.value : formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendas</h1>
          <p className="text-muted-foreground text-sm">Tendência e acompanhamento de metas</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle modo */}
          <div className="flex rounded-lg border bg-muted p-1 gap-1">
            <Button
              variant={modo === "periodo" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setModo("periodo")}
            >
              Período
            </Button>
            <Button
              variant={modo === "mes" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setModo("mes")}
            >
              Mês
            </Button>
          </div>

          {/* Seletor período */}
          {modo === "periodo" && (
            <div className="flex rounded-lg border bg-muted p-1 gap-1">
              {PERIODOS.map(p => (
                <Button
                  key={p.dias}
                  variant={diasSelecionados === p.dias ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDiasSelecionados(p.dias)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          )}

          {/* Seletor mês */}
          {modo === "mes" && (
            <div className="flex items-center gap-1 bg-muted rounded-lg border p-1">
              <Button variant="ghost" size="sm" onClick={() => navMes(-1)} className="h-7 w-7 p-0">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-2 min-w-[90px] text-center">
                {MESES[mes - 1]} {ano}
              </span>
              <Button variant="ghost" size="sm" onClick={() => navMes(1)} className="h-7 w-7 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Meta (só no modo mês) */}
          {modo === "mes" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9">
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
          )}
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
                <p className="text-xs text-muted-foreground">
                  {modo === "mes" ? `Vendas em ${MESES[mes - 1]}` : `Últimos ${diasSelecionados} dias`}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {loadingVendas ? "..." : formatCurrency(totalVendas)}
                </p>
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
                <p className="text-xs text-muted-foreground">
                  {modo === "mes" && metaValor > 0 ? "% da Meta" : "Média/dia"}
                </p>
                <p className="text-xl font-bold text-foreground">
                  {loadingVendas ? "..." :
                    modo === "mes" && metaValor > 0
                      ? `${percMeta.toFixed(1)}%`
                      : formatCurrency(mediaDiaria)
                  }
                </p>
              </div>
            </div>
            {modo === "mes" && metaValor > 0 && !loadingVendas && (
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
                <p className="text-xl font-bold text-foreground">
                  {loadingVendas ? "..." : totalPedidos}
                </p>
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
                  {loadingVendas ? "..." :
                    totalPedidos > 0 ? formatCurrency(totalVendas / totalPedidos) : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            {modo === "mes" ? "Evolução Acumulada vs. Meta" : "Vendas por Dia"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingVendas ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Carregando...
            </div>
          ) : chartData.length === 0 || totalVendas === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <ShoppingCart className="h-10 w-10 opacity-20" />
              <p className="text-sm">Nenhuma venda registrada neste período</p>
              <p className="text-xs opacity-60">
                {modo === "mes"
                  ? "Tente navegar para um mês anterior"
                  : "Tente selecionar um período maior"}
              </p>
            </div>
          ) : modo === "mes" ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
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
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval={Math.floor(chartData.length / 10)}
                />
                <YAxis
                  tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="vendas" name="Vendas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de dias com mais vendas */}
      {!loadingVendas && vendasDia.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-500" />
              Melhores Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...vendasDia]
                .sort((a, b) => Number(b.total) - Number(a.total))
                .slice(0, 8)
                .map(d => {
                  const [yr, mm, dd] = d.data.split("-");
                  const pct = totalVendas > 0 ? (Number(d.total) / totalVendas) * 100 : 0;
                  return (
                    <div key={d.data} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-16 shrink-0">
                        {dd}/{mm}/{yr}
                      </span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-28 text-right shrink-0">
                        {formatCurrency(Number(d.total))}
                      </span>
                      <Badge variant="secondary" className="text-xs w-14 justify-center shrink-0">
                        {Number(d.quantidade)} ped.
                      </Badge>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
