import { Router } from "express";
import {
  upsertProduto, upsertPedido, upsertItemPedido,
  upsertNotaFiscal, upsertExpedicao,
  insertWebhookLog, getProdutosBaixoEstoque,
} from "./db";
import { notifyOwner } from "./_core/notification";

export const webhookRouter = Router();

// Middleware para logar todas as requisições de webhook
webhookRouter.use((req, _res, next) => {
  console.log(`[Webhook] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Converte data no formato dd/mm/YYYY ou ISO para objeto Date.
 * O Olist envia datas no formato "dd/mm/YYYY".
 */
function parseOlistDate(dateStr: string | undefined | null): Date | undefined {
  if (!dateStr) return undefined;
  // Formato dd/mm/YYYY
  const brMatch = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }
  // Tentar ISO
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Mapeia o codigoSituacao do Olist para o status interno do sistema.
 */
function mapSituacaoPedido(codigoSituacao: string | undefined): string {
  const map: Record<string, string> = {
    "aberto": "pendente",
    "aprovado": "aprovado",
    "preparando_envio": "em_separacao",
    "faturado": "faturado",
    "pronto_envio": "pronto_envio",
    "enviado": "enviado",
    "entregue": "entregue",
    "cancelado": "cancelado",
    "nao_entregue": "nao_entregue",
    "devolvido": "devolvido",
  };
  return map[codigoSituacao ?? ""] ?? codigoSituacao ?? "pendente";
}

// ─── Pedidos (Notificações de vendas) ────────────────────────────────────────
// Payload Olist: { versao, cnpj, tipo: "inclusao_pedido"|"atualizacao_pedido", dados: { id, numero, data, codigoSituacao, descricaoSituacao, idContato, idNotaFiscal, nomeEcommerce, formaEnvio, cliente } }
webhookRouter.post("/pedidos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    // O Olist envia os dados dentro de "dados"
    const dados = payload?.dados ?? payload?.pedido ?? payload;

    if (!dados || (!dados.id && !dados.numero)) {
      await insertWebhookLog({ tipo: "pedido", evento: "recebido", payload: JSON.stringify(payload), status: "ignorado", ip });
      return res.json({ ok: true, msg: "ignorado - sem dados válidos" });
    }

    const tipo = payload?.tipo ?? "atualizacao_pedido";
    const status = mapSituacaoPedido(dados.codigoSituacao);
    const dataPedido = parseOlistDate(dados.data) ?? new Date();

    await upsertPedido({
      olistId: String(dados.id ?? dados.numero ?? ""),
      numero: dados.numero,
      numeroPedidoCliente: dados.numeroPedidoCliente ?? null,
      clienteNome: dados.cliente?.nome ?? dados.nomeCliente ?? null,
      clienteEmail: dados.cliente?.email ?? null,
      clienteCpfCnpj: dados.cliente?.cpfCnpj ?? null,
      status: status,
      situacao: dados.codigoSituacao ?? null,
      totalProdutos: null,
      totalDesconto: 0,
      totalFrete: 0,
      totalPedido: 0, // Olist não envia valor no webhook de notificação - será atualizado via polling
      formaPagamento: dados.formaEnvio?.descricao ?? null,
      canal: dados.nomeEcommerce ?? null,
      dataPedido: dataPedido,
      dataPrevEntrega: null,
      observacoes: null,
      rawData: JSON.stringify(payload),
    } as any);

    await insertWebhookLog({ tipo: "pedido", evento: tipo, payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar novo pedido
    if (tipo === "inclusao_pedido") {
      await notifyOwner({
        title: `🛒 Novo Pedido #${dados.numero}`,
        content: `Novo pedido recebido!\nCliente: ${dados.cliente?.nome ?? "N/A"}\nNúmero: ${dados.numero}\nStatus: ${dados.descricaoSituacao ?? status}\nCanal: ${dados.nomeEcommerce ?? "N/A"}`,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Pedido] Erro:", err.message, "Payload:", JSON.stringify(payload));
    await insertWebhookLog({ tipo: "pedido", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Produtos (Envio de produtos) ────────────────────────────────────────────
// O Olist envia dados do produto quando há alteração
webhookRouter.post("/produtos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const dados = payload?.dados ?? payload?.produto ?? payload;

    if (!dados?.nome && !dados?.id) {
      await insertWebhookLog({ tipo: "produto", evento: "recebido", payload: JSON.stringify(payload), status: "ignorado", ip });
      return res.json({ ok: true, msg: "ignorado" });
    }

    await upsertProduto({
      olistId: String(dados.id ?? dados.olistId ?? ""),
      codigo: dados.codigo ?? dados.sku ?? null,
      nome: dados.nome ?? "Produto sem nome",
      descricao: dados.descricao ?? null,
      categoria: dados.categoria?.nome ?? dados.categoria ?? null,
      preco: dados.preco ?? null,
      precoCusto: dados.precoCusto ?? dados.preco_custo ?? null,
      unidade: dados.unidade ?? null,
      estoqueAtual: dados.estoque?.saldo_fisico ?? dados.saldo_fisico ?? dados.estoque ?? dados.estoqueAtual ?? 0,
      estoqueMinimo: dados.estoqueMinimo ?? dados.estoque_minimo ?? 0,
      ativo: dados.ativo === false || dados.ativo === "N" ? "N" : "S",
      rawData: JSON.stringify(payload),
    } as any);

    await insertWebhookLog({ tipo: "produto", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    // Verificar estoque crítico
    const baixoEstoque = await getProdutosBaixoEstoque();
    const produtoCritico = baixoEstoque.find(p => p.olistId === String(dados.id ?? ""));
    if (produtoCritico) {
      await notifyOwner({
        title: `⚠️ Estoque Crítico: ${produtoCritico.nome}`,
        content: `O produto "${produtoCritico.nome}" está com estoque abaixo do mínimo.\nEstoque atual: ${produtoCritico.estoqueAtual} | Mínimo: ${produtoCritico.estoqueMinimo}\nAção necessária: repor estoque imediatamente.`,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Produto] Erro:", err.message, "Payload:", JSON.stringify(payload));
    await insertWebhookLog({ tipo: "produto", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Estoque (Atualizações de estoque) ───────────────────────────────────────
webhookRouter.post("/estoque", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const dados = payload?.dados ?? payload?.produto ?? payload;

    await insertWebhookLog({ tipo: "estoque", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    if (dados?.id || dados?.nome) {
      await upsertProduto({
        olistId: String(dados.id ?? ""),
        nome: dados.nome ?? "Produto",
        estoqueAtual: dados.saldo_fisico ?? dados.saldoFisico ?? dados.estoque ?? 0,
        estoqueMinimo: dados.estoque_minimo ?? dados.estoqueMinimo ?? 0,
        ativo: "S",
      } as any);
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Estoque] Erro:", err.message);
    await insertWebhookLog({ tipo: "estoque", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Notas Fiscais (Envio de nota fiscal) ────────────────────────────────────
webhookRouter.post("/notas-fiscais", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const dados = payload?.dados ?? payload?.nota_fiscal ?? payload?.notaFiscal ?? payload;

    await upsertNotaFiscal({
      olistId: String(dados.id ?? ""),
      numero: dados.numero ?? null,
      serie: dados.serie ?? null,
      chaveAcesso: dados.chave_acesso ?? dados.chaveAcesso ?? null,
      status: dados.situacao ?? dados.status ?? null,
      situacao: dados.situacao ?? null,
      tipo: dados.tipo === "E" ? "E" : "S",
      valorTotal: dados.valor_total ?? dados.valorTotal ?? null,
      dataEmissao: parseOlistDate(dados.data_emissao ?? dados.dataEmissao) ?? new Date(),
      clienteNome: dados.cliente?.nome ?? dados.clienteNome ?? null,
      clienteCpfCnpj: dados.cliente?.cpf_cnpj ?? dados.clienteCpfCnpj ?? null,
      rawData: JSON.stringify(payload),
    } as any);

    await insertWebhookLog({ tipo: "nota_fiscal", evento: dados.situacao ?? "emitida", payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar NF rejeitada
    const statusRejeitado = ["rejeitada", "denegada", "cancelada", "erro"];
    if (statusRejeitado.includes((dados.situacao ?? "").toLowerCase())) {
      await notifyOwner({
        title: `❌ Nota Fiscal ${dados.situacao?.toUpperCase()}: NF ${dados.numero}`,
        content: `A nota fiscal ${dados.numero} (série ${dados.serie}) foi ${dados.situacao}.\nCliente: ${dados.cliente?.nome ?? "N/A"}\nValor: R$ ${dados.valor_total ?? "N/A"}\nAção necessária: verificar e reemitir.`,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook NF] Erro:", err.message);
    await insertWebhookLog({ tipo: "nota_fiscal", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Rastreamento (Envio de código de rastreio) ───────────────────────────────
webhookRouter.post("/rastreamento", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const dados = payload?.dados ?? payload?.expedicao ?? payload?.expedição ?? payload;

    await upsertExpedicao({
      olistId: String(dados.id ?? ""),
      numero: dados.numero ?? null,
      status: dados.situacao ?? dados.status ?? null,
      transportadora: dados.transportadora?.nome ?? dados.transportadora ?? null,
      codigoRastreio: dados.codigo_rastreio ?? dados.codigoRastreio ?? null,
      urlRastreio: dados.url_rastreio ?? dados.urlRastreio ?? null,
      dataExpedicao: parseOlistDate(dados.data_expedicao ?? dados.dataExpedicao) ?? new Date(),
      dataPrevEntrega: parseOlistDate(dados.data_prev_entrega ?? dados.dataPrevEntrega),
      dataEntrega: parseOlistDate(dados.data_entrega ?? dados.dataEntrega),
      rawData: JSON.stringify(payload),
    } as any);

    await insertWebhookLog({ tipo: "expedicao", evento: dados.situacao ?? "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar atraso na expedição
    if (dados.data_prev_entrega || dados.dataPrevEntrega) {
      const prevEntrega = parseOlistDate(dados.data_prev_entrega ?? dados.dataPrevEntrega);
      const hoje = new Date();
      if (prevEntrega && prevEntrega < hoje && !dados.data_entrega && !dados.dataEntrega) {
        await notifyOwner({
          title: `🚚 Atraso na Expedição: ${dados.numero}`,
          content: `A expedição ${dados.numero} está atrasada!\nTransportadora: ${dados.transportadora?.nome ?? dados.transportadora ?? "N/A"}\nCódigo de rastreio: ${dados.codigo_rastreio ?? "N/A"}\nData prevista: ${prevEntrega.toLocaleDateString("pt-BR")}\nStatus atual: ${dados.situacao ?? "N/A"}`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Rastreamento] Erro:", err.message);
    await insertWebhookLog({ tipo: "expedicao", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Preços (Envio de preços de produtos) ────────────────────────────────────
webhookRouter.post("/precos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const dados = payload?.dados ?? payload?.produto ?? payload;

    if (dados?.id && dados?.preco) {
      await upsertProduto({
        olistId: String(dados.id),
        nome: dados.nome ?? "Produto",
        preco: dados.preco,
        precoCusto: dados.preco_custo ?? dados.precoCusto ?? null,
      } as any);
    }

    await insertWebhookLog({ tipo: "preco", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook Preço] Erro:", err.message);
    await insertWebhookLog({ tipo: "preco", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
webhookRouter.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), service: "Boat Beer ERP Webhook" });
});
