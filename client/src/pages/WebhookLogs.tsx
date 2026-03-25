import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Activity, CheckCircle, Copy, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(date: Date | string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  rastreio: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  nota_fiscal: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const WEBHOOK_URLS = [
  { label: "URL para envio de produtos", path: "/api/webhook/produtos" },
  { label: "URL de notificações do estoque", path: "/api/webhook/estoque" },
  { label: "URL para envio dos preços", path: "/api/webhook/precos" },
  { label: "URL para envio de alteração na situação de pedidos", path: "/api/webhook/pedidos" },
  { label: "URL para envio do rastreio", path: "/api/webhook/rastreamento" },
  { label: "URL para envio da nota fiscal", path: "/api/webhook/notas-fiscais" },
];

const PRODUCTION_DOMAIN = "https://boatdash-mr2nrqxd.manus.space";

export default function WebhookLogs() {
  const [selectedLog, setSelectedLog] = useState<number | null>(null);
  // Usa o domínio de produção se disponível, senão usa o origin atual
  const baseUrl = window.location.hostname.includes("manus.space") || window.location.hostname.includes("manus.computer")
    ? PRODUCTION_DOMAIN
    : window.location.origin;

  const { data: logs, isLoading, refetch, isFetching } = trpc.webhooks.logs.useQuery({ limit: 100 }, { refetchInterval: 30000 });

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada!");
  };

  const selectedLogData = logs?.find(l => l.id === selectedLog);

  return (
    <DashboardLayout>
      <div className="space-y-5 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Webhooks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Configuração e monitoramento dos eventos do Olist ERP</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Webhook URLs */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              URLs para configurar no Olist ERP
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Acesse <span className="font-mono text-primary">erp.olist.com → Integrações → API Manus → Notificações</span> e cole as URLs abaixo em cada campo correspondente.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {WEBHOOK_URLS.map(({ label, path }) => {
              const fullUrl = `${baseUrl}${path}`;
              return (
                <div key={path} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className="text-sm font-mono text-foreground truncate">{fullUrl}</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => copyUrl(fullUrl)} className="shrink-0 gap-1.5 h-8">
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Logs Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">
                  Logs de Eventos {logs?.length ? `(${logs.length})` : ""}
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
                    <p className="text-muted-foreground text-sm">Nenhum webhook recebido ainda</p>
                    <p className="text-xs text-muted-foreground/60">Configure as URLs acima no Olist ERP para começar a receber eventos</p>
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
                            className={`border-border cursor-pointer transition-colors ${selectedLog === log.id ? "bg-primary/10" : "hover:bg-muted/30"}`}
                            onClick={() => setSelectedLog(selectedLog === log.id ? null : log.id)}
                          >
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${TIPO_COLORS[log.tipo] ?? "bg-muted/50 text-muted-foreground"}`}>
                                {log.tipo}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                              {log.evento ?? "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[log.status ?? ""] ?? ""}`}>
                                {log.status === "processado" ? <CheckCircle className="h-3 w-3 mr-1" /> : log.status === "erro" ? <XCircle className="h-3 w-3 mr-1" /> : null}
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
                <CardTitle className="text-base font-semibold text-foreground">Detalhes</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedLogData ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Tipo</p>
                      <p className="text-sm font-medium text-foreground">{selectedLogData.tipo}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Evento</p>
                      <p className="text-sm font-medium text-foreground">{selectedLogData.evento ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Status</p>
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[selectedLogData.status ?? ""] ?? ""}`}>
                        {selectedLogData.status}
                      </Badge>
                    </div>
                    {selectedLogData.erroMsg && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Erro</p>
                        <p className="text-xs text-red-400 bg-red-500/10 p-2 rounded font-mono">{selectedLogData.erroMsg}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payload</p>
                      <pre className="text-xs text-muted-foreground bg-muted/30 p-2 rounded overflow-auto max-h-48 font-mono">
                        {selectedLogData.payload
                          ? JSON.stringify(JSON.parse(selectedLogData.payload), null, 2)
                          : "Sem payload"}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Clique em um log para ver os detalhes</p>
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
