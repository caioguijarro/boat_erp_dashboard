import { useState, useMemo } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircle, StickyNote, Pencil, CalendarClock, ShoppingCart, DollarSign,
  Repeat, ListTodo, Clock, Phone,
} from "lucide-react";

type CrmCliente = inferRouterOutputs<AppRouter>["crm"]["listar"][number];

// ─── Configuração de buckets e status ────────────────────────────────────────

const BUCKETS: { key: string; label: string; sub: string; readOnly?: boolean; accent: string }[] = [
  { key: "ativos", label: "Ativos", sub: "menos de 30 dias", readOnly: true, accent: "text-green-500" },
  { key: "d30_59", label: "30–59 dias", sub: "atenção", accent: "text-lime-500" },
  { key: "d60_89", label: "60–89 dias", sub: "reengajar", accent: "text-amber-500" },
  { key: "d90_119", label: "90–119 dias", sub: "em risco", accent: "text-orange-500" },
  { key: "d120_179", label: "120–179 dias", sub: "frios", accent: "text-red-400" },
  { key: "d180_plus", label: "180+ dias", sub: "inativos", accent: "text-red-500" },
];

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  a_contatar: { label: "A contatar", cls: "bg-muted text-muted-foreground border-border" },
  contatado: { label: "Contatado", cls: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  respondeu: { label: "Respondeu", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  venda_fechada: { label: "Venda fechada", cls: "bg-green-500/10 text-green-600 border-green-500/20" },
  sem_interesse: { label: "Sem interesse", cls: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const STATUS_OPTIONS = Object.keys(STATUS_CONFIG);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

function primeiroNome(nome: string) {
  return (nome || "").trim().split(/\s+/)[0] || nome;
}

/** Monta o link wa.me com telefone normalizado (+55) e mensagem pré-preenchida. */
function waLink(cliente: CrmCliente): string | null {
  const raw = cliente.whatsapp || cliente.telefone || "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const phone = digits.startsWith("55") ? digits : `55${digits}`;
  const ultima = cliente.ultimaCompra ? new Date(cliente.ultimaCompra).toLocaleDateString("pt-BR") : null;
  const msg = ultima
    ? `Olá ${primeiroNome(cliente.clienteNome)}! Aqui é da Boat Beer Company 🍻. Vi que sua última compra com a gente foi em ${ultima} e queria saber se está tudo certo — posso te ajudar com um novo pedido?`
    : `Olá ${primeiroNome(cliente.clienteNome)}! Aqui é da Boat Beer Company 🍻. Posso te ajudar com um novo pedido?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function Crm() {
  const { data: clientes = [], isLoading, refetch: refetchClientes } = trpc.crm.listar.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });
  const { data: tarefas = [], refetch: refetchTarefas } = trpc.crm.tarefas.useQuery(undefined, {
    staleTime: 2 * 60 * 1000,
  });

  const refetchAll = () => {
    refetchClientes();
    refetchTarefas();
  };

  const porBucket = useMemo(() => {
    const map: Record<string, CrmCliente[]> = {};
    for (const b of BUCKETS) map[b.key] = [];
    for (const c of clientes) {
      (map[c.bucket] ??= []).push(c);
    }
    // Dentro de cada coluna, prioriza maior LTV.
    for (const k of Object.keys(map)) map[k].sort((a, b) => b.ltv - a.ltv);
    return map;
  }, [clientes]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Repeat className="h-6 w-6 text-primary" /> CRM de Recompra
          </h1>
          <p className="text-muted-foreground text-sm">
            Clientes organizados por recência de compra — gerencie status, notas e follow-ups.
          </p>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList>
          <TabsTrigger value="kanban" className="gap-2">
            <Repeat className="h-4 w-4" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-2">
            <ListTodo className="h-4 w-4" /> Minhas tarefas
            {tarefas.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/15 text-primary text-xs px-1.5 py-0.5">{tarefas.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Kanban ── */}
        <TabsContent value="kanban" className="mt-4">
          {isLoading ? (
            <div className="py-16 text-center text-muted-foreground">Carregando clientes...</div>
          ) : clientes.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              Nenhum cliente encontrado. Os clientes aparecem automaticamente conforme os pedidos são sincronizados.
            </div>
          ) : (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {BUCKETS.map((b) => {
                  const lista = porBucket[b.key] ?? [];
                  return (
                    <div key={b.key} className="w-[300px] shrink-0">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <div>
                          <h3 className={`text-sm font-semibold ${b.accent}`}>{b.label}</h3>
                          <p className="text-xs text-muted-foreground">
                            {b.sub}{b.readOnly ? " · somente leitura" : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">{lista.length}</Badge>
                      </div>
                      <div className="space-y-3">
                        {lista.length === 0 ? (
                          <div className="text-xs text-muted-foreground/60 text-center py-6 border border-dashed border-border rounded-lg">
                            Vazio
                          </div>
                        ) : (
                          lista.map((c) => (
                            <ClienteCard
                              key={c.clienteKey}
                              cliente={c}
                              readOnly={b.readOnly}
                              onChanged={refetchAll}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Minhas tarefas ── */}
        <TabsContent value="tarefas" className="mt-4">
          {tarefas.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ListTodo className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhum follow-up vencido ou para hoje. 🎉</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-3xl">
              <p className="text-sm text-muted-foreground">
                {tarefas.length} follow-up(s) vencidos/de hoje — ordenados pelos maiores LTV.
              </p>
              {tarefas.map((c) => (
                <ClienteCard key={c.clienteKey} cliente={c} onChanged={refetchAll} showFollowupDate />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Card do cliente ──────────────────────────────────────────────────────────

function ClienteCard({
  cliente,
  readOnly,
  onChanged,
  showFollowupDate,
}: {
  cliente: CrmCliente;
  readOnly?: boolean;
  onChanged: () => void;
  showFollowupDate?: boolean;
}) {
  const [notaOpen, setNotaOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [followOpen, setFollowOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [followDate, setFollowDate] = useState("");
  const [form, setForm] = useState({
    telefone: cliente.telefone ?? "",
    whatsapp: cliente.whatsapp ?? "",
    email: cliente.email ?? "",
  });

  const statusCfg = STATUS_CONFIG[cliente.status] ?? STATUS_CONFIG.a_contatar;
  const wa = waLink(cliente);

  const atualizarStatus = trpc.crm.atualizarStatus.useMutation({
    onSuccess: () => { toast("Status atualizado"); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const adicionarNota = trpc.crm.adicionarNota.useMutation({
    onSuccess: () => { toast("Nota adicionada"); setNota(""); setNotaOpen(false); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const agendarFollowup = trpc.crm.agendarFollowup.useMutation({
    onSuccess: () => { toast("Follow-up agendado"); setFollowOpen(false); onChanged(); },
    onError: (e) => toast.error(e.message),
  });
  const editarContato = trpc.crm.editarContato.useMutation({
    onSuccess: (res) => {
      const olistMsg =
        res.olist === "updated" ? "atualizado no Olist" :
        res.olist === "created" ? "criado no Olist" :
        res.olist === "skipped" ? "salvo localmente (write-back desativado)" :
        "salvo localmente (falha no Olist)";
      toast(`Contato ${olistMsg}`);
      setEditOpen(false);
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });
  const enriquecerTelefone = trpc.crm.enriquecerTelefone.useMutation({
    onSuccess: (res) => {
      toast(res.telefone ? `Telefone encontrado: ${res.telefone}` : "Telefone não encontrado no Tiny");
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="p-3 space-y-2.5">
        {/* Cabeçalho: nome + dias */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{cliente.clienteNome}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {cliente.diasDesdeUltima} dias sem comprar
            </p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${statusCfg.cls}`}>
            {statusCfg.label}
          </Badge>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-3 gap-2 text-center bg-muted/40 rounded-md py-1.5">
          <div>
            <p className="text-[10px] text-muted-foreground">LTV</p>
            <p className="text-xs font-semibold flex items-center justify-center gap-0.5">
              <DollarSign className="h-3 w-3 text-green-500" />{formatCurrency(cliente.ltv)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Ticket</p>
            <p className="text-xs font-semibold">{formatCurrency(cliente.ticketMedio)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Pedidos</p>
            <p className="text-xs font-semibold flex items-center justify-center gap-0.5">
              <ShoppingCart className="h-3 w-3 text-blue-500" />{cliente.totalPedidos}
            </p>
          </div>
        </div>

        {showFollowupDate && cliente.proximoFollowup && (
          <p className="text-xs text-amber-500 flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Follow-up: {new Date(cliente.proximoFollowup).toLocaleDateString("pt-BR")}
          </p>
        )}

        {/* Status selector (oculto em colunas somente-leitura de recência, mas status é sempre editável) */}
        <Select
          value={cliente.status}
          onValueChange={(v) =>
            atualizarStatus.mutate({ clienteKey: cliente.clienteKey, clienteCpfCnpj: cliente.clienteCpfCnpj, status: v as any })
          }
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {/* WhatsApp */}
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" className="w-full h-8 bg-green-600 hover:bg-green-700 text-white gap-1">
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </Button>
            </a>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 gap-1"
              disabled={enriquecerTelefone.isPending}
              onClick={() =>
                enriquecerTelefone.mutate({ clienteKey: cliente.clienteKey, clienteCpfCnpj: cliente.clienteCpfCnpj, nome: cliente.clienteNome })
              }
            >
              <Phone className="h-3.5 w-3.5" /> Buscar tel.
            </Button>
          )}

          {/* Nota */}
          <Dialog open={notaOpen} onOpenChange={setNotaOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Notas">
                <StickyNote className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Notas — {cliente.clienteNome}</DialogTitle>
              </DialogHeader>
              {cliente.notas && (
                <div className="max-h-40 overflow-y-auto text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-3 text-muted-foreground">
                  {cliente.notas}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor={`nota-${cliente.clienteKey}`}>Nova nota</Label>
                <Textarea
                  id={`nota-${cliente.clienteKey}`}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  placeholder="Ex.: Cliente pediu para ligar na próxima semana..."
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={() => adicionarNota.mutate({ clienteKey: cliente.clienteKey, clienteCpfCnpj: cliente.clienteCpfCnpj, nota })}
                  disabled={!nota.trim() || adicionarNota.isPending}
                >
                  Salvar nota
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Follow-up */}
          <Popover open={followOpen} onOpenChange={setFollowOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Agendar follow-up">
                <CalendarClock className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-60 space-y-2">
              <Label htmlFor={`follow-${cliente.clienteKey}`} className="text-xs">Próximo follow-up</Label>
              <Input
                id={`follow-${cliente.clienteKey}`}
                type="date"
                value={followDate}
                onChange={(e) => setFollowDate(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full"
                disabled={!followDate || agendarFollowup.isPending}
                onClick={() =>
                  agendarFollowup.mutate({
                    clienteKey: cliente.clienteKey,
                    clienteCpfCnpj: cliente.clienteCpfCnpj,
                    data: new Date(`${followDate}T12:00:00`),
                  })
                }
              >
                Agendar
              </Button>
            </PopoverContent>
          </Popover>

          {/* Editar contato */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Editar contato">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar contato — {cliente.clienteNome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor={`tel-${cliente.clienteKey}`}>Telefone</Label>
                  <Input
                    id={`tel-${cliente.clienteKey}`}
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                    placeholder="(13) 99999-9999"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`wa-${cliente.clienteKey}`}>WhatsApp</Label>
                  <Input
                    id={`wa-${cliente.clienteKey}`}
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    placeholder="(13) 99999-9999"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`email-${cliente.clienteKey}`}>E-mail</Label>
                  <Input
                    id={`email-${cliente.clienteKey}`}
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="cliente@email.com"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A alteração é gravada localmente na hora. O envio ao Olist depende de
                  <code className="mx-1">OLIST_WRITEBACK_ENABLED</code>.
                </p>
              </div>
              <DialogFooter className="gap-2">
                <DialogClose asChild>
                  <Button variant="ghost">Cancelar</Button>
                </DialogClose>
                <Button
                  disabled={editarContato.isPending}
                  onClick={() =>
                    editarContato.mutate({
                      clienteKey: cliente.clienteKey,
                      clienteCpfCnpj: cliente.clienteCpfCnpj,
                      nome: cliente.clienteNome,
                      telefone: form.telefone || undefined,
                      whatsapp: form.whatsapp || undefined,
                      email: form.email || undefined,
                    })
                  }
                >
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
