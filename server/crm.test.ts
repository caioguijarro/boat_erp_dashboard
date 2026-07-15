import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { ENV } from "./_core/env";
import { olistPostWithRetry } from "./olistClient";
import {
  getCrmClientes, getCrmTarefas, getCrmContatoByKey, getCrmContatosComTelefone,
  upsertCrmContato, updateCrmContatoStatus, appendCrmNota, agendarCrmFollowup,
} from "./db";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  // Helpers CRM (exercitados pelos testes)
  getCrmClientes: vi.fn().mockResolvedValue([]),
  getCrmTarefas: vi.fn().mockResolvedValue([]),
  getCrmContatoByKey: vi.fn().mockResolvedValue(null),
  getCrmContatosComTelefone: vi.fn().mockResolvedValue([]),
  upsertCrmContato: vi.fn().mockResolvedValue(undefined),
  updateCrmContatoStatus: vi.fn().mockResolvedValue(undefined),
  appendCrmNota: vi.fn().mockResolvedValue(undefined),
  agendarCrmFollowup: vi.fn().mockResolvedValue(undefined),
  insertWebhookLog: vi.fn().mockResolvedValue(undefined),
  // Demais exports usados no topo de routers.ts (não chamados nestes testes)
  getProdutos: vi.fn(), getProdutosBaixoEstoque: vi.fn(), getProdutoCategorias: vi.fn(),
  getPedidos: vi.fn(), getPedidoById: vi.fn(), getItensPedido: vi.fn(),
  getVendasPorPeriodo: vi.fn(), getVendasPorDia: vi.fn(), getPedidosPorStatus: vi.fn(),
  getNotasFiscais: vi.fn(), getExpedicaoPorPedido: vi.fn(),
  getContasReceber: vi.fn(), getTotalContasReceber: vi.fn(),
  getContasPagar: vi.fn(), getTotalContasPagar: vi.fn(),
  getWebhookLogs: vi.fn(), getResumoEstoque: vi.fn(),
  upsertUser: vi.fn(), upsertProduto: vi.fn(), upsertPedido: vi.fn(),
  upsertItemPedido: vi.fn(), upsertContaReceber: vi.fn(), upsertContaPagar: vi.fn(),
  getDb: vi.fn(), getVendedores: vi.fn(), upsertVendedor: vi.fn(), updateVendedorComissao: vi.fn(),
  getMetas: vi.fn(), upsertMeta: vi.fn(), getComissoesPagas: vi.fn(),
  upsertComissaoPaga: vi.fn(), marcarComissaoPaga: vi.fn(),
  getVendasPorVendedor: vi.fn(), getInadimplencia: vi.fn(), getTopClientes: vi.fn(), getConciliacao: vi.fn(),
}));

// Cliente Olist mockado: capturamos as chamadas de obter/alterar/incluir.
vi.mock("./olistClient", () => ({
  olistPostWithRetry: vi.fn(),
}));

// ENV mutável para alternar a flag de write-back entre testes.
vi.mock("./_core/env", () => ({
  ENV: { olistApiToken: "test-token", olistWritebackEnabled: true },
}));

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn() }));

// ─── Contexto autenticado ──────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1, openId: "test-user-openid", email: "test@boatbeer.com", name: "Boat Beer Admin",
    loginMethod: "manus", role: "admin",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const caller = () => appRouter.createCaller(createAuthContext());

beforeEach(() => {
  vi.clearAllMocks();
  ENV.olistWritebackEnabled = true;
});

// ─── Buckets de recência (função pura, versão real) ─────────────────────────────

describe("recenciaBucket", () => {
  it("classifica os dias sem comprar na faixa correta", async () => {
    const { recenciaBucket } = await vi.importActual<typeof import("./db")>("./db");
    expect(recenciaBucket(0)).toBe("ativos");
    expect(recenciaBucket(29)).toBe("ativos");
    expect(recenciaBucket(30)).toBe("d30_59");
    expect(recenciaBucket(59)).toBe("d30_59");
    expect(recenciaBucket(60)).toBe("d60_89");
    expect(recenciaBucket(89)).toBe("d60_89");
    expect(recenciaBucket(90)).toBe("d90_119");
    expect(recenciaBucket(119)).toBe("d90_119");
    expect(recenciaBucket(120)).toBe("d120_179");
    expect(recenciaBucket(179)).toBe("d120_179");
    expect(recenciaBucket(180)).toBe("d180_plus");
    expect(recenciaBucket(500)).toBe("d180_plus");
  });
});

// ─── Router: listar / tarefas ───────────────────────────────────────────────────

describe("crm.listar", () => {
  it("retorna os clientes consolidados", async () => {
    const fake = [{ clienteKey: "111", clienteNome: "João", bucket: "d30_59", ltv: 500 }];
    vi.mocked(getCrmClientes).mockResolvedValueOnce(fake as any);
    const result = await caller().crm.listar();
    expect(getCrmClientes).toHaveBeenCalledOnce();
    expect(result).toEqual(fake);
  });
});

describe("crm.tarefas", () => {
  it("retorna os follow-ups (delegando a getCrmTarefas)", async () => {
    const fake = [{ clienteKey: "999", clienteNome: "Maria", ltv: 9000 }];
    vi.mocked(getCrmTarefas).mockResolvedValueOnce(fake as any);
    const result = await caller().crm.tarefas();
    expect(getCrmTarefas).toHaveBeenCalledOnce();
    expect(result).toEqual(fake);
  });
});

describe("crm.listar — período do LTV", () => {
  it("sem período consulta o histórico todo (ltvDesde undefined)", async () => {
    await caller().crm.listar(undefined);
    expect(getCrmClientes).toHaveBeenCalledWith({ ltvDesde: undefined });
  });

  it("com periodoLtvDias passa uma data de corte", async () => {
    await caller().crm.listar({ periodoLtvDias: 90 });
    const arg = vi.mocked(getCrmClientes).mock.calls.at(-1)?.[0];
    expect(arg?.ltvDesde).toBeInstanceOf(Date);
    const diffDias = (Date.now() - (arg!.ltvDesde as Date).getTime()) / 86_400_000;
    expect(Math.round(diffDias)).toBe(90);
  });
});

describe("crm.sincronizarTelefones", () => {
  it("empurra ao Tiny os contatos com telefone e conta os resultados", async () => {
    ENV.olistWritebackEnabled = true;
    vi.mocked(getCrmContatosComTelefone).mockResolvedValueOnce([
      { clienteKey: "111", clienteCpfCnpj: "111", olistContatoId: "1", telefone: "(13) 90000-0000", whatsapp: null, email: null },
    ] as any);
    vi.mocked(olistPostWithRetry).mockImplementation(async (endpoint: string) => {
      if (endpoint === "contato.obter.php") return { contato: { id: "1", nome: "X", fone: "old" } };
      if (endpoint === "contato.alterar.php") return { registros: { registro: { id: "1" } } };
      return {};
    });

    const res = await caller().crm.sincronizarTelefones();
    expect(res.total).toBe(1);
    expect(res.updated).toBe(1);
    expect(res.errors).toBe(0);
  });
});

// ─── Router: mutações simples ───────────────────────────────────────────────────

describe("crm mutações de gestão", () => {
  it("atualizarStatus persiste o novo status", async () => {
    await caller().crm.atualizarStatus({ clienteKey: "111", clienteCpfCnpj: "123", status: "contatado" });
    expect(updateCrmContatoStatus).toHaveBeenCalledWith("111", "contatado", "123");
  });

  it("adicionarNota anexa a nota", async () => {
    await caller().crm.adicionarNota({ clienteKey: "111", clienteCpfCnpj: "123", nota: "Ligar amanhã" });
    expect(appendCrmNota).toHaveBeenCalledWith("111", "Ligar amanhã", "123");
  });

  it("agendarFollowup grava a data", async () => {
    const data = new Date("2026-08-01T12:00:00");
    await caller().crm.agendarFollowup({ clienteKey: "111", clienteCpfCnpj: "123", data });
    expect(agendarCrmFollowup).toHaveBeenCalledWith("111", data, "123");
  });
});

// ─── Router: editarContato + write-back (merge) ─────────────────────────────────

const CONTATO_COMPLETO = {
  id: "999",
  nome: "João da Silva",
  cpf_cnpj: "12345678900",
  tipo_pessoa: "F",
  fone: "(13) 1111-1111",
  celular: "(13) 90000-0000",
  email: "antigo@email.com",
  endereco: "Rua das Ondas",
  numero: "42",
  bairro: "Gonzaga",
  cidade: "Santos",
  uf: "SP",
  cep: "11000-000",
};

describe("crm.editarContato — write-back com merge", () => {
  it("preserva os campos não editados e sobrescreve apenas o telefone", async () => {
    ENV.olistWritebackEnabled = true;
    vi.mocked(getCrmContatoByKey).mockResolvedValueOnce({
      clienteKey: "12345678900", clienteCpfCnpj: "12345678900", olistContatoId: "999",
    } as any);

    vi.mocked(olistPostWithRetry).mockImplementation(async (endpoint: string) => {
      if (endpoint === "contato.obter.php") return { contato: { ...CONTATO_COMPLETO } };
      if (endpoint === "contato.alterar.php") return { registros: { registro: { id: "999" } } };
      return {};
    });

    const result = await caller().crm.editarContato({
      clienteKey: "12345678900",
      clienteCpfCnpj: "12345678900",
      nome: "João da Silva",
      telefone: "(13) 2222-2222",
    });

    expect(result.olist).toBe("updated");

    // Localiza a chamada de alteração e inspeciona o payload enviado.
    const alterarCall = vi.mocked(olistPostWithRetry).mock.calls.find(c => c[0] === "contato.alterar.php");
    expect(alterarCall).toBeDefined();
    const enviado = JSON.parse((alterarCall![1] as any).contato);

    // Campo editado foi sobrescrito...
    expect(enviado.fone).toBe("(13) 2222-2222");
    // ...e TODOS os demais campos foram preservados.
    expect(enviado.id).toBe("999");
    expect(enviado.nome).toBe("João da Silva");
    expect(enviado.cpf_cnpj).toBe("12345678900");
    expect(enviado.celular).toBe("(13) 90000-0000");
    expect(enviado.email).toBe("antigo@email.com");
    expect(enviado.endereco).toBe("Rua das Ondas");
    expect(enviado.bairro).toBe("Gonzaga");
    expect(enviado.cidade).toBe("Santos");
    expect(enviado.uf).toBe("SP");
    expect(enviado.cep).toBe("11000-000");

    // A gravação local (optimistic) sempre acontece.
    expect(upsertCrmContato).toHaveBeenCalled();
  });

  it("com write-back desativado grava só local e retorna 'skipped'", async () => {
    ENV.olistWritebackEnabled = false;
    vi.mocked(getCrmContatoByKey).mockResolvedValueOnce({
      clienteKey: "12345678900", clienteCpfCnpj: "12345678900", olistContatoId: "999",
    } as any);

    const result = await caller().crm.editarContato({
      clienteKey: "12345678900",
      clienteCpfCnpj: "12345678900",
      telefone: "(13) 2222-2222",
    });

    expect(result.olist).toBe("skipped");
    // Nenhuma chamada à API do Tiny.
    expect(olistPostWithRetry).not.toHaveBeenCalled();
    // Mas o valor foi gravado localmente.
    expect(upsertCrmContato).toHaveBeenCalled();
  });

  it("cria o contato no Tiny quando ele ainda não existe", async () => {
    ENV.olistWritebackEnabled = true;
    vi.mocked(getCrmContatoByKey).mockResolvedValueOnce(null);

    vi.mocked(olistPostWithRetry).mockImplementation(async (endpoint: string) => {
      if (endpoint === "contatos.pesquisa.php") return { contatos: [] };
      if (endpoint === "contato.obter.php") return { contato: null };
      if (endpoint === "contato.incluir.php") return { registros: { registro: { id: "777" } } };
      return {};
    });

    const result = await caller().crm.editarContato({
      clienteKey: "nome:cliente novo",
      nome: "Cliente Novo",
      telefone: "(13) 3333-3333",
      email: "novo@email.com",
    });

    expect(result.olist).toBe("created");
    const incluirCall = vi.mocked(olistPostWithRetry).mock.calls.find(c => c[0] === "contato.incluir.php");
    expect(incluirCall).toBeDefined();
    const enviado = JSON.parse((incluirCall![1] as any).contato);
    expect(enviado.nome).toBe("Cliente Novo");
    expect(enviado.fone).toBe("(13) 3333-3333");
    expect(enviado.email).toBe("novo@email.com");
  });
});

// ─── Router: enriquecerTelefone ─────────────────────────────────────────────────

describe("crm.enriquecerTelefone", () => {
  it("busca o telefone no Tiny e cacheia localmente", async () => {
    ENV.olistWritebackEnabled = true;
    vi.mocked(olistPostWithRetry).mockImplementation(async (endpoint: string) => {
      if (endpoint === "contatos.pesquisa.php") {
        return { contatos: [{ contato: { id: "1", celular: "(13) 98888-7777" } }] };
      }
      return {};
    });

    const result = await caller().crm.enriquecerTelefone({
      clienteKey: "111", clienteCpfCnpj: "12345678900", nome: "João",
    });

    expect(result.telefone).toBe("(13) 98888-7777");
    expect(upsertCrmContato).toHaveBeenCalledWith(
      expect.objectContaining({ clienteKey: "111", telefone: "(13) 98888-7777" }),
    );
  });
});
