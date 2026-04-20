import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { ENV } from "./_core/env.js";
import { sdk } from "./_core/sdk.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getProdutos, getProdutosBaixoEstoque, getProdutoCategorias,
  getPedidos, getPedidoById, getItensPedido, getVendasPorPeriodo, getVendasPorDia, getPedidosPorStatus,
  getNotasFiscais, getExpedicaoPorPedido,
  getContasReceber, getTotalContasReceber,
  getContasPagar, getTotalContasPagar,
  getWebhookLogs, getResumoEstoque,
  upsertUser,
  upsertProduto, upsertPedido, upsertItemPedido, upsertContaReceber, upsertContaPagar, insertWebhookLog,
  getDb,
  // Analíticos v2
  getVendedores, upsertVendedor, updateVendedorComissao,
  getMetas, upsertMeta,
  getComissoesPagas, upsertComissaoPaga, marcarComissaoPaga,
  getVendasPorVendedor, getInadimplencia, getTopClientes, getConciliacao,
} from "./db.js";
import { invokeLLM } from "./_core/llm.js";
import { notifyOwner } from "./_core/notification.js";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req as any);
      (ctx.res as any).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    loginWithPassword: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        if (!ENV.adminPassword || input.password !== ENV.adminPassword) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha incorreta" });
        }
        const openId = "password-admin";
        await upsertUser({
          openId,
          name: ENV.localAuthName,
          email: ENV.localAuthEmail,
          loginMethod: "password",
          lastSignedIn: new Date(),
        });
        const sessionToken = await sdk.createSessionToken(openId, {
          name: ENV.localAuthName,
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req as any);
        (ctx.res as any).cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true } as const;
      }),
  }),

  // ─── Dashboard / Métricas ─────────────────────────────────────────────────
  dashboard: router({
    metricas: protectedProcedure.query(async () => {
      const hoje = new Date();
      const inicioDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

      const [vendasHoje, vendasMes, pedidosPorStatus, resumoEstoque, totalReceber, totalPagar] = await Promise.all([
        getVendasPorPeriodo(inicioDia, fimDia),
        getVendasPorPeriodo(inicioMes, hoje),
        getPedidosPorStatus(),
        getResumoEstoque(),
        getTotalContasReceber(),
        getTotalContasPagar(),
      ]);

      const pedidosPendentes = pedidosPorStatus.find(p => p.status === "pendente")?.quantidade ?? 0;
      const pedidosEmAndamento = pedidosPorStatus.find(p => p.status === "em_andamento")?.quantidade ?? 0;

      return {
        vendasHoje: Number(vendasHoje.total),
        quantidadeHoje: Number(vendasHoje.quantidade),
        vendasMes: Number(vendasMes.total),
        quantidadeMes: Number(vendasMes.quantidade),
        pedidosPendentes: Number(pedidosPendentes) + Number(pedidosEmAndamento),
        pedidosPorStatus,
        estoque: resumoEstoque,
        contasReceber: totalReceber,
        contasPagar: totalPagar,
      };
    }),

    graficoVendas: protectedProcedure
      .input(z.object({ dias: z.number().min(7).max(90).default(30) }))
      .query(async ({ input }) => {
        const fim = new Date();
        const inicio = new Date();
        inicio.setDate(inicio.getDate() - input.dias);
        return getVendasPorDia(inicio, fim);
      }),
  }),

  // ─── Pedidos ──────────────────────────────────────────────────────────────
  pedidos: router({
    listar: protectedProcedure
      .input(z.object({
        status: z.string().optional(),
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => getPedidos(input)),

    detalhe: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const [pedido, itens, expedicao] = await Promise.all([
          getPedidoById(input.id),
          getItensPedido(input.id),
          getExpedicaoPorPedido(input.id),
        ]);
        return { pedido, itens, expedicao };
      }),

    statusDisponiveis: protectedProcedure.query(async () => {
      const statuses = await getPedidosPorStatus();
      return statuses.map(s => s.status).filter(Boolean);
    }),
  }),

  // ─── Estoque / Produtos ───────────────────────────────────────────────────
  estoque: router({
    listar: protectedProcedure
      .input(z.object({
        categoria: z.string().optional(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
        apenasAlerta: z.boolean().optional(),
        apenasSemEstoque: z.boolean().optional(),
      }))
      .query(async ({ input }) => getProdutos(input.categoria, input.limit, input.offset, input.apenasAlerta, input.apenasSemEstoque)),

    baixoEstoque: protectedProcedure.query(async () => getProdutosBaixoEstoque()),

    categorias: protectedProcedure.query(async () => getProdutoCategorias()),

    resumo: protectedProcedure.query(async () => getResumoEstoque()),
  }),

  // ─── Financeiro ───────────────────────────────────────────────────────────
  financeiro: router({
    contasReceber: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => getContasReceber(input.status)),

    contasPagar: protectedProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => getContasPagar(input.status)),

    resumo: protectedProcedure.query(async () => {
      const [receber, pagar] = await Promise.all([
        getTotalContasReceber(),
        getTotalContasPagar(),
      ]);
      return {
        receber,
        pagar,
        saldoProjetado: Number(receber.aberto) - Number(pagar.aberto),
      };
    }),
  }),

  // ─── Notas Fiscais ────────────────────────────────────────────────────────
  notasFiscais: router({
    listar: protectedProcedure
      .input(z.object({ status: z.string().optional(), limit: z.number().default(50), offset: z.number().default(0) }))
      .query(async ({ input }) => getNotasFiscais(input)),
  }),

  // ─── Webhook Logs ─────────────────────────────────────────────────────────
  webhooks: router({
    logs: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(200).default(50) }))
      .query(async ({ input }) => getWebhookLogs(input.limit)),
  }),

  // ─── Demo / Seed ─────────────────────────────────────────────────────────
  demo: router({
    seed: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");

      // Limpar dados existentes
      await db.execute("DELETE FROM itens_pedido");
      await db.execute("DELETE FROM pedidos");
      await db.execute("DELETE FROM produtos");
      await db.execute("DELETE FROM contas_receber");
      await db.execute("DELETE FROM contas_pagar");
      await db.execute("DELETE FROM webhook_logs");

      // Produtos Boat Beer
      const produtosList = [
        { olistId: "P001", nome: "Boat Beer Lager 350ml", codigo: "BOAT-LAGER-350", categoria: "Cerveja", preco: "12.90", estoqueAtual: "480", estoqueMinimo: "100", ativo: "S" as const },
        { olistId: "P002", nome: "Boat Beer IPA 473ml", codigo: "BOAT-IPA-473", categoria: "Cerveja", preco: "18.90", estoqueAtual: "35", estoqueMinimo: "80", ativo: "S" as const },
        { olistId: "P003", nome: "Boat Beer Weiss 500ml", codigo: "BOAT-WEISS-500", categoria: "Cerveja", preco: "16.90", estoqueAtual: "0", estoqueMinimo: "60", ativo: "S" as const },
        { olistId: "P004", nome: "Boat Beer Pack 6un Lager", codigo: "BOAT-PACK6-LAGER", categoria: "Pack", preco: "69.90", estoqueAtual: "120", estoqueMinimo: "30", ativo: "S" as const },
        { olistId: "P005", nome: "Boat Beer Pack 12un Lager", codigo: "BOAT-PACK12-LAGER", categoria: "Pack", preco: "129.90", estoqueAtual: "55", estoqueMinimo: "20", ativo: "S" as const },
        { olistId: "P006", nome: "Copo Boat Beer 500ml", codigo: "BOAT-COPO-500", categoria: "Acessórios", preco: "29.90", estoqueAtual: "200", estoqueMinimo: "50", ativo: "S" as const },
        { olistId: "P007", nome: "Camiseta Boat Beer P", codigo: "BOAT-CAMISA-P", categoria: "Vestuário", preco: "89.90", estoqueAtual: "15", estoqueMinimo: "20", ativo: "S" as const },
        { olistId: "P008", nome: "Boat Beer Sem Álcool 350ml", codigo: "BOAT-SA-350", categoria: "Cerveja", preco: "10.90", estoqueAtual: "320", estoqueMinimo: "80", ativo: "S" as const },
      ];
      for (const p of produtosList) await upsertProduto(p);

      // Pedidos dos últimos 30 dias
      const statusList = ["aprovado", "aprovado", "aprovado", "em_separacao", "enviado", "entregue", "entregue", "pendente", "cancelado"];
      const clientes = ["João Silva", "Maria Santos", "Pedro Alves", "Ana Costa", "Carlos Lima", "Fernanda Rocha", "Bruno Martins", "Juliana Ferreira", "Ricardo Souza", "Camila Oliveira"];
      const pedidosIds: number[] = [];

      for (let i = 0; i < 45; i++) {
        const diasAtras = Math.floor(Math.random() * 30);
        const dataPedido = new Date();
        dataPedido.setDate(dataPedido.getDate() - diasAtras);
        const status = statusList[Math.floor(Math.random() * statusList.length)];
        const cliente = clientes[Math.floor(Math.random() * clientes.length)];
        const total = (Math.random() * 400 + 50).toFixed(2);
        const numero = `BOAT-${String(2026001 + i).padStart(6, "0")}`;

        await upsertPedido({
          olistId: `PED${1000 + i}`,
          numero,
          status,
          clienteNome: cliente,
          clienteEmail: `${cliente.toLowerCase().replace(" ", ".")}@email.com`,
          dataPedido,
          totalPedido: total,
          totalFrete: (Math.random() * 30).toFixed(2),
          totalDesconto: "0.00",
          canal: ["Shopee", "Mercado Livre", "Site Próprio", "Instagram"][Math.floor(Math.random() * 4)],
        });

        // Buscar o ID do pedido inserido
        const pedidosDb = await getPedidos({ limit: 1, offset: 0 });
        if (pedidosDb.length > 0 && pedidosDb[0].id) pedidosIds.push(pedidosDb[0].id);
      }

      // Contas a Receber
      const contasReceberList = [
        { olistId: "CR001", descricao: "Pedido BOAT-2026001", valor: "1250.00", dataVencimento: new Date(Date.now() + 5*24*60*60*1000), status: "aberto" as const },
        { olistId: "CR002", descricao: "Pedido BOAT-2026002", valor: "890.50", dataVencimento: new Date(Date.now() + 12*24*60*60*1000), status: "aberto" as const },
        { olistId: "CR003", descricao: "Pedido BOAT-2026003", valor: "2100.00", dataVencimento: new Date(Date.now() - 3*24*60*60*1000), status: "vencido" as const },
        { olistId: "CR004", descricao: "Pedido BOAT-2026004", valor: "450.00", dataVencimento: new Date(Date.now() - 10*24*60*60*1000), status: "vencido" as const },
        { olistId: "CR005", descricao: "Pedido BOAT-2026005", valor: "3200.00", dataVencimento: new Date(Date.now() - 30*24*60*60*1000), status: "recebido" as const, valorRecebido: "3200.00", dataRecebimento: new Date(Date.now() - 28*24*60*60*1000) },
        { olistId: "CR006", descricao: "Pedido BOAT-2026006", valor: "780.00", dataVencimento: new Date(Date.now() + 20*24*60*60*1000), status: "aberto" as const },
      ];
      for (const c of contasReceberList) await upsertContaReceber(c);

      // Contas a Pagar
      const contasPagarList = [
        { olistId: "CP001", descricao: "Fornecedor Malte Premium", valor: "4500.00", dataVencimento: new Date(Date.now() + 8*24*60*60*1000), status: "aberto" as const },
        { olistId: "CP002", descricao: "Aluguel Galpão Santos", valor: "3200.00", dataVencimento: new Date(Date.now() + 15*24*60*60*1000), status: "aberto" as const },
        { olistId: "CP003", descricao: "Fornecedor Lúpulo", valor: "1800.00", dataVencimento: new Date(Date.now() - 5*24*60*60*1000), status: "vencido" as const },
        { olistId: "CP004", descricao: "Energia Elétrica", valor: "920.00", dataVencimento: new Date(Date.now() - 2*24*60*60*1000), status: "vencido" as const },
        { olistId: "CP005", descricao: "Fornecedor Embalagens", valor: "2100.00", dataVencimento: new Date(Date.now() - 20*24*60*60*1000), status: "pago" as const, valorPago: "2100.00", dataPagamento: new Date(Date.now() - 18*24*60*60*1000) },
      ];
      for (const c of contasPagarList) await upsertContaPagar(c);

      // Log de webhook de demonstração
      await insertWebhookLog({ tipo: "pedidos", payload: JSON.stringify({ evento: "seed_demo", mensagem: "Dados de demonstração carregados" }), status: "processado" });

      return { sucesso: true, mensagem: "Dados de demonstração carregados com sucesso!" };
    }),

    limpar: protectedProcedure.mutation(async () => {
      const db = await getDb();
      if (!db) throw new Error("DB não disponível");
      await db.execute("DELETE FROM itens_pedido");
      await db.execute("DELETE FROM pedidos");
      await db.execute("DELETE FROM produtos");
      await db.execute("DELETE FROM contas_receber");
      await db.execute("DELETE FROM contas_pagar");
      await db.execute("DELETE FROM webhook_logs");
      return { sucesso: true, mensagem: "Dados limpos com sucesso!" };
    }),
  }),

  // ─── Insights LLM ────────────────────────────────────────────────────────
  insights: router({
    analisar: protectedProcedure
      .input(z.object({ tipo: z.enum(["vendas", "estoque", "financeiro", "resumo_semanal"]) }))
      .mutation(async ({ input }) => {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        const inicioSemana = new Date();
        inicioSemana.setDate(inicioSemana.getDate() - 7);

        let contexto = "";
        let prompt = "";

        if (input.tipo === "vendas" || input.tipo === "resumo_semanal") {
          const [vendasMes, vendasSemana, pedidosStatus] = await Promise.all([
            getVendasPorPeriodo(inicioMes, hoje),
            getVendasPorPeriodo(inicioSemana, hoje),
            getPedidosPorStatus(),
          ]);
          contexto += `Vendas do mês: R$ ${vendasMes.total} (${vendasMes.quantidade} pedidos)\n`;
          contexto += `Vendas da semana: R$ ${vendasSemana.total} (${vendasSemana.quantidade} pedidos)\n`;
          contexto += `Status dos pedidos: ${JSON.stringify(pedidosStatus)}\n`;
        }

        if (input.tipo === "estoque" || input.tipo === "resumo_semanal") {
          const [resumo, baixoEstoque] = await Promise.all([
            getResumoEstoque(),
            getProdutosBaixoEstoque(),
          ]);
          contexto += `Resumo estoque: ${JSON.stringify(resumo)}\n`;
          contexto += `Produtos com baixo estoque: ${baixoEstoque.map(p => `${p.nome} (atual: ${p.estoqueAtual}, mínimo: ${p.estoqueMinimo})`).join(", ")}\n`;
        }

        if (input.tipo === "financeiro" || input.tipo === "resumo_semanal") {
          const [receber, pagar] = await Promise.all([
            getTotalContasReceber(),
            getTotalContasPagar(),
          ]);
          contexto += `Contas a receber: R$ ${receber.aberto} em aberto, R$ ${receber.vencido} vencido\n`;
          contexto += `Contas a pagar: R$ ${pagar.aberto} em aberto, R$ ${pagar.vencido} vencido\n`;
        }

        const prompts: Record<string, string> = {
          vendas: `Analise os dados de vendas da Boat Beer Company (cervejaria artesanal de Santos-SP, focada em performance beer e lifestyle ativo) e forneça: 1) Análise das tendências de vendas, 2) Comparação com períodos anteriores, 3) Recomendações estratégicas para aumentar as vendas. Seja específico e prático.`,
          estoque: `Analise os dados de estoque da Boat Beer Company e forneça: 1) Produtos que precisam de reposição urgente, 2) Sugestões de quantidade de reposição baseadas no histórico, 3) Alertas de risco operacional. Seja específico e prático.`,
          financeiro: `Analise a situação financeira da Boat Beer Company e forneça: 1) Análise do fluxo de caixa, 2) Riscos de inadimplência, 3) Recomendações para melhorar o capital de giro. Seja específico e prático.`,
          resumo_semanal: `Gere um resumo executivo semanal completo para a Boat Beer Company (cervejaria artesanal de Santos-SP). Inclua: 1) Destaques de vendas, 2) Situação do estoque, 3) Saúde financeira, 4) Principais riscos e oportunidades, 5) Ações recomendadas para a próxima semana. Formato executivo, direto e acionável.`,
        };

        prompt = prompts[input.tipo];

        const response = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um analista de negócios especializado em empresas de bebidas e varejo brasileiro. Analise os dados fornecidos e gere insights práticos e acionáveis. Responda sempre em português brasileiro." },
            { role: "user", content: `${prompt}\n\nDados atuais:\n${contexto}` },
          ],
        });

        const content = response.choices?.[0]?.message?.content ?? "Não foi possível gerar análise.";
        return { analise: content, tipo: input.tipo, geradoEm: new Date() };
      }),
  }),

  // ─── Vendedores ───────────────────────────────────────────────────────────────
  vendedores: router({
    listar: protectedProcedure.query(async () => {
      return getVendedores();
    }),

    salvar: protectedProcedure
      .input(z.object({
        id: z.number().optional(),
        nome: z.string(),
        olistId: z.string().optional(),
        comissaoPerc: z.string().default("0"),
        ativo: z.enum(["S", "N"]).default("S"),
      }))
      .mutation(async ({ input }) => {
        if (input.id) {
          await updateVendedorComissao(input.id, input.comissaoPerc);
        } else {
          await upsertVendedor({ nome: input.nome, olistId: input.olistId, comissaoPerc: input.comissaoPerc, ativo: input.ativo });
        }
        return { sucesso: true };
      }),

    atualizarComissao: protectedProcedure
      .input(z.object({ id: z.number(), comissaoPerc: z.string() }))
      .mutation(async ({ input }) => {
        await updateVendedorComissao(input.id, input.comissaoPerc);
        return { sucesso: true };
      }),
  }),

  // ─── Metas ─────────────────────────────────────────────────────────────────────
  metas: router({
    listar: protectedProcedure
      .input(z.object({ ano: z.number().optional(), mes: z.number().optional() }))
      .query(async ({ input }) => {
        return getMetas(input.ano, input.mes);
      }),

    salvar: protectedProcedure
      .input(z.object({
        ano: z.number(),
        mes: z.number(),
        vendedorId: z.number().nullable().optional(),
        valorMeta: z.string(),
      }))
      .mutation(async ({ input }) => {
        await upsertMeta(input);
        return { sucesso: true };
      }),
  }),

  // ─── Comissões ──────────────────────────────────────────────────────────────────
  comissoes: router({
    listar: protectedProcedure
      .input(z.object({ vendedorId: z.number().optional(), ano: z.number().optional() }))
      .query(async ({ input }) => {
        return getComissoesPagas(input.vendedorId, input.ano);
      }),

    marcarPago: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await marcarComissaoPaga(input.id);
        return { sucesso: true };
      }),

    registrar: protectedProcedure
      .input(z.object({
        vendedorId: z.number(),
        ano: z.number(),
        mes: z.number(),
        valorVendas: z.string(),
        valorComissao: z.string(),
        pago: z.enum(["S", "N"]).default("N"),
      }))
      .mutation(async ({ input }) => {
        await upsertComissaoPaga(input);
        return { sucesso: true };
      }),
  }),

  // ─── Analytics ──────────────────────────────────────────────────────────────────
  analytics: router({
    vendasPorVendedor: protectedProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        const [vendas, vendedoresList, metasList] = await Promise.all([
          getVendasPorVendedor(input.dataInicio, input.dataFim),
          getVendedores(),
          getMetas(input.dataInicio.getFullYear(), input.dataInicio.getMonth() + 1),
        ]);

        // Enriquecer com comissão e meta
        return vendas.map(v => {
          const vendedor = vendedoresList.find(vd => vd.olistId === v.vendedor_id || vd.nome === v.vendedor_nome);
          const meta = metasList.find(m => m.vendedorId === vendedor?.id);
          const comissaoPerc = parseFloat(vendedor?.comissaoPerc ?? "0");
          const totalVendas = Number(v.total_vendas);
          const comissaoValor = (totalVendas * comissaoPerc) / 100;
          const metaValor = meta ? Number(meta.valorMeta) : 0;
          const percMeta = metaValor > 0 ? (totalVendas / metaValor) * 100 : 0;
          return {
            vendedorId: vendedor?.id,
            vendedorNome: v.vendedor_nome,
            totalVendas,
            quantidadePedidos: Number(v.quantidade_pedidos),
            comissaoPerc,
            comissaoValor,
            metaValor,
            percMeta,
          };
        });
      }),

    tendenciaVendas: protectedProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
        vendedorId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        if (!input.vendedorId) {
          return getVendasPorDia(input.dataInicio, input.dataFim);
        }

        const vendedor = (await getVendedores()).find(v => v.id === input.vendedorId);
        if (!vendedor) return [];

        const db = await getDb();
        if (!db) return [];

        const { sql } = await import("drizzle-orm");
        const result = await db.execute(
          sql`SELECT
                TO_CHAR("dataPedido", 'YYYY-MM-DD') as dia,
                COALESCE(SUM("totalPedido"), 0) as total,
                COUNT(*) as quantidade
              FROM pedidos
              WHERE "dataPedido" >= ${input.dataInicio}
                AND "dataPedido" <= ${input.dataFim}
                AND status NOT IN ('cancelado', 'recusado')
                AND canal LIKE ${`vendedor:${vendedor.olistId ?? vendedor.id}:%`}
              GROUP BY dia
              ORDER BY dia`
        );

        const rows = result as unknown as Array<{
          dia: string;
          total: number;
          quantidade: number;
        }>;

        return rows.map(row => ({
          data: row.dia,
          total: Number(row.total),
          quantidade: Number(row.quantidade),
        }));
      }),

    inadimplencia: protectedProcedure
      .input(z.object({
        dataInicio: z.date().optional(),
        dataFim: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return getInadimplencia(input.dataInicio, input.dataFim);
      }),

    topClientes: protectedProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return getTopClientes(input.dataInicio, input.dataFim, input.limit);
      }),

    conciliacao: protectedProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return getConciliacao(input.dataInicio, input.dataFim);
      }),

    vendasPorDia: protectedProcedure
      .input(z.object({
        dataInicio: z.date(),
        dataFim: z.date(),
      }))
      .query(async ({ input }) => {
        return getVendasPorDia(input.dataInicio, input.dataFim);
      }),
  }),
});

export type AppRouter = typeof appRouter;
