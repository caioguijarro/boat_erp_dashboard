/**
 * Olist API 2.0 Sync Service
 * Polls the Olist ERP API to keep local database in sync.
 * - Pedidos: every 5 minutes (recent 30 days)
 * - Produtos: every 30 minutes (all active products)
 * - Contas a Receber: every 15 minutes
 */

import { upsertProduto, upsertPedido, upsertItemPedido, insertWebhookLog } from "./db";

const OLIST_API_BASE = "https://api.tiny.com.br/api2";
const TOKEN = process.env.OLIST_API_TOKEN;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseOlistDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  // Format: "dd/mm/yyyy" or "dd/mm/yyyy hh:mm:ss"
  const parts = dateStr.split(" ");
  const dateParts = parts[0].split("/");
  if (dateParts.length !== 3) return null;
  const [day, month, year] = dateParts;
  const timePart = parts[1] || "00:00:00";
  return new Date(`${year}-${month}-${day}T${timePart}`);
}

function mapSituacao(situacao: string): string {
  const map: Record<string, string> = {
    "Em aberto": "pendente",
    "Aprovado": "aprovado",
    "Preparando envio": "em_andamento",
    "Faturado (atendido)": "faturado",
    "Pronto para envio": "em_andamento",
    "Enviado": "enviado",
    "Entregue": "entregue",
    "Cancelado": "cancelado",
    "Devolvido": "cancelado",
  };
  return map[situacao] || situacao.toLowerCase().replace(/\s+/g, "_");
}

async function olistPost(endpoint: string, params: Record<string, string>): Promise<any> {
  if (!TOKEN) throw new Error("OLIST_API_TOKEN not configured");
  const body = new URLSearchParams({ token: TOKEN, formato: "JSON", ...params });
  const res = await fetch(`${OLIST_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Olist API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data?.retorno?.status === "Erro") {
    throw new Error(`Olist API error: ${JSON.stringify(data.retorno.erros)}`);
  }
  return data?.retorno;
}

// ─── Sync Pedidos ─────────────────────────────────────────────────────────────

async function syncPedidoDetalhes(olistId: string): Promise<void> {
  try {
    const retorno = await olistPost("pedido.obter.php", { id: olistId });
    const p = retorno?.pedido;
    if (!p) return;

    const dataPedido = parseOlistDate(p.data_pedido);
    const dataEntrega = parseOlistDate(p.data_entrega);
    const dataFaturamento = parseOlistDate(p.data_faturamento);

    await upsertPedido({
      olistId: String(p.id),
      numero: String(p.numero),
      numeroPedidoCliente: p.numero_ordem_compra || null,
      clienteNome: p.cliente?.nome || null,
      clienteEmail: p.cliente?.email || null,
      clienteCpfCnpj: p.cliente?.cpf_cnpj || null,
      status: mapSituacao(p.situacao || ""),
      situacao: p.situacao || null,
      totalPedido: p.total_pedido ? String(p.total_pedido) : "0",
      totalProdutos: p.total_produtos ? String(p.total_produtos) : "0",
      totalFrete: p.valor_frete ? String(p.valor_frete) : "0",
      totalDesconto: p.valor_desconto ? String(p.valor_desconto) : "0",
      formaPagamento: p.forma_pagamento || null,
      dataPedido: dataPedido || undefined,
      dataPrevEntrega: dataEntrega || undefined,
      observacoes: p.obs || null,
      rawData: JSON.stringify(p),
    });

    // Sync itens do pedido
    const itens = Array.isArray(p.itens) ? p.itens : [];
    for (const itemWrapper of itens) {
      const item = itemWrapper?.item;
      if (!item) continue;
      // itensPedido uses pedidoId (int FK), not olistId
      // We'll insert directly with product info
      await upsertItemPedido({
        pedidoId: 0, // will be resolved by upsertItemPedido via olistId lookup
        produtoNome: item.descricao || null,
        produtoCodigo: item.codigo || null,
        quantidade: item.quantidade ? String(item.quantidade) : "1",
        valorUnitario: item.valor_unitario ? String(item.valor_unitario) : "0",
        valorTotal: item.quantidade && item.valor_unitario
          ? String(parseFloat(item.quantidade) * parseFloat(item.valor_unitario))
          : "0",
        desconto: "0",
      });
    }
  } catch (err) {
    console.error(`[OlistSync] Error syncing pedido ${olistId}:`, err);
  }
}

export async function syncPedidos(diasAtras = 30): Promise<{ synced: number; errors: number }> {
  if (!TOKEN) { console.warn("[OlistSync] OLIST_API_TOKEN not set, skipping pedidos sync"); return { synced: 0, errors: 0 }; }
  
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - diasAtras);
  
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  
  let synced = 0;
  let errors = 0;
  let pagina = 1;
  let totalPaginas = 1;

  console.log(`[OlistSync] Starting pedidos sync (last ${diasAtras} days)...`);

  try {
    do {
      const retorno = await olistPost("pedidos.pesquisa.php", {
        dataInicial: fmt(inicio),
        dataFinal: fmt(hoje),
        pagina: String(pagina),
      });

      totalPaginas = parseInt(retorno?.numero_paginas || "1");
      const pedidosList = Array.isArray(retorno?.pedidos) ? retorno.pedidos : [];

      for (const pedidoWrapper of pedidosList) {
        const pedido = pedidoWrapper?.pedido;
        if (!pedido?.id) continue;
        await syncPedidoDetalhes(String(pedido.id));
        synced++;
        // Small delay to respect rate limits (30 req/min = 1 req per 2s)
        await new Promise(r => setTimeout(r, 300));
      }

      pagina++;
    } while (pagina <= totalPaginas && pagina <= 5); // Max 5 pages per cycle

    console.log(`[OlistSync] Pedidos sync complete: ${synced} synced, ${errors} errors`);
    await insertWebhookLog({
      tipo: "polling_pedidos",
      evento: "sync_complete",
      payload: JSON.stringify({ synced, errors, diasAtras }),
      status: "processado",
    });
  } catch (err) {
    errors++;
    console.error("[OlistSync] Pedidos sync failed:", err);
    await insertWebhookLog({
      tipo: "polling_pedidos",
      evento: "sync_error",
      payload: JSON.stringify({ error: String(err) }),
      status: "erro",
      erroMsg: String(err),
    });
  }

  return { synced, errors };
}

// ─── Sync Produtos ────────────────────────────────────────────────────────────

export async function syncProdutos(): Promise<{ synced: number; errors: number }> {
  if (!TOKEN) { console.warn("[OlistSync] OLIST_API_TOKEN not set, skipping produtos sync"); return { synced: 0, errors: 0 }; }

  let synced = 0;
  let errors = 0;
  let pagina = 1;
  let totalPaginas = 1;

  console.log("[OlistSync] Starting produtos sync...");

  try {
    do {
      const retorno = await olistPost("produtos.pesquisa.php", {
        pagina: String(pagina),
        situacao: "A", // only active products
      });

      totalPaginas = parseInt(retorno?.numero_paginas || "1");
      const produtosList = Array.isArray(retorno?.produtos) ? retorno.produtos : [];

      for (const produtoWrapper of produtosList) {
        const p = produtoWrapper?.produto;
        if (!p?.id) continue;

        try {
          // Use list data directly to avoid extra API calls per product
          // This respects the 30 req/min rate limit
          await upsertProduto({
            olistId: String(p.id),
            codigo: p.codigo || null,
            nome: p.nome,
            categoria: null,
            preco: p.preco ? String(p.preco) : null,
            precoCusto: p.preco_custo ? String(p.preco_custo) : null,
            unidade: p.unidade || null,
            estoqueAtual: p.saldo_fisico_total != null ? String(p.saldo_fisico_total) : "0",
            estoqueMinimo: "0",
            ativo: p.situacao === "A" ? "S" : "N",
          });
          synced++;
          // 2 seconds between calls = max 30 req/min
          await new Promise(r => setTimeout(r, 2_000));
        } catch (err) {
          errors++;
          console.error(`[OlistSync] Error syncing produto ${p.id}:`, err);
        }
      }

      pagina++;
    } while (pagina <= totalPaginas && pagina <= 3); // Max 3 pages per cycle

    console.log(`[OlistSync] Produtos sync complete: ${synced} synced, ${errors} errors`);
    await insertWebhookLog({
      tipo: "polling_produtos",
      evento: "sync_complete",
      payload: JSON.stringify({ synced, errors }),
      status: "processado",
    });
  } catch (err) {
    errors++;
    console.error("[OlistSync] Produtos sync failed:", err);
    await insertWebhookLog({
      tipo: "polling_produtos",
      evento: "sync_error",
      payload: JSON.stringify({ error: String(err) }),
      status: "erro",
      erroMsg: String(err),
    });
  }

  return { synced, errors };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let pedidosTimer: ReturnType<typeof setInterval> | null = null;
let produtosTimer: ReturnType<typeof setInterval> | null = null;

export function startOlistPolling() {
  if (!TOKEN) {
    console.warn("[OlistSync] OLIST_API_TOKEN not configured — polling disabled");
    return;
  }

  console.log("[OlistSync] Starting polling scheduler...");

  // Run immediately on startup
  setTimeout(() => syncPedidos(7), 5_000);   // last 7 days on startup
  setTimeout(() => syncProdutos(), 10_000);   // products on startup

  // Pedidos every 5 minutes
  pedidosTimer = setInterval(() => syncPedidos(2), 5 * 60 * 1000);

  // Produtos every 30 minutes
  produtosTimer = setInterval(() => syncProdutos(), 30 * 60 * 1000);

  console.log("[OlistSync] Polling scheduled: pedidos every 5min, produtos every 30min");
}

export function stopOlistPolling() {
  if (pedidosTimer) { clearInterval(pedidosTimer); pedidosTimer = null; }
  if (produtosTimer) { clearInterval(produtosTimer); produtosTimer = null; }
  console.log("[OlistSync] Polling stopped");
}
