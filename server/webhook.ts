import { Router } from "express";
import {
  upsertProduto, upsertPedido, upsertItemPedido,
  upsertNotaFiscal, upsertExpedicao,
  upsertContaReceber, upsertContaPagar,
  insertWebhookLog, getProdutosBaixoEstoque,
} from "./db";
import { notifyOwner } from "./_core/notification";

export const webhookRouter = Router();

// Middleware para logar todas as requisições de webhook
webhookRouter.use((req, _res, next) => {
  console.log(`[Webhook] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ─── Produtos / Estoque ───────────────────────────────────────────────────────
webhookRouter.post("/produtos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const data = payload?.produto ?? payload;
    if (!data?.nome) {
      await insertWebhookLog({ tipo: "produto", evento: "recebido", payload: JSON.stringify(payload), status: "ignorado", ip });
      return res.json({ ok: true, msg: "ignorado" });
    }

    await upsertProduto({
      olistId: String(data.id ?? data.olistId ?? ""),
      codigo: data.codigo ?? data.sku,
      nome: data.nome,
      descricao: data.descricao,
      categoria: data.categoria?.nome ?? data.categoria,
      preco: data.preco,
      precoCusto: data.precoCusto ?? data.preco_custo,
      unidade: data.unidade,
      estoqueAtual: data.estoque?.saldo_fisico ?? data.estoque ?? data.estoqueAtual ?? 0,
      estoqueMinimo: data.estoqueMinimo ?? data.estoque_minimo ?? 0,
      ativo: data.ativo === false || data.ativo === "N" ? "N" : "S",
      rawData: JSON.stringify(data),
    } as any);

    await insertWebhookLog({ tipo: "produto", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    // Verificar estoque crítico
    const baixoEstoque = await getProdutosBaixoEstoque();
    if (baixoEstoque.length > 0) {
      const produtoCritico = baixoEstoque.find(p => p.olistId === String(data.id ?? data.olistId ?? ""));
      if (produtoCritico) {
        await notifyOwner({
          title: `⚠️ Estoque Crítico: ${produtoCritico.nome}`,
          content: `O produto "${produtoCritico.nome}" está com estoque abaixo do mínimo. Estoque atual: ${produtoCritico.estoqueAtual} | Mínimo: ${produtoCritico.estoqueMinimo}. Ação necessária: repor estoque imediatamente.`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "produto", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Estoque (notificação específica) ────────────────────────────────────────
webhookRouter.post("/estoque", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    await insertWebhookLog({ tipo: "estoque", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    const data = payload?.produto ?? payload;
    if (data?.nome) {
      await upsertProduto({
        olistId: String(data.id ?? ""),
        nome: data.nome,
        estoqueAtual: data.saldo_fisico ?? data.estoque ?? 0,
        estoqueMinimo: data.estoque_minimo ?? 0,
        ativo: "S",
      } as any);
    }

    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "estoque", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Pedidos ──────────────────────────────────────────────────────────────────
webhookRouter.post("/pedidos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const data = payload?.pedido ?? payload;
    if (!data) {
      await insertWebhookLog({ tipo: "pedido", evento: "recebido", payload: JSON.stringify(payload), status: "ignorado", ip });
      return res.json({ ok: true, msg: "ignorado" });
    }

    const totalPedido = Number(data.total_pedido ?? data.totalPedido ?? data.valor ?? 0);

    await upsertPedido({
      olistId: String(data.id ?? data.numero ?? ""),
      numero: data.numero,
      numeroPedidoCliente: data.numero_pedido_cliente ?? data.numeroPedidoCliente,
      clienteNome: data.cliente?.nome ?? data.clienteNome ?? data.nome_cliente,
      clienteEmail: data.cliente?.email ?? data.clienteEmail,
      clienteCpfCnpj: data.cliente?.cpf_cnpj ?? data.clienteCpfCnpj,
      status: data.situacao ?? data.status ?? "pendente",
      situacao: data.situacao ?? data.status,
      totalProdutos: data.total_produtos ?? data.totalProdutos,
      totalDesconto: data.total_desconto ?? data.totalDesconto ?? 0,
      totalFrete: data.total_frete ?? data.totalFrete ?? 0,
      totalPedido: totalPedido,
      formaPagamento: data.forma_pagamento ?? data.formaPagamento,
      canal: data.canal ?? data.ecommerce?.nome,
      dataPedido: data.data_pedido ? new Date(data.data_pedido) : new Date(),
      dataPrevEntrega: data.data_prev_entrega ? new Date(data.data_prev_entrega) : undefined,
      observacoes: data.observacoes,
      rawData: JSON.stringify(data),
    } as any);

    // Salvar itens do pedido
    if (Array.isArray(data.itens)) {
      for (const item of data.itens) {
        await upsertItemPedido({
          pedidoId: 0, // será atualizado depois
          produtoNome: item.produto?.nome ?? item.nome ?? item.descricao,
          produtoCodigo: item.produto?.codigo ?? item.codigo,
          quantidade: item.quantidade,
          valorUnitario: item.valor_unitario ?? item.preco,
          valorTotal: item.valor_total ?? (Number(item.quantidade) * Number(item.valor_unitario ?? item.preco)),
          desconto: item.desconto ?? 0,
        } as any);
      }
    }

    await insertWebhookLog({ tipo: "pedido", evento: data.situacao ?? "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar pedidos de alto valor (acima de R$ 1.000)
    if (totalPedido >= 1000) {
      await notifyOwner({
        title: `🎉 Pedido de Alto Valor: R$ ${totalPedido.toFixed(2)}`,
        content: `Novo pedido de alto valor recebido!\nCliente: ${data.cliente?.nome ?? data.clienteNome ?? "N/A"}\nValor: R$ ${totalPedido.toFixed(2)}\nNúmero: ${data.numero ?? "N/A"}\nStatus: ${data.situacao ?? "pendente"}`,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "pedido", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Notas Fiscais ────────────────────────────────────────────────────────────
webhookRouter.post("/notas-fiscais", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const data = payload?.nota_fiscal ?? payload?.notaFiscal ?? payload;

    await upsertNotaFiscal({
      olistId: String(data.id ?? ""),
      numero: data.numero,
      serie: data.serie,
      chaveAcesso: data.chave_acesso ?? data.chaveAcesso,
      status: data.situacao ?? data.status,
      situacao: data.situacao,
      tipo: data.tipo === "E" ? "E" : "S",
      valorTotal: data.valor_total ?? data.valorTotal,
      dataEmissao: data.data_emissao ? new Date(data.data_emissao) : new Date(),
      clienteNome: data.cliente?.nome ?? data.clienteNome,
      clienteCpfCnpj: data.cliente?.cpf_cnpj ?? data.clienteCpfCnpj,
      rawData: JSON.stringify(data),
    } as any);

    await insertWebhookLog({ tipo: "nota_fiscal", evento: data.situacao ?? "emitida", payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar NF rejeitada
    const statusRejeitado = ["rejeitada", "denegada", "cancelada", "erro"];
    if (statusRejeitado.includes((data.situacao ?? "").toLowerCase())) {
      await notifyOwner({
        title: `❌ Nota Fiscal ${data.situacao?.toUpperCase()}: NF ${data.numero}`,
        content: `A nota fiscal ${data.numero} (série ${data.serie}) foi ${data.situacao}.\nCliente: ${data.cliente?.nome ?? "N/A"}\nValor: R$ ${data.valor_total ?? data.valorTotal ?? "N/A"}\nChave: ${data.chave_acesso ?? "N/A"}\nAção necessária: verificar e reemitir.`,
      });
    }

    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "nota_fiscal", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Expedições / Rastreamento ────────────────────────────────────────────────
webhookRouter.post("/rastreamento", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const data = payload?.expedicao ?? payload?.expedição ?? payload;

    await upsertExpedicao({
      olistId: String(data.id ?? ""),
      numero: data.numero,
      status: data.situacao ?? data.status,
      transportadora: data.transportadora?.nome ?? data.transportadora,
      codigoRastreio: data.codigo_rastreio ?? data.codigoRastreio,
      urlRastreio: data.url_rastreio ?? data.urlRastreio,
      dataExpedicao: data.data_expedicao ? new Date(data.data_expedicao) : new Date(),
      dataPrevEntrega: data.data_prev_entrega ? new Date(data.data_prev_entrega) : undefined,
      dataEntrega: data.data_entrega ? new Date(data.data_entrega) : undefined,
      rawData: JSON.stringify(data),
    } as any);

    await insertWebhookLog({ tipo: "expedicao", evento: data.situacao ?? "atualizado", payload: JSON.stringify(payload), status: "processado", ip });

    // Notificar atraso na expedição
    if (data.data_prev_entrega) {
      const prevEntrega = new Date(data.data_prev_entrega);
      const hoje = new Date();
      if (prevEntrega < hoje && !data.data_entrega) {
        await notifyOwner({
          title: `🚚 Atraso na Expedição: ${data.numero}`,
          content: `A expedição ${data.numero} está atrasada!\nTransportadora: ${data.transportadora?.nome ?? data.transportadora ?? "N/A"}\nCódigo de rastreio: ${data.codigo_rastreio ?? "N/A"}\nData prevista: ${prevEntrega.toLocaleDateString("pt-BR")}\nStatus atual: ${data.situacao ?? "N/A"}`,
        });
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "expedicao", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Preços ───────────────────────────────────────────────────────────────────
webhookRouter.post("/precos", async (req, res) => {
  const payload = req.body;
  const ip = req.ip ?? "unknown";

  try {
    const data = payload?.produto ?? payload;
    if (data?.id && data?.preco) {
      await upsertProduto({
        olistId: String(data.id),
        nome: data.nome ?? "Produto",
        preco: data.preco,
        precoCusto: data.preco_custo ?? data.precoCusto,
      } as any);
    }
    await insertWebhookLog({ tipo: "preco", evento: "atualizado", payload: JSON.stringify(payload), status: "processado", ip });
    res.json({ ok: true });
  } catch (err: any) {
    await insertWebhookLog({ tipo: "preco", evento: "erro", payload: JSON.stringify(payload), status: "erro", erroMsg: err.message, ip });
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
webhookRouter.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), service: "Boat Beer ERP Webhook" });
});
