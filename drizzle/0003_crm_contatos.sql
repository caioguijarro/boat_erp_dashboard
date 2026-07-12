-- Migration: crm_contatos (CRM de recompra)
--
-- IMPORTANTE: o runtime desta aplicação usa PostgreSQL (drizzle-orm/postgres-js
-- em server/db.ts, schema em drizzle/schema.ts com pgTable). As migrations
-- anteriores neste diretório foram geradas em sintaxe MySQL por um drizzle.config
-- legado e NÃO refletem o banco real. Esta migration está escrita em sintaxe
-- PostgreSQL para corresponder ao banco em produção.
--
-- Aplicação manual (o `db:push` do repo está com dialeto inconsistente):
--   psql "$DATABASE_URL" -f drizzle/0003_crm_contatos.sql
-- ou cole o SQL abaixo no editor SQL do Supabase.

CREATE TABLE IF NOT EXISTS "crm_contatos" (
	"id" SERIAL PRIMARY KEY,
	"clienteKey" varchar(128) NOT NULL,
	"clienteCpfCnpj" varchar(32),
	"olistContatoId" varchar(64),
	"telefone" varchar(32),
	"whatsapp" varchar(32),
	"email" varchar(320),
	"status" text NOT NULL DEFAULT 'a_contatar',
	"notas" text,
	"ultimoContato" timestamp,
	"proximoFollowup" timestamp,
	"createdAt" timestamp NOT NULL DEFAULT now(),
	"updatedAt" timestamp NOT NULL DEFAULT now(),
	CONSTRAINT "crm_contatos_clienteKey_unique" UNIQUE("clienteKey")
);
