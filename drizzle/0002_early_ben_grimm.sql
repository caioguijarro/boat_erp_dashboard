CREATE TABLE `comissoes_pagas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vendedorId` int NOT NULL,
	`ano` int NOT NULL,
	`mes` int NOT NULL,
	`valorComissao` decimal(10,2) NOT NULL,
	`valorVendas` decimal(12,2) NOT NULL,
	`pago` enum('S','N') DEFAULT 'N',
	`dataPagamento` timestamp,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comissoes_pagas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `metas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ano` int NOT NULL,
	`mes` int NOT NULL,
	`vendedorId` int,
	`valorMeta` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendedores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`nome` varchar(256) NOT NULL,
	`email` varchar(320),
	`comissaoPerc` decimal(5,2) DEFAULT '0',
	`ativo` enum('S','N') DEFAULT 'S',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vendedores_id` PRIMARY KEY(`id`),
	CONSTRAINT `vendedores_olistId_unique` UNIQUE(`olistId`)
);
