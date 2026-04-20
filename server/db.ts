import { and, desc, eq, gte, lte, sql, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { InsertUser, users, produtos, pedidos, itensPedido, notasFiscais, expedicoes, contasReceber, contasPagar, webhookLogs, vendedores, metas, comissoesPagas } from "../drizzle/schema.js";
import type { InsertProduto, InsertPedido, InsertItemPedido, InsertNotaFiscal, InsertExpedicao, InsertContaReceber, InsertContaPagar, InsertWebhookLog, InsertVendedor, InsertMeta, InsertComissaoPaga } from "../drizzle/schema.js";
import { ENV } from './_core/env.js';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = postgres(process.env.DATABASE_URL, { prepare: false });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Produtos ────────────────────────────────────────────────────────────────
export async function upsertProduto(data: InsertProduto) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(produtos).values(data).onConflictDoUpdate({ target: produtos.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(produtos).values(data);
  }
}

export async function getProdutos(categoria?: string, limit = 50, offset = 0, apenasAlerta?: boolean, apenasSemEstoque?: boolean) {
  const db = await getDb();
  if (!db) return [];
  const conditions: ReturnType<typeof eq>[] = [];
  if (categoria) conditions.push(eq(produtos.categoria, categoria));
  let query = db.select().from(produtos);
  if (apenasSemEstoque) {
    return query.where(sql`${produtos.estoqueAtual} <= 0 AND ${produtos.ativo} = 'S'`).orderBy(produtos.estoqueAtual).limit(limit).offset(offset);
  }
  if (apenasAlerta) {
    return query.where(sql`${produtos.estoqueAtual} <= ${produtos.estoqueMinimo} AND ${produtos.estoqueMinimo} > 0 AND ${produtos.ativo} = 'S'`).orderBy(produtos.estoqueAtual).limit(limit).offset(offset);
  }
  return query.where(conditions.length ? and(...conditions) : undefined).orderBy(desc(produtos.updatedAt)).limit(limit).offset(offset);
}

export async function getProdutosBaixoEstoque() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(produtos).where(
    sql`${produtos.estoqueAtual} <= ${produtos.estoqueMinimo} AND ${produtos.ativo} = 'S'`
  ).orderBy(produtos.estoqueAtual);
}

export async function getProdutoCategorias() {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ categoria: produtos.categoria }).from(produtos).where(sql`${produtos.categoria} IS NOT NULL`);
  return result.map(r => r.categoria).filter(Boolean);
}

// ─── Pedidos ─────────────────────────────────────────────────────────────────
export async function upsertPedido(data: InsertPedido) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(pedidos).values(data).onConflictDoUpdate({ target: pedidos.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(pedidos).values(data);
  }
}

export async function getPedidos(opts?: { status?: string; dataInicio?: Date; dataFim?: Date; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.status) conditions.push(eq(pedidos.status, opts.status));
  if (opts?.dataInicio) conditions.push(gte(pedidos.dataPedido, opts.dataInicio));
  if (opts?.dataFim) conditions.push(lte(pedidos.dataPedido, opts.dataFim));
  return db.select().from(pedidos)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(pedidos.dataPedido))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

export async function getPedidoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(pedidos).where(eq(pedidos.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getItensPedido(pedidoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(itensPedido).where(eq(itensPedido.pedidoId, pedidoId));
}

export async function upsertItemPedido(data: InsertItemPedido) {
  const db = await getDb();
  if (!db) return;
  await db.insert(itensPedido).values(data);
}

export async function getVendasPorPeriodo(dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return { total: 0, quantidade: 0 };
  try {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${pedidos.totalPedido}), 0)`,
      quantidade: sql<number>`COUNT(*)`,
    }).from(pedidos).where(and(
      gte(pedidos.dataPedido, dataInicio),
      lte(pedidos.dataPedido, dataFim),
      sql`${pedidos.status} NOT IN ('cancelado', 'recusado')`
    ));
    return result[0] ?? { total: 0, quantidade: 0 };
  } catch {
    return { total: 0, quantidade: 0 };
  }
}

export async function getVendasPorDia(dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return [];
  try {
    const result = await db.execute(
      sql`SELECT TO_CHAR("dataPedido", 'YYYY-MM-DD') as dia, COALESCE(SUM("totalPedido"), 0) as total, COUNT(*) as quantidade FROM pedidos WHERE "dataPedido" >= ${dataInicio} AND "dataPedido" <= ${dataFim} AND status NOT IN ('cancelado', 'recusado') GROUP BY dia ORDER BY dia`
    );
    return (result as unknown as Array<{ dia: string; total: string; quantidade: string }>).map(r => ({
      data: r.dia,
      total: Number(r.total),
      quantidade: Number(r.quantidade),
    }));
  } catch (err) {
    console.error('[getVendasPorDia] error:', err);
    return [];
  }
}

export async function getPedidosPorStatus() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    status: pedidos.status,
    quantidade: sql<number>`COUNT(*)`,
  }).from(pedidos).groupBy(pedidos.status);
}

// ─── Notas Fiscais ───────────────────────────────────────────────────────────
export async function upsertNotaFiscal(data: InsertNotaFiscal) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(notasFiscais).values(data).onConflictDoUpdate({ target: notasFiscais.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(notasFiscais).values(data);
  }
}

export async function getNotasFiscais(opts?: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = opts?.status ? [eq(notasFiscais.status, opts.status)] : [];
  return db.select().from(notasFiscais)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(notasFiscais.dataEmissao))
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

// ─── Expedições ──────────────────────────────────────────────────────────────
export async function upsertExpedicao(data: InsertExpedicao) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(expedicoes).values(data).onConflictDoUpdate({ target: expedicoes.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(expedicoes).values(data);
  }
}

export async function getExpedicaoPorPedido(pedidoId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(expedicoes).where(eq(expedicoes.pedidoId, pedidoId)).limit(1);
  return result[0] ?? null;
}

// ─── Contas a Receber ────────────────────────────────────────────────────────
export async function upsertContaReceber(data: InsertContaReceber) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(contasReceber).values(data).onConflictDoUpdate({ target: contasReceber.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(contasReceber).values(data);
  }
}

export async function getContasReceber(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = status ? [eq(contasReceber.status, status as "aberto" | "recebido" | "cancelado" | "vencido")] : [];
  return db.select().from(contasReceber)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(contasReceber.dataVencimento);
}

export async function getTotalContasReceber() {
  const db = await getDb();
  if (!db) return { aberto: 0, vencido: 0, recebido: 0 };
  const hoje = new Date();
  const [aberto, vencido, recebido] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${contasReceber.valor}), 0)` }).from(contasReceber).where(eq(contasReceber.status, "aberto")),
    db.select({ total: sql<number>`COALESCE(SUM(${contasReceber.valor}), 0)` }).from(contasReceber).where(and(eq(contasReceber.status, "aberto"), lt(contasReceber.dataVencimento, hoje))),
    db.select({ total: sql<number>`COALESCE(SUM(${contasReceber.valorRecebido}), 0)` }).from(contasReceber).where(eq(contasReceber.status, "recebido")),
  ]);
  return { aberto: aberto[0]?.total ?? 0, vencido: vencido[0]?.total ?? 0, recebido: recebido[0]?.total ?? 0 };
}

// ─── Contas a Pagar ──────────────────────────────────────────────────────────
export async function upsertContaPagar(data: InsertContaPagar) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(contasPagar).values(data).onConflictDoUpdate({ target: contasPagar.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(contasPagar).values(data);
  }
}

export async function getContasPagar(status?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = status ? [eq(contasPagar.status, status as "aberto" | "pago" | "cancelado" | "vencido")] : [];
  return db.select().from(contasPagar)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(contasPagar.dataVencimento);
}

export async function getTotalContasPagar() {
  const db = await getDb();
  if (!db) return { aberto: 0, vencido: 0, pago: 0 };
  const hoje = new Date();
  const [aberto, vencido, pago] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${contasPagar.valor}), 0)` }).from(contasPagar).where(eq(contasPagar.status, "aberto")),
    db.select({ total: sql<number>`COALESCE(SUM(${contasPagar.valor}), 0)` }).from(contasPagar).where(and(eq(contasPagar.status, "aberto"), lt(contasPagar.dataVencimento, hoje))),
    db.select({ total: sql<number>`COALESCE(SUM(${contasPagar.valorPago}), 0)` }).from(contasPagar).where(eq(contasPagar.status, "pago")),
  ]);
  return { aberto: aberto[0]?.total ?? 0, vencido: vencido[0]?.total ?? 0, pago: pago[0]?.total ?? 0 };
}

// ─── Webhook Logs ─────────────────────────────────────────────────────────────
export async function insertWebhookLog(data: InsertWebhookLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(webhookLogs).values(data);
}

export async function getWebhookLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webhookLogs).orderBy(desc(webhookLogs.createdAt)).limit(limit);
}

export async function getResumoEstoque() {
  const db = await getDb();
  if (!db) return { total: 0, baixoEstoque: 0, semEstoque: 0 };
  const [total, baixo, sem] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` }).from(produtos).where(eq(produtos.ativo, "S")),
    db.select({ count: sql<number>`COUNT(*)` }).from(produtos).where(sql`${produtos.estoqueAtual} <= ${produtos.estoqueMinimo} AND ${produtos.ativo} = 'S' AND ${produtos.estoqueAtual} > 0`),
    db.select({ count: sql<number>`COUNT(*)` }).from(produtos).where(sql`${produtos.estoqueAtual} = 0 AND ${produtos.ativo} = 'S'`),
  ]);
  return { total: total[0]?.count ?? 0, baixoEstoque: baixo[0]?.count ?? 0, semEstoque: sem[0]?.count ?? 0 };
}

// ─── Vendedores ───────────────────────────────────────────────────────────────

export async function getVendedores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vendedores).where(eq(vendedores.ativo, "S")).orderBy(vendedores.nome);
}

export async function upsertVendedor(data: InsertVendedor) {
  const db = await getDb();
  if (!db) return;
  if (data.olistId) {
    await db.insert(vendedores).values(data).onConflictDoUpdate({ target: vendedores.olistId, set: { ...data, updatedAt: new Date() } });
  } else {
    await db.insert(vendedores).values(data);
  }
}

export async function updateVendedorComissao(id: number, comissaoPerc: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(vendedores).set({ comissaoPerc, updatedAt: new Date() }).where(eq(vendedores.id, id));
}

// ─── Metas ────────────────────────────────────────────────────────────────────
export async function getMetas(ano?: number, mes?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ano) conditions.push(eq(metas.ano, ano));
  if (mes) conditions.push(eq(metas.mes, mes));
  return db.select().from(metas).where(conditions.length ? and(...conditions) : undefined).orderBy(metas.ano, metas.mes);
}

export async function upsertMeta(data: InsertMeta) {
  const db = await getDb();
  if (!db) return;
  const vendedorIdVal = data.vendedorId ?? null;
  const existing = await db.execute(
    sql`SELECT id FROM metas WHERE ano = ${data.ano} AND mes = ${data.mes} AND ${vendedorIdVal === null ? sql`"vendedorId" IS NULL` : sql`"vendedorId" = ${vendedorIdVal}`} LIMIT 1`
  );
  const rows = existing as unknown as Array<{ id: number }>;
  if (rows.length > 0) {
    await db.update(metas).set({ valorMeta: data.valorMeta, updatedAt: new Date() }).where(eq(metas.id, rows[0].id));
  } else {
    await db.insert(metas).values(data);
  }
}

// ─── Comissões Pagas ──────────────────────────────────────────────────────────
export async function getComissoesPagas(vendedorId?: number, ano?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (vendedorId) conditions.push(eq(comissoesPagas.vendedorId, vendedorId));
  if (ano) conditions.push(eq(comissoesPagas.ano, ano));
  return db.select().from(comissoesPagas).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(comissoesPagas.ano), desc(comissoesPagas.mes));
}

export async function upsertComissaoPaga(data: InsertComissaoPaga) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.execute(
    sql`SELECT id FROM comissoes_pagas WHERE "vendedorId" = ${data.vendedorId} AND ano = ${data.ano} AND mes = ${data.mes} LIMIT 1`
  );
  const rows = existing as unknown as Array<{ id: number }>;
  if (rows.length > 0) {
    await db.update(comissoesPagas).set({ ...data, updatedAt: new Date() }).where(eq(comissoesPagas.id, rows[0].id));
  } else {
    await db.insert(comissoesPagas).values(data);
  }
}

export async function marcarComissaoPaga(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(comissoesPagas).set({ pago: "S", dataPagamento: new Date(), updatedAt: new Date() }).where(eq(comissoesPagas.id, id));
}

// ─── Analytics: Vendas por Vendedor ──────────────────────────────────────────
export async function getVendasPorVendedor(dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(
    sql`SELECT
      SPLIT_PART(canal, ':', 2) as vendedor_id,
      SPLIT_PART(canal, ':', 3) as vendedor_nome,
      COALESCE(SUM("totalPedido"), 0) as total_vendas,
      COUNT(*) as quantidade_pedidos
    FROM pedidos
    WHERE "dataPedido" >= ${dataInicio}
      AND "dataPedido" <= ${dataFim}
      AND status NOT IN ('cancelado', 'recusado')
      AND canal LIKE 'vendedor:%'
    GROUP BY vendedor_id, vendedor_nome
    ORDER BY total_vendas DESC`
  );
  return (result as unknown as Array<{
    vendedor_id: string;
    vendedor_nome: string;
    total_vendas: string;
    quantidade_pedidos: string;
  }>).map(r => ({
    vendedor_id: r.vendedor_id,
    vendedor_nome: r.vendedor_nome,
    total_vendas: Number(r.total_vendas),
    quantidade_pedidos: Number(r.quantidade_pedidos),
  }));
}

// ─── Analytics: Inadimplência ─────────────────────────────────────────────────
export async function getInadimplencia(dataInicio?: Date, dataFim?: Date) {
  const db = await getDb();
  if (!db) return [];
  const dateFilter = dataInicio && dataFim
    ? sql`AND "dataPedido" >= ${dataInicio} AND "dataPedido" <= ${dataFim}`
    : sql``;
  const result = await db.execute(
    sql`SELECT
      id, "olistId", numero, "clienteNome", "clienteCpfCnpj",
      "totalPedido", "dataPedido", "dataPrevEntrega",
      canal,
      SPLIT_PART(canal, ':', 2) as vendedor_id,
      SPLIT_PART(canal, ':', 3) as vendedor_nome,
      EXTRACT(EPOCH FROM (NOW() - "dataPrevEntrega"))::int / 86400 as dias_atraso,
      "rawData"
    FROM pedidos
    WHERE situacao = 'Entregue'
      AND (("rawData"::json->>'_pagamento_confirmado')::boolean = false OR ("rawData"::json->>'_pagamento_confirmado') IS NULL)
      ${dateFilter}
    ORDER BY dias_atraso DESC`
  );
  return result as unknown as Array<{
    id: number; olistId: string; numero: string; clienteNome: string; clienteCpfCnpj: string;
    totalPedido: number; dataPedido: Date; dataPrevEntrega: Date; canal: string;
    vendedor_id: string; vendedor_nome: string; dias_atraso: number; rawData: string;
  }>;
}

// ─── Analytics: Top Clientes ──────────────────────────────────────────────────
export async function getTopClientes(dataInicio: Date, dataFim: Date, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(
    sql`SELECT
      "clienteNome",
      "clienteCpfCnpj",
      COUNT(*) as total_pedidos,
      COALESCE(SUM("totalPedido"), 0) as total_compras,
      MAX("dataPedido") as ultimo_pedido
    FROM pedidos
    WHERE "dataPedido" >= ${dataInicio}
      AND "dataPedido" <= ${dataFim}
      AND status NOT IN ('cancelado', 'recusado')
      AND "clienteNome" IS NOT NULL
    GROUP BY "clienteNome", "clienteCpfCnpj"
    ORDER BY total_compras DESC
    LIMIT ${limit}`
  );
  return (result as unknown as Array<{
    clienteNome: string; clienteCpfCnpj: string;
    total_pedidos: string; total_compras: string; ultimo_pedido: Date;
  }>).map(r => ({
    clienteNome: r.clienteNome,
    clienteCpfCnpj: r.clienteCpfCnpj,
    total_pedidos: Number(r.total_pedidos),
    total_compras: Number(r.total_compras),
    ultimo_pedido: r.ultimo_pedido,
  }));
}

// ─── Analytics: Conciliação ───────────────────────────────────────────────────
export async function getConciliacao(dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(
    sql`SELECT
      id, "olistId", numero, "clienteNome", "clienteCpfCnpj",
      "totalPedido", "dataPedido", situacao,
      CASE
        WHEN situacao IN ('Faturado', 'Entregue e Pago', 'Pago') THEN 'pago'
        WHEN situacao = 'Entregue' THEN 'entregue'
        ELSE LOWER(situacao)
      END as status
    FROM pedidos
    WHERE "dataPedido" >= ${dataInicio}
      AND "dataPedido" <= ${dataFim}
      AND situacao NOT IN ('Cancelado', 'Recusado')
    ORDER BY "dataPedido" DESC
    LIMIT 200`
  );
  return result as unknown as Array<{
    id: number; olistId: string; numero: string; clienteNome: string; clienteCpfCnpj: string;
    totalPedido: number; dataPedido: Date; situacao: string; status: string;
  }>;
}
