import {
  bigint,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users (auth) ────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Produtos ────────────────────────────────────────────────────────────────
export const produtos = mysqlTable("produtos", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  codigo: varchar("codigo", { length: 64 }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  categoria: varchar("categoria", { length: 128 }),
  preco: decimal("preco", { precision: 10, scale: 2 }),
  precoCusto: decimal("precoCusto", { precision: 10, scale: 2 }),
  unidade: varchar("unidade", { length: 16 }),
  estoqueAtual: decimal("estoqueAtual", { precision: 10, scale: 2 }).default("0"),
  estoqueMinimo: decimal("estoqueMinimo", { precision: 10, scale: 2 }).default("0"),
  ativo: mysqlEnum("ativo", ["S", "N"]).default("S"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// ─── Pedidos ─────────────────────────────────────────────────────────────────
export const pedidos = mysqlTable("pedidos", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  numero: varchar("numero", { length: 64 }),
  numeroPedidoCliente: varchar("numeroPedidoCliente", { length: 64 }),
  clienteNome: varchar("clienteNome", { length: 256 }),
  clienteEmail: varchar("clienteEmail", { length: 320 }),
  clienteCpfCnpj: varchar("clienteCpfCnpj", { length: 32 }),
  status: varchar("status", { length: 64 }),
  situacao: varchar("situacao", { length: 64 }),
  totalProdutos: decimal("totalProdutos", { precision: 10, scale: 2 }),
  totalDesconto: decimal("totalDesconto", { precision: 10, scale: 2 }).default("0"),
  totalFrete: decimal("totalFrete", { precision: 10, scale: 2 }).default("0"),
  totalPedido: decimal("totalPedido", { precision: 10, scale: 2 }),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  canal: varchar("canal", { length: 128 }),
  dataPedido: timestamp("dataPedido"),
  dataPrevEntrega: timestamp("dataPrevEntrega"),
  observacoes: text("observacoes"),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = typeof pedidos.$inferInsert;

// ─── Itens de Pedido ─────────────────────────────────────────────────────────
export const itensPedido = mysqlTable("itens_pedido", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  produtoId: int("produtoId"),
  produtoNome: varchar("produtoNome", { length: 256 }),
  produtoCodigo: varchar("produtoCodigo", { length: 64 }),
  quantidade: decimal("quantidade", { precision: 10, scale: 2 }),
  valorUnitario: decimal("valorUnitario", { precision: 10, scale: 2 }),
  valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
  desconto: decimal("desconto", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemPedido = typeof itensPedido.$inferSelect;
export type InsertItemPedido = typeof itensPedido.$inferInsert;

// ─── Notas Fiscais ───────────────────────────────────────────────────────────
export const notasFiscais = mysqlTable("notas_fiscais", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: int("pedidoId"),
  numero: varchar("numero", { length: 64 }),
  serie: varchar("serie", { length: 16 }),
  chaveAcesso: varchar("chaveAcesso", { length: 64 }),
  status: varchar("status", { length: 64 }),
  situacao: varchar("situacao", { length: 64 }),
  tipo: mysqlEnum("tipo", ["E", "S"]).default("S"),
  valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
  dataEmissao: timestamp("dataEmissao"),
  clienteNome: varchar("clienteNome", { length: 256 }),
  clienteCpfCnpj: varchar("clienteCpfCnpj", { length: 32 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotaFiscal = typeof notasFiscais.$inferSelect;
export type InsertNotaFiscal = typeof notasFiscais.$inferInsert;

// ─── Expedições ──────────────────────────────────────────────────────────────
export const expedicoes = mysqlTable("expedicoes", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: int("pedidoId"),
  numero: varchar("numero", { length: 64 }),
  status: varchar("status", { length: 64 }),
  transportadora: varchar("transportadora", { length: 128 }),
  codigoRastreio: varchar("codigoRastreio", { length: 128 }),
  urlRastreio: text("urlRastreio"),
  dataExpedicao: timestamp("dataExpedicao"),
  dataPrevEntrega: timestamp("dataPrevEntrega"),
  dataEntrega: timestamp("dataEntrega"),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Expedicao = typeof expedicoes.$inferSelect;
export type InsertExpedicao = typeof expedicoes.$inferInsert;

// ─── Contas a Receber ────────────────────────────────────────────────────────
export const contasReceber = mysqlTable("contas_receber", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: int("pedidoId"),
  descricao: text("descricao"),
  clienteNome: varchar("clienteNome", { length: 256 }),
  valor: decimal("valor", { precision: 10, scale: 2 }),
  valorRecebido: decimal("valorRecebido", { precision: 10, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["aberto", "recebido", "cancelado", "vencido"]).default("aberto"),
  dataVencimento: timestamp("dataVencimento"),
  dataRecebimento: timestamp("dataRecebimento"),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContaReceber = typeof contasReceber.$inferSelect;
export type InsertContaReceber = typeof contasReceber.$inferInsert;

// ─── Contas a Pagar ──────────────────────────────────────────────────────────
export const contasPagar = mysqlTable("contas_pagar", {
  id: int("id").autoincrement().primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  descricao: text("descricao"),
  fornecedorNome: varchar("fornecedorNome", { length: 256 }),
  valor: decimal("valor", { precision: 10, scale: 2 }),
  valorPago: decimal("valorPago", { precision: 10, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["aberto", "pago", "cancelado", "vencido"]).default("aberto"),
  dataVencimento: timestamp("dataVencimento"),
  dataPagamento: timestamp("dataPagamento"),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContaPagar = typeof contasPagar.$inferSelect;
export type InsertContaPagar = typeof contasPagar.$inferInsert;

// ─── Logs de Webhooks ────────────────────────────────────────────────────────
export const webhookLogs = mysqlTable("webhook_logs", {
  id: int("id").autoincrement().primaryKey(),
  tipo: varchar("tipo", { length: 64 }).notNull(),
  evento: varchar("evento", { length: 128 }),
  payload: text("payload"),
  status: mysqlEnum("status", ["processado", "erro", "ignorado"]).default("processado"),
  erroMsg: text("erroMsg"),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;
