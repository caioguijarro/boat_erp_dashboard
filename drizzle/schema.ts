import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// ─── Users (auth) ────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role").$type<"user" | "admin">().default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Produtos ────────────────────────────────────────────────────────────────
export const produtos = pgTable("produtos", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  codigo: varchar("codigo", { length: 64 }),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  categoria: varchar("categoria", { length: 128 }),
  preco: numeric("preco", { precision: 10, scale: 2 }),
  precoCusto: numeric("precoCusto", { precision: 10, scale: 2 }),
  unidade: varchar("unidade", { length: 16 }),
  estoqueAtual: numeric("estoqueAtual", { precision: 10, scale: 2 }).default("0"),
  estoqueMinimo: numeric("estoqueMinimo", { precision: 10, scale: 2 }).default("0"),
  ativo: text("ativo").$type<"S" | "N">().default("S"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// ─── Pedidos ─────────────────────────────────────────────────────────────────
export const pedidos = pgTable("pedidos", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  numero: varchar("numero", { length: 64 }),
  numeroPedidoCliente: varchar("numeroPedidoCliente", { length: 64 }),
  clienteNome: varchar("clienteNome", { length: 256 }),
  clienteEmail: varchar("clienteEmail", { length: 320 }),
  clienteCpfCnpj: varchar("clienteCpfCnpj", { length: 32 }),
  status: varchar("status", { length: 64 }),
  situacao: varchar("situacao", { length: 64 }),
  totalProdutos: numeric("totalProdutos", { precision: 10, scale: 2 }),
  totalDesconto: numeric("totalDesconto", { precision: 10, scale: 2 }).default("0"),
  totalFrete: numeric("totalFrete", { precision: 10, scale: 2 }).default("0"),
  totalPedido: numeric("totalPedido", { precision: 10, scale: 2 }),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  canal: varchar("canal", { length: 128 }),
  dataPedido: timestamp("dataPedido"),
  dataPrevEntrega: timestamp("dataPrevEntrega"),
  observacoes: text("observacoes"),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Pedido = typeof pedidos.$inferSelect;
export type InsertPedido = typeof pedidos.$inferInsert;

// ─── Itens de Pedido ─────────────────────────────────────────────────────────
export const itensPedido = pgTable("itens_pedido", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  produtoId: integer("produtoId"),
  produtoNome: varchar("produtoNome", { length: 256 }),
  produtoCodigo: varchar("produtoCodigo", { length: 64 }),
  quantidade: numeric("quantidade", { precision: 10, scale: 2 }),
  valorUnitario: numeric("valorUnitario", { precision: 10, scale: 2 }),
  valorTotal: numeric("valorTotal", { precision: 10, scale: 2 }),
  desconto: numeric("desconto", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemPedido = typeof itensPedido.$inferSelect;
export type InsertItemPedido = typeof itensPedido.$inferInsert;

// ─── Notas Fiscais ───────────────────────────────────────────────────────────
export const notasFiscais = pgTable("notas_fiscais", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: integer("pedidoId"),
  numero: varchar("numero", { length: 64 }),
  serie: varchar("serie", { length: 16 }),
  chaveAcesso: varchar("chaveAcesso", { length: 64 }),
  status: varchar("status", { length: 64 }),
  situacao: varchar("situacao", { length: 64 }),
  tipo: text("tipo").$type<"E" | "S">().default("S"),
  valorTotal: numeric("valorTotal", { precision: 10, scale: 2 }),
  dataEmissao: timestamp("dataEmissao"),
  clienteNome: varchar("clienteNome", { length: 256 }),
  clienteCpfCnpj: varchar("clienteCpfCnpj", { length: 32 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type NotaFiscal = typeof notasFiscais.$inferSelect;
export type InsertNotaFiscal = typeof notasFiscais.$inferInsert;

// ─── Expedições ──────────────────────────────────────────────────────────────
export const expedicoes = pgTable("expedicoes", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: integer("pedidoId"),
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Expedicao = typeof expedicoes.$inferSelect;
export type InsertExpedicao = typeof expedicoes.$inferInsert;

// ─── Contas a Receber ────────────────────────────────────────────────────────
export const contasReceber = pgTable("contas_receber", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  pedidoId: integer("pedidoId"),
  descricao: text("descricao"),
  clienteNome: varchar("clienteNome", { length: 256 }),
  valor: numeric("valor", { precision: 10, scale: 2 }),
  valorRecebido: numeric("valorRecebido", { precision: 10, scale: 2 }).default("0"),
  status: text("status").$type<"aberto" | "recebido" | "cancelado" | "vencido">().default("aberto"),
  dataVencimento: timestamp("dataVencimento"),
  dataRecebimento: timestamp("dataRecebimento"),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ContaReceber = typeof contasReceber.$inferSelect;
export type InsertContaReceber = typeof contasReceber.$inferInsert;

// ─── Contas a Pagar ──────────────────────────────────────────────────────────
export const contasPagar = pgTable("contas_pagar", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  descricao: text("descricao"),
  fornecedorNome: varchar("fornecedorNome", { length: 256 }),
  valor: numeric("valor", { precision: 10, scale: 2 }),
  valorPago: numeric("valorPago", { precision: 10, scale: 2 }).default("0"),
  status: text("status").$type<"aberto" | "pago" | "cancelado" | "vencido">().default("aberto"),
  dataVencimento: timestamp("dataVencimento"),
  dataPagamento: timestamp("dataPagamento"),
  formaPagamento: varchar("formaPagamento", { length: 128 }),
  rawData: text("rawData"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ContaPagar = typeof contasPagar.$inferSelect;
export type InsertContaPagar = typeof contasPagar.$inferInsert;

// ─── Vendedores ─────────────────────────────────────────────────────────────
export const vendedores = pgTable("vendedores", {
  id: serial("id").primaryKey(),
  olistId: varchar("olistId", { length: 64 }).unique(),
  nome: varchar("nome", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }),
  comissaoPerc: numeric("comissaoPerc", { precision: 5, scale: 2 }).default("0"),
  ativo: text("ativo").$type<"S" | "N">().default("S"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Vendedor = typeof vendedores.$inferSelect;
export type InsertVendedor = typeof vendedores.$inferInsert;

// ─── Metas Mensais ───────────────────────────────────────────────────────────
export const metas = pgTable("metas", {
  id: serial("id").primaryKey(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  vendedorId: integer("vendedorId"),
  valorMeta: numeric("valorMeta", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Meta = typeof metas.$inferSelect;
export type InsertMeta = typeof metas.$inferInsert;

// ─── Comissões Pagas ─────────────────────────────────────────────────────────
export const comissoesPagas = pgTable("comissoes_pagas", {
  id: serial("id").primaryKey(),
  vendedorId: integer("vendedorId").notNull(),
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  valorComissao: numeric("valorComissao", { precision: 10, scale: 2 }).notNull(),
  valorVendas: numeric("valorVendas", { precision: 12, scale: 2 }).notNull(),
  pago: text("pago").$type<"S" | "N">().default("N"),
  dataPagamento: timestamp("dataPagamento"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type ComissaoPaga = typeof comissoesPagas.$inferSelect;
export type InsertComissaoPaga = typeof comissoesPagas.$inferInsert;

// ─── Logs de Webhooks ────────────────────────────────────────────────────────
export const webhookLogs = pgTable("webhook_logs", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 64 }).notNull(),
  evento: varchar("evento", { length: 128 }),
  payload: text("payload"),
  status: text("status").$type<"processado" | "erro" | "ignorado">().default("processado"),
  erroMsg: text("erroMsg"),
  ip: varchar("ip", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type InsertWebhookLog = typeof webhookLogs.$inferInsert;
