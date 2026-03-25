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
