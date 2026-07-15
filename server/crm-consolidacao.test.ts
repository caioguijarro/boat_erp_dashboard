import { describe, expect, it } from "vitest";
import { consolidarClientes, recenciaBucket, type CrmCliente } from "./db";

function cliente(over: Partial<CrmCliente>): CrmCliente {
  return {
    clienteKey: "k",
    clienteNome: "Cliente",
    clienteCpfCnpj: null,
    email: null,
    telefone: null,
    whatsapp: null,
    totalPedidos: 1,
    ltv: 100,
    ticketMedio: 100,
    ultimaCompra: new Date("2026-06-01"),
    diasDesdeUltima: 40,
    bucket: recenciaBucket(40),
    status: "a_contatar",
    notas: null,
    ultimoContato: null,
    proximoFollowup: null,
    olistContatoId: null,
    ...over,
  };
}

describe("consolidarClientes (item 1 — nunca duplicar cards)", () => {
  it("mescla registro só-nome no registro de CPF de mesmo nome", () => {
    const comCpf = cliente({
      clienteKey: "12345678900", clienteCpfCnpj: "123.456.789-00", clienteNome: "João da Silva",
      totalPedidos: 2, ltv: 200, telefone: null, ultimaCompra: new Date("2026-05-01"), diasDesdeUltima: 70,
    });
    const soNome = cliente({
      clienteKey: "nome:joão da silva", clienteNome: "João  da   Silva", // espaços/caixa diferentes
      totalPedidos: 3, ltv: 300, telefone: "(13) 90000-0000", ultimaCompra: new Date("2026-06-10"), diasDesdeUltima: 30,
    });

    const out = consolidarClientes([comCpf, soNome]);

    expect(out).toHaveLength(1);
    const c = out[0];
    expect(c.clienteKey).toBe("12345678900"); // mantém a identidade do CPF
    expect(c.totalPedidos).toBe(5);           // 2 + 3
    expect(c.ltv).toBe(500);                  // 200 + 300
    expect(c.ticketMedio).toBe(100);          // 500 / 5
    expect(c.telefone).toBe("(13) 90000-0000"); // preenche telefone que faltava
    // última compra e recência vêm do registro mais recente (só-nome)
    expect(c.ultimaCompra).toEqual(new Date("2026-06-10"));
    expect(c.diasDesdeUltima).toBe(30);
  });

  it("não mescla dois CPFs distintos, mesmo com nomes iguais", () => {
    const a = cliente({ clienteKey: "111", clienteCpfCnpj: "111", clienteNome: "Maria" });
    const b = cliente({ clienteKey: "222", clienteCpfCnpj: "222", clienteNome: "Maria" });
    const out = consolidarClientes([a, b]);
    expect(out).toHaveLength(2);
  });

  it("mantém registro só-nome sem CPF correspondente", () => {
    const soNome = cliente({ clienteKey: "nome:cliente avulso", clienteNome: "Cliente Avulso" });
    const out = consolidarClientes([soNome]);
    expect(out).toHaveLength(1);
    expect(out[0].clienteKey).toBe("nome:cliente avulso");
  });

  it("nunca produz duas entradas com a mesma clienteKey", () => {
    const lista = [
      cliente({ clienteKey: "999", clienteCpfCnpj: "999", clienteNome: "Ana" }),
      cliente({ clienteKey: "nome:ana", clienteNome: "Ana" }),
      cliente({ clienteKey: "nome:bruno", clienteNome: "Bruno" }),
    ];
    const out = consolidarClientes(lista);
    const keys = out.map((c) => c.clienteKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
