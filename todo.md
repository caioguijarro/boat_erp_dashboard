# Boat ERP Dashboard - TODO

## Fase 1: Banco de Dados e Webhooks
- [x] Schema do banco: produtos, pedidos, notas fiscais, expedições, contas a receber/pagar, logs de webhooks
- [x] Migração do banco de dados
- [x] Endpoint público de webhook para receber dados do Olist ERP
- [x] Handlers para cada tipo de webhook: produtos, estoque, pedidos, NF, rastreamento

## Fase 2: Backend tRPC
- [x] Queries de vendas por período (dia/mês)
- [x] Queries de status de pedidos
- [x] Queries de níveis de estoque e alertas
- [x] Queries de contas a receber e a pagar
- [x] Queries de fluxo de caixa
- [x] Queries de logs de webhooks

## Fase 3: Frontend - Dashboard e Páginas
- [x] Layout com sidebar (DashboardLayout)
- [x] Página principal: cards de métricas em tempo real
- [x] Página de Pedidos: tabela interativa com filtros e detalhes
- [x] Página de Estoque: lista de produtos com alertas de baixo estoque
- [x] Página Financeira: gráficos de contas a receber/pagar e fluxo de caixa
- [x] Página de Logs de Webhooks

## Fase 4: Notificações, LLM e Documentação
- [x] Toast de notificações em tempo real quando webhooks chegam
- [x] Notificações automáticas ao proprietário (estoque crítico, pedidos altos, NF rejeitada, atraso expedição)
- [x] Integração LLM: análise de tendências de vendas
- [x] Integração LLM: sugestões de reposição de estoque
- [x] Integração LLM: resumo executivo semanal
- [x] Página de Insights com análises automáticas
- [x] Documentação de URLs de webhook para configurar no Olist

## Fase 5: Testes e Entrega
- [x] Testes vitest para routers principais (11 testes passando)
- [x] Checkpoint final
- [x] Entrega ao usuário com URLs de webhook

## Bugs
- [x] Corrigir erro de query SQL: dataPedido sendo comparado com objeto Date em vez de string formatada
- [x] Diagnosticar por que dados não aparecem no dashboard
- [x] Implementar dados de demonstração para validar o sistema
- [x] Adicionar endpoint de teste de webhook
- [x] Corrigir URLs de webhook na página Webhooks para usar domínio de produção
- [x] Diagnosticar e corrigir botão de dados demo que não está populando o banco
- [x] Testar recebimento real de webhooks do Olist no servidor de produção
- [x] Verificar e corrigir processamento dos payloads do Olist (formato {versao, cnpj, tipo, dados})
- [x] Limpar dados demo do banco
- [x] Melhorar página de Webhooks com guia passo a passo e status de integração

## Integração API 2.0 Olist (Polling)

- [x] Configurar Token API 2.0 do Olist como secret (OLIST_API_TOKEN)
- [x] Implementar serviço de polling olistSync.ts com rate limit respeitado (2s entre chamadas)
- [x] Implementar polling de pedidos a cada 5 minutos via API 2.0
- [x] Implementar polling de produtos a cada 30 minutos via API 2.0
- [x] Iniciar polling automático ao subir o servidor
- [x] Validar: 18 pedidos e 10 produtos sincronizados no banco com dados reais do Olist

## Módulos Analíticos v2

### Banco de Dados
- [x] Tabela `metas`: meta mensal geral (ano, mês, valor)
- [x] Tabela `vendedores`: cadastro com % comissão fixa e meta individual mensal
- [x] Tabela `comissoes_pagas`: controle de períodos de comissão pagos/pendentes por vendedor
- [x] Adicionar campos ao pedido: clienteNome, clienteCpfCnpj, situacao, canal, vendedor_id, vendedor_nome
- [x] Migrar schema com pnpm db:push

### Polling Olist
- [x] Expandir histórico para 90 dias no primeiro sync
- [x] Buscar detalhes completos de cada pedido (cliente, vendedor, situação)
- [x] Salvar situação e dados de pagamento

### Backend tRPC
- [x] Procedure: vendas por dia com meta proporcional (gráfico tendência)
- [x] Procedure: ranking de vendedores (valor, meta, % atingido, comissão calculada)
- [x] Procedure: comissões por período (pago/pendente por vendedor)
- [x] Procedure: inadimplência (entregue + não pago, agrupado por vendedor)
- [x] Procedure: top 10 clientes por valor no período
- [x] Procedure: conciliação (entregues vs. pagos)
- [x] Procedure: CRUD de metas mensais
- [x] Procedure: CRUD de vendedores (comissão, meta)
- [x] Procedure: marcar período de comissão como pago

### Frontend
- [x] Página Vendas: gráfico tendência diária + linha de meta + seletor de mês
- [x] Página Vendedores: ranking com barra de progresso, comissão calculada, status de pagamento por período
- [x] Página Inadimplência: tabela por vendedor com valor em aberto e dias de atraso + classificação de risco
- [x] Página Clientes: top 10 + conciliação entregues vs pagos
- [x] Sidebar atualizado com novos itens de navegação
