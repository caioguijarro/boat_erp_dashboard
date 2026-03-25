CREATE TABLE `contas_pagar` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`descricao` text,
	`fornecedorNome` varchar(256),
	`valor` decimal(10,2),
	`valorPago` decimal(10,2) DEFAULT '0',
	`status` enum('aberto','pago','cancelado','vencido') DEFAULT 'aberto',
	`dataVencimento` timestamp,
	`dataPagamento` timestamp,
	`formaPagamento` varchar(128),
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contas_pagar_id` PRIMARY KEY(`id`),
	CONSTRAINT `contas_pagar_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `contas_receber` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`pedidoId` int,
	`descricao` text,
	`clienteNome` varchar(256),
	`valor` decimal(10,2),
	`valorRecebido` decimal(10,2) DEFAULT '0',
	`status` enum('aberto','recebido','cancelado','vencido') DEFAULT 'aberto',
	`dataVencimento` timestamp,
	`dataRecebimento` timestamp,
	`formaPagamento` varchar(128),
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contas_receber_id` PRIMARY KEY(`id`),
	CONSTRAINT `contas_receber_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `expedicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`pedidoId` int,
	`numero` varchar(64),
	`status` varchar(64),
	`transportadora` varchar(128),
	`codigoRastreio` varchar(128),
	`urlRastreio` text,
	`dataExpedicao` timestamp,
	`dataPrevEntrega` timestamp,
	`dataEntrega` timestamp,
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expedicoes_id` PRIMARY KEY(`id`),
	CONSTRAINT `expedicoes_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `itens_pedido` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pedidoId` int NOT NULL,
	`produtoId` int,
	`produtoNome` varchar(256),
	`produtoCodigo` varchar(64),
	`quantidade` decimal(10,2),
	`valorUnitario` decimal(10,2),
	`valorTotal` decimal(10,2),
	`desconto` decimal(10,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `itens_pedido_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notas_fiscais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`pedidoId` int,
	`numero` varchar(64),
	`serie` varchar(16),
	`chaveAcesso` varchar(64),
	`status` varchar(64),
	`situacao` varchar(64),
	`tipo` enum('E','S') DEFAULT 'S',
	`valorTotal` decimal(10,2),
	`dataEmissao` timestamp,
	`clienteNome` varchar(256),
	`clienteCpfCnpj` varchar(32),
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notas_fiscais_id` PRIMARY KEY(`id`),
	CONSTRAINT `notas_fiscais_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `pedidos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`numero` varchar(64),
	`numeroPedidoCliente` varchar(64),
	`clienteNome` varchar(256),
	`clienteEmail` varchar(320),
	`clienteCpfCnpj` varchar(32),
	`status` varchar(64),
	`situacao` varchar(64),
	`totalProdutos` decimal(10,2),
	`totalDesconto` decimal(10,2) DEFAULT '0',
	`totalFrete` decimal(10,2) DEFAULT '0',
	`totalPedido` decimal(10,2),
	`formaPagamento` varchar(128),
	`canal` varchar(128),
	`dataPedido` timestamp,
	`dataPrevEntrega` timestamp,
	`observacoes` text,
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pedidos_id` PRIMARY KEY(`id`),
	CONSTRAINT `pedidos_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `produtos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`olistId` varchar(64),
	`codigo` varchar(64),
	`nome` text NOT NULL,
	`descricao` text,
	`categoria` varchar(128),
	`preco` decimal(10,2),
	`precoCusto` decimal(10,2),
	`unidade` varchar(16),
	`estoqueAtual` decimal(10,2) DEFAULT '0',
	`estoqueMinimo` decimal(10,2) DEFAULT '0',
	`ativo` enum('S','N') DEFAULT 'S',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `produtos_id` PRIMARY KEY(`id`),
	CONSTRAINT `produtos_olistId_unique` UNIQUE(`olistId`)
);
--> statement-breakpoint
CREATE TABLE `webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tipo` varchar(64) NOT NULL,
	`evento` varchar(128),
	`payload` text,
	`status` enum('processado','erro','ignorado') DEFAULT 'processado',
	`erroMsg` text,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_logs_id` PRIMARY KEY(`id`)
);
