import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Users, Target, DollarSign, CheckCircle, Clock, Edit2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

export default function Vendedores() {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [editVendedor, setEditVendedor] = useState<{ id: number; nome: string; comissaoPerc: string } | null>(null);
  const [editMetaVendedor, setEditMetaVendedor] = useState<{ id: number; nome: string } | null>(null);
  const [novaComissao, setNovaComissao] = useState("");
  const [novaMeta, setNovaMeta] = useState("");

  const dataInicio = useMemo(() => new Date(ano, mes - 1, 1), [ano, mes]);
  const dataFim = useMemo(() => new Date(ano, mes, 0, 23, 59, 59), [ano, mes]);

  const { data: vendasVendedor = [], isLoading } = trpc.analytics.vendasPorVendedor.useQuery(
    { dataInicio, dataFim },
    { staleTime: 5 * 60 * 1000 }
  );

  const { data: vendedoresList = [], refetch: refetchVendedores } = trpc.vendedores.listar.useQuery();
  const { data: comissoesPagas = [], refetch: refetchComissoes } = trpc.comissoes.listar.useQuery(
    { ano },
    { staleTime: 60 * 1000 }
  );
  const { data: metasList = [], refetch: refetchMetas } = trpc.metas.listar.useQuery(
    { ano, mes },
    { staleTime: 60 * 1000 }
  );

  const atualizarComissao = trpc.vendedores.atualizarComissao.useMutation({
    onSuccess: () => {
      refetchVendedores();
      setEditVendedor(null);
      toast("Comissão atualizada com sucesso!");
    },
  });

  const salvarMeta = trpc.metas.salvar.useMutation({
    onSuccess: () => {
      refetchMetas();
      setEditMetaVendedor(null);
      toast("Meta salva com sucesso!");
    },
  });

  const marcarPago = trpc.comissoes.marcarPago.useMutation({
    onSuccess: () => {
      refetchComissoes();
      toast("Comissão marcada como paga!");
    },
  });

  const registrarComissao = trpc.comissoes.registrar.useMutation({
    onSuccess: () => refetchComissoes(),
  });

  // Enriquecer dados com comissões pagas
  const dadosEnriquecidos = useMemo(() => {
    return vendasVendedor.map(v => {
      const vendedor = vendedoresList.find(vd => vd.nome === v.vendedorNome);
      const meta = metasList.find(m => m.vendedorId === vendedor?.id);
      const comissaoPaga = comissoesPagas.find(c => c.vendedorId === vendedor?.id && c.mes === mes && c.ano === ano);
      return {
        ...v,
        vendedorId: vendedor?.id,
        metaValor: meta ? Number(meta.valorMeta) : 0,
        comissaoPaga: comissaoPaga ?? null,
        comissaoPagaStatus: comissaoPaga?.pago === "S" ? "pago" : "pendente",
      };
    });
  }, [vendasVendedor, vendedoresList, metasList, comissoesPagas, mes, ano]);

  const totalVendas = dadosEnriquecidos.reduce((s, v) => s + v.totalVendas, 0);
  const totalComissoes = dadosEnriquecidos.reduce((s, v) => s + v.comissaoValor, 0);

  const navMes = (delta: number) => {
    let novoMes = mes + delta;
    let novoAno = ano;
    if (novoMes > 12) { novoMes = 1; novoAno++; }
    if (novoMes < 1) { novoMes = 12; novoAno--; }
    setMes(novoMes);
    setAno(novoAno);
  };

  const handleMarcarPago = (v: typeof dadosEnriquecidos[0]) => {
    if (!v.vendedorId) return;
    if (v.comissaoPaga) {
      marcarPago.mutate({ id: v.comissaoPaga.id });
    } else {
      registrarComissao.mutate({
        vendedorId: v.vendedorId,
        ano,
        mes,
        valorVendas: String(v.totalVendas),
        valorComissao: String(v.comissaoValor),
        pago: "S",
      }, {
        onSuccess: () => {
          refetchComissoes();
          toast("Comissão registrada como paga!");
        },
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendedores</h1>
          <p className="text-muted-foreground text-sm">Performance, metas e comissões por período</p>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
                <p className="text-xl font-bold text-foreground">{dadosEnriquecidos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Vendas</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalVendas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Comissões</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(totalComissoes)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Vendedores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Performance por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">Carregando...</div>
          ) : dadosEnriquecidos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma venda registrada neste período</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dadosEnriquecidos.map((v, i) => {
                const percMeta = v.metaValor > 0 ? (v.totalVendas / v.metaValor) * 100 : 0;
                const corBarra = percMeta >= 100 ? "bg-green-500" : percMeta >= 70 ? "bg-yellow-500" : "bg-red-500";

                return (
                  <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                    {/* Nome + badges */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-sm">
                          {v.vendedorNome.charAt(0)}
                        </div>
                        <span className="font-semibold text-foreground">{v.vendedorNome}</span>
                        <Badge variant={v.comissaoPagaStatus === "pago" ? "default" : "secondary"} className="text-xs">
                          {v.comissaoPagaStatus === "pago" ? "Comissão Paga" : "Comissão Pendente"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Editar comissão */}
                        <Dialog open={editVendedor?.id === v.vendedorId} onOpenChange={open => !open && setEditVendedor(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                if (v.vendedorId) setEditVendedor({ id: v.vendedorId, nome: v.vendedorNome, comissaoPerc: String(v.comissaoPerc) });
                                setNovaComissao(String(v.comissaoPerc));
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                              {v.comissaoPerc}% comissão
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Comissão — {editVendedor?.nome}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="text-sm font-medium">% de Comissão</label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  placeholder="Ex: 3.5"
                                  value={novaComissao}
                                  onChange={e => setNovaComissao(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={() => editVendedor && atualizarComissao.mutate({ id: editVendedor.id, comissaoPerc: novaComissao })}
                                disabled={atualizarComissao.isPending}
                              >
                                Salvar
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Editar meta */}
                        <Dialog open={editMetaVendedor?.id === v.vendedorId} onOpenChange={open => !open && setEditMetaVendedor(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              onClick={() => {
                                if (v.vendedorId) setEditMetaVendedor({ id: v.vendedorId, nome: v.vendedorNome });
                                setNovaMeta(String(v.metaValor || ""));
                              }}
                            >
                              <Target className="h-3 w-3" />
                              {v.metaValor > 0 ? `Meta: ${formatCurrency(v.metaValor)}` : "Definir Meta"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Meta — {editMetaVendedor?.nome} — {MESES[mes - 1]} {ano}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div>
                                <label className="text-sm font-medium">Valor da Meta (R$)</label>
                                <Input
                                  type="number"
                                  placeholder="Ex: 20000"
                                  value={novaMeta}
                                  onChange={e => setNovaMeta(e.target.value)}
                                  className="mt-1"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={() => editMetaVendedor && salvarMeta.mutate({ ano, mes, vendedorId: editMetaVendedor.id, valorMeta: novaMeta })}
                                disabled={salvarMeta.isPending}
                              >
                                Salvar Meta
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Vendas</p>
                        <p className="font-semibold text-foreground">{formatCurrency(v.totalVendas)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Pedidos</p>
                        <p className="font-semibold text-foreground">{v.quantidadePedidos}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Comissão</p>
                        <p className="font-semibold text-orange-500">{formatCurrency(v.comissaoValor)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">% Meta</p>
                        <p className={`font-semibold ${percMeta >= 100 ? "text-green-500" : percMeta >= 70 ? "text-yellow-500" : "text-red-500"}`}>
                          {v.metaValor > 0 ? `${percMeta.toFixed(1)}%` : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    {v.metaValor > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{formatCurrency(v.totalVendas)}</span>
                          <span>Meta: {formatCurrency(v.metaValor)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${corBarra}`}
                            style={{ width: `${Math.min(percMeta, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Ação de pagamento */}
                    {v.comissaoPagaStatus !== "pago" && v.comissaoValor > 0 && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-2 text-xs h-7"
                          onClick={() => handleMarcarPago(v)}
                          disabled={marcarPago.isPending || registrarComissao.isPending}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Marcar Comissão como Paga
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de Comissões Pagas */}
      {comissoesPagas.filter(c => c.pago === "S").length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Comissões Pagas em {ano}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs">
                    <th className="text-left pb-2">Vendedor</th>
                    <th className="text-left pb-2">Mês</th>
                    <th className="text-right pb-2">Vendas</th>
                    <th className="text-right pb-2">Comissão</th>
                    <th className="text-left pb-2">Pago em</th>
                  </tr>
                </thead>
                <tbody>
                  {comissoesPagas.filter(c => c.pago === "S").map(c => {
                    const vend = vendedoresList.find(v => v.id === c.vendedorId);
                    return (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 font-medium">{vend?.nome ?? `Vendedor ${c.vendedorId}`}</td>
                        <td className="py-2">{MESES[c.mes - 1]} {c.ano}</td>
                        <td className="py-2 text-right">{formatCurrency(Number(c.valorVendas))}</td>
                        <td className="py-2 text-right text-green-600 font-semibold">{formatCurrency(Number(c.valorComissao))}</td>
                        <td className="py-2 text-muted-foreground">
                          {c.dataPagamento ? new Date(c.dataPagamento).toLocaleDateString("pt-BR") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
