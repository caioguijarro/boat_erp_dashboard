import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getProdutos, getProdutosBaixoEstoque, getProdutoCategorias,
  getPedidos, getPedidoById, getItensPedido, getVendasPorPeriodo, getVendasPorDia, getPedidosPorStatus,
  getNotasFiscais, getExpedicaoPorPedido,
  getContasReceber, getTotalContasReceber,
  getContasPagar, getTotalContasPagar,
  getWebhookLogs, getResumoEstoque,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
});

export type AppRouter = typeof appRouter;
