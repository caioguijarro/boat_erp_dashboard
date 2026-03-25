import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  Activity, CheckCircle, Copy, RefreshCw, XCircle,
  AlertCircle, Info, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  processado: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  erro: "bg-red-500/10 text-red-400 border-red-500/20",
  ignorado: "bg-muted/50 text-muted-foreground border-border",
};

const TIPO_COLORS: Record<string, string> = {
  produto: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  estoque: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  preco: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  pedido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  expedicao: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  nota_fiscal: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const PRODUCTION_DOMAIN = "https://boatdash-mr2nrqxd.manus.space";

const WEBHOOK_CONFIG = [
  {
    label: "URL para envio de produtos",
    path: "/api/webhook/produtos",
    campo: "URL para envio de produtos",
    descricao: "Recebe atualizações de cadastro de produtos",
    tipo: "produto",
  },
  {
    label: "URL de notificações do estoque",
    path: "/api/webhook/estoque",
    campo: "URL de notificações do estoque",
    descricao: "Recebe atualizações de saldo de estoque",
    tipo: "estoque",
  },
  {
    label: "URL para envio dos preços",
    path: "/api/webhook/precos",
    campo: "URL para envio dos preços",
    descricao: "Recebe atualizações de preços de produtos",
    tipo: "preco",
  },
  {
    label: "URL para envio de alteração na situação de pedidos",
    path: "/api/webhook/pedidos",
    campo: "URL para envio de alteração na situação de pedidos",
    descricao: "Recebe notificações de novos pedidos e mudanças de status",
    tipo: "pedido",
  },
  {
    label: "URL para envio do rastreio",
    path: "/api/webhook/rastreamento",
    campo: "URL para envio do rastreio",
    descricao: "Recebe atualizações de código de rastreio e expedição",
    tipo: "expedicao",
  },
  {
    label: "URL para envio da nota fiscal",
    path: "/api/webhook/notas-fiscais",
    campo: "URL para envio da nota fiscal",
    descricao: "Recebe eventos de emissão e status de notas fiscais",
    tipo: "nota_fiscal",
  },
];

export default function WebhookLogs() {
  const [selectedLog, setSelectedLog] = useState<number | null>(null);
  const [showGuia, setShowGuia] = useState(true);

  const baseUrl = window.location.hostname.includes("manus.space") || window.location.hostname.includes("manus.computer")
    ? PRODUCTION_DOMAIN
    : window.location.origin;

  const { data: logs, isLoading, refetch, isFetching } = trpc.webhooks.logs.useQuery(
    { limit: 100 },
    { refetchInterval: 15000 }
  );

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada para a área de transferência!");
  };

  const selectedLogData = logs?.find(l => l.id === selectedLog);

  // Calcular estatísticas dos logs
  const tiposRecebidos = new Set(logs?.map(l => l.tipo) ?? []);
  const totalProcessados = logs?.filter(l => l.status === "processado").length ?? 0;
  const totalErros = logs?.filter(l => l.status === "erro").length ?? 0;
  const ultimoEvento = logs?.[0]?.createdAt;

  // Verificar quais tipos de webhook já foram recebidos
  const tiposConfigurados = WEBHOOK_CONFIG.map(w => ({
    ...w,
    recebido: tiposRecebidos.has(w.tipo),
    ultimoLog: logs?.find(l => l.tipo === w.tipo),
  }));

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configuração e monitoramento da integração com o Olist ERP
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* Status Geral */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs text-muted-foreground">Total Recebidos</p>
              <p className="text-2xl font-bold text-foreground">{logs?.length ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs text-muted-foreground">Processados</p>
              <p className="text-2xl font-bold text-emerald-400">{totalProcessados}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs text-muted-foreground">Erros</p>
              <p className="text-2xl font-bold text-red-400">{totalErros}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-xs text-muted-foreground">Último Evento</p>
              <p className="text-sm font-medium text-foreground">
                {ultimoEvento ? formatDate(ultimoEvento) : "Nenhum ainda"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Guia de Configuração */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowGuia(!showGuia)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Guia de Configuração no Olist ERP
              </CardTitle>
              <div className="flex items-center gap-2">
                {tiposRecebidos.size > 0 ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {tiposRecebidos.size}/6 tipos ativos
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Aguardando configuração
                  </Badge>
                )}
                {showGuia ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>

          {showGuia && (
            <CardContent className="space-y-4">
              {/* Passo a passo */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-semibold text-primary mb-2">Como configurar no Olist ERP:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Acesse <span className="font-mono text-foreground">erp.olist.com</span></li>
                  <li>Vá em <span className="font-mono text-foreground">Integrações → API Manus → Notificações</span></li>
                  <li>Cole cada URL abaixo no campo correspondente</li>
                  <li>Salve as configurações</li>
                  <li>Faça um teste criando ou atualizando um pedido no ERP</li>
                </ol>
                <a
                  href="https://erp.olist.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir Olist ERP
                </a>
              </div>

              {/* URLs com status */}
              <div className="space-y-2">
                {tiposConfigurados.map(({ label, path, tipo, descricao, recebido, ultimoLog }) => {
                  const fullUrl = `${baseUrl}${path}`;
                  return (
                    <div
                      key={path}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        recebido
                          ? "bg-emerald-500/5 border-emerald-500/20"
                          : "bg-muted/20 border-border"
                      }`}
                    >
                      <div className="shrink-0">
                        {recebido ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-xs font-medium text-muted-foreground">{label}</p>
                          {recebido && (
                            <Badge variant="outline" className={`text-xs py-0 ${TIPO_COLORS[tipo] ?? ""}`}>
                              ativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-mono text-foreground truncate">{fullUrl}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {descricao}
                          {recebido && ultimoLog && (
                            <span className="ml-2 text-emerald-400/70">
                              · Último: {formatDate(ultimoLog.createdAt)}
                            </span>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyUrl(fullUrl)}
                        className="shrink-0 gap-1.5 h-8"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copiar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Logs Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Histórico de Eventos {logs?.length ? `(${logs.length})` : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-8 animate-pulse space-y-3">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-muted rounded" />)}
                  </div>
                ) : !logs?.length ? (
                  <div className="p-12 text-center space-y-3">
                    <Activity className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground text-sm font-medium">Nenhum webhook recebido ainda</p>
                    <p className="text-xs text-muted-foreground/60 max-w-xs mx-auto">
                      Configure as URLs acima no Olist ERP. Após salvar, crie ou atualize um pedido para testar.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-muted-foreground text-xs">Tipo</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Evento</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Status</TableHead>
                          <TableHead className="text-muted-foreground text-xs">Data/Hora</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map(log => (
                          <TableRow
                            key={log.id}
                            className={`border-border cursor-pointer transition-colors ${
                              selectedLog === log.id ? "bg-primary/10" : "hover:bg-muted/30"
                            }`}
                            onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                          >
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${TIPO_COLORS[log.tipo] ?? "bg-muted/50 text-muted-foreground"}`}
                              >
                                {log.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {log.evento ?? "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`text-xs ${STATUS_COLORS[log.status ?? ""] ?? ""}`}
                              >
                                {log.status === "processado" ? (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                ) : log.status === "erro" ? (
                                  <XCircle className="h-3 w-3 mr-1" />
                                ) : null}
                                {log.status ?? "-"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Log Detail */}
          <div>
            <Card className="bg-card border-border h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">Detalhes do Evento</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLogData ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Tipo</p>
                        <Badge
                          variant="outline"
                          className={`text-xs mt-1 ${TIPO_COLORS[selectedLogData.tipo] ?? ""}`}
                        >
                          {selectedLogData.tipo}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge
                          variant="outline"
                          className={`text-xs mt-1 ${STATUS_COLORS[selectedLogData.status ?? ""] ?? ""}`}
                        >
                          {selectedLogData.status}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Evento</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">{selectedLogData.evento ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Data/Hora</p>
                      <p className="text-sm text-foreground mt-0.5">{formatDate(selectedLogData.createdAt)}</p>
                    </div>
                    {selectedLogData.ip && (
                      <div>
                        <p className="text-xs text-muted-foreground">IP de Origem</p>
                        <p className="text-xs font-mono text-foreground mt-0.5">{selectedLogData.ip}</p>
                      </div>
                    )}
                    {selectedLogData.erroMsg && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Mensagem de Erro</p>
                        <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded font-mono break-all">
                          {selectedLogData.erroMsg}
                        </p>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Payload Recebido</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() => {
                            if (selectedLogData.payload) {
                              navigator.clipboard.writeText(
                                JSON.stringify(JSON.parse(selectedLogData.payload), null, 2)
                              );
                              toast.success("Payload copiado!");
                            }
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                      <pre className="text-xs text-muted-foreground bg-muted/30 p-2 rounded overflow-auto max-h-64 font-mono">
                        {selectedLogData.payload
                          ? (() => {
                              try {
                                return JSON.stringify(JSON.parse(selectedLogData.payload), null, 2);
                              } catch {
                                return selectedLogData.payload;
                              }
                            })()
                          : "Sem payload"}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Clique em um evento para ver os detalhes do payload</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
