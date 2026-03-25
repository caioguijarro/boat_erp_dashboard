import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database module
vi.mock("./db", () => ({
  getProdutos: vi.fn().mockResolvedValue([]),
  getProdutosBaixoEstoque: vi.fn().mockResolvedValue([]),
  getProdutoCategorias: vi.fn().mockResolvedValue([]),
  getPedidos: vi.fn().mockResolvedValue([]),
  getPedidoById: vi.fn().mockResolvedValue(null),
  getItensPedido: vi.fn().mockResolvedValue([]),
  getVendasPorPeriodo: vi.fn().mockResolvedValue({ total: "0", quantidade: "0" }),
  getVendasPorDia: vi.fn().mockResolvedValue([]),
  getPedidosPorStatus: vi.fn().mockResolvedValue([]),
  getNotasFiscais: vi.fn().mockResolvedValue([]),
  getExpedicaoPorPedido: vi.fn().mockResolvedValue(null),
  getContasReceber: vi.fn().mockResolvedValue([]),
  getTotalContasReceber: vi.fn().mockResolvedValue({ aberto: "0", recebido: "0", vencido: "0", total: "0" }),
  getContasPagar: vi.fn().mockResolvedValue([]),
  getTotalContasPagar: vi.fn().mockResolvedValue({ aberto: "0", pago: "0", vencido: "0", total: "0" }),
  getWebhookLogs: vi.fn().mockResolvedValue([]),
  getResumoEstoque: vi.fn().mockResolvedValue({ total: 0, baixoEstoque: 0, semEstoque: 0 }),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "Análise de teste gerada pela IA." } }],
  }),
}));

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-openid",
    email: "test@boatbeer.com",
    name: "Boat Beer Admin",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("retorna o usuário autenticado", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Boat Beer Admin");
    expect(result?.email).toBe("test@boatbeer.com");
  });
});

describe("dashboard.metricas", () => {
  it("retorna métricas do dashboard sem erros", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.metricas();
    expect(result).toBeDefined();
    expect(typeof result.vendasHoje).toBe("number");
    expect(typeof result.vendasMes).toBe("number");
    expect(typeof result.pedidosPendentes).toBe("number");
    expect(result.estoque).toBeDefined();
    expect(result.contasReceber).toBeDefined();
    expect(result.contasPagar).toBeDefined();
  });

  it("retorna gráfico de vendas por dia", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dashboard.graficoVendas({ dias: 30 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("estoque.listar", () => {
  it("retorna lista de produtos vazia quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.estoque.listar({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("retorna resumo de estoque", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.estoque.resumo();
    expect(result).toBeDefined();
    expect(typeof result.total).toBe("number");
    expect(typeof result.baixoEstoque).toBe("number");
    expect(typeof result.semEstoque).toBe("number");
  });
});

describe("pedidos.listar", () => {
  it("retorna lista de pedidos vazia quando não há dados", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.pedidos.listar({});
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("financeiro.resumo", () => {
  it("retorna resumo financeiro com saldo projetado", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.financeiro.resumo();
    expect(result).toBeDefined();
    expect(result.receber).toBeDefined();
    expect(result.pagar).toBeDefined();
    expect(typeof result.saldoProjetado).toBe("number");
  });
});

describe("webhooks.logs", () => {
  it("retorna logs de webhook", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webhooks.logs({ limit: 10 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("insights.analisar", () => {
  it("gera análise de vendas com LLM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.analisar({ tipo: "vendas" });
    expect(result).toBeDefined();
    expect(result.tipo).toBe("vendas");
    expect(typeof result.analise === "string" || Array.isArray(result.analise)).toBe(true);
  });

  it("gera resumo semanal com LLM", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.insights.analisar({ tipo: "resumo_semanal" });
    expect(result).toBeDefined();
    expect(result.tipo).toBe("resumo_semanal");
  });
});
