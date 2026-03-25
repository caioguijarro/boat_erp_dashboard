import { and, desc, eq, gte, lte, sql, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, produtos, pedidos, itensPedido, notasFiscais, expedicoes, contasReceber, contasPagar, webhookLogs } from "../drizzle/schema";
import type { InsertProduto, InsertPedido, InsertItemPedido, InsertNotaFiscal, InsertExpedicao, InsertContaReceber, InsertContaPagar, InsertWebhookLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
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
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
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
    await db.insert(produtos).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
    await db.insert(pedidos).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
  // Use raw SQL to avoid TiDB only_full_group_by issues
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
  // Use raw SQL with alias in GROUP BY to satisfy TiDB only_full_group_by mode
  try {
    const result = await db.execute(
      sql`SELECT DATE_FORMAT(${pedidos.dataPedido}, '%Y-%m-%d') as dia, COALESCE(SUM(${pedidos.totalPedido}), 0) as total, COUNT(*) as quantidade FROM ${pedidos} WHERE ${pedidos.dataPedido} >= ${dataInicio} AND ${pedidos.dataPedido} <= ${dataFim} AND ${pedidos.status} NOT IN ('cancelado', 'recusado') GROUP BY dia ORDER BY dia`
    );
    // MySqlRawQueryResult is [RowDataPacket[], FieldPacket[]] - rows are in index 0
    const rows = (result[0] as unknown as Array<{ dia: string; total: number; quantidade: number }>);
    return rows.map(r => ({
      data: r.dia,
      total: r.total,
      quantidade: r.quantidade,
    }));
  } catch {
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
    await db.insert(notasFiscais).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
    await db.insert(expedicoes).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
    await db.insert(contasReceber).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
    await db.insert(contasPagar).values(data).onDuplicateKeyUpdate({ set: { ...data, updatedAt: new Date() } });
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
