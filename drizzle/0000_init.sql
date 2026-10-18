CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transaction_id` int NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`stored_name` varchar(80) NOT NULL,
	`mime_type` varchar(80) NOT NULL,
	`size_bytes` int NOT NULL,
	`uploaded_by_id` int,
	`created_at` datetime NOT NULL,
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `attachments_stored_name_unique` UNIQUE(`stored_name`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`user_name` varchar(120),
	`action` varchar(40) NOT NULL,
	`entity_type` varchar(40) NOT NULL,
	`entity_id` varchar(40),
	`summary` varchar(255) NOT NULL,
	`changes` json,
	`ip` varchar(64),
	`created_at` datetime NOT NULL,
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `counters` (
	`name` varchar(40) NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	CONSTRAINT `counters_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`event_code` varchar(20) NOT NULL,
	`name` varchar(150) NOT NULL,
	`event_date` date NOT NULL,
	`venue` varchar(190),
	`description` text,
	`budget` decimal(12,2),
	`status` enum('PLANNED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
	`created_by_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_event_code_unique` UNIQUE(`event_code`)
);
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	CONSTRAINT `expense_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`success` boolean NOT NULL,
	`created_at` datetime NOT NULL,
	CONSTRAINT `login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`member_code` varchar(20) NOT NULL,
	`full_name` varchar(150) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(190),
	`address` text,
	`joining_date` date NOT NULL,
	`membership_type_id` int NOT NULL,
	`annual_fee` decimal(12,2) NOT NULL,
	`renewal_date` date NOT NULL,
	`status` enum('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
	`deactivated_at` datetime,
	`deactivation_reason` varchar(255),
	`notes` text,
	`created_by_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `members_id` PRIMARY KEY(`id`),
	CONSTRAINT `members_member_code_unique` UNIQUE(`member_code`)
);
--> statement-breakpoint
CREATE TABLE `membership_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`annual_fee` decimal(12,2) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `membership_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `membership_types_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`ip` varchar(64),
	`user_agent` varchar(255),
	`created_at` datetime NOT NULL,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`txn_code` varchar(24) NOT NULL,
	`receipt_no` varchar(24),
	`kind` enum('INCOME','EXPENSE') NOT NULL,
	`income_category` enum('DONATION','SUBSCRIPTION','SPONSORSHIP','OTHER'),
	`expense_category_id` int,
	`amount` decimal(12,2) NOT NULL,
	`txn_date` date NOT NULL,
	`mode` enum('CASH','BANK','UPI') NOT NULL,
	`status` enum('COMPLETED','PENDING','VOID') NOT NULL DEFAULT 'COMPLETED',
	`reference_no` varchar(80),
	`party_name` varchar(150),
	`description` text,
	`member_id` int,
	`event_id` int,
	`due_date` date,
	`void_reason` varchar(255),
	`created_by_id` int,
	`updated_by_id` int,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `transactions_txn_code_unique` UNIQUE(`txn_code`),
	CONSTRAINT `transactions_receipt_no_unique` UNIQUE(`receipt_no`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('ADMIN','TREASURER','VIEWER') NOT NULL DEFAULT 'VIEWER',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` datetime,
	`created_at` datetime NOT NULL,
	`updated_at` datetime NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `attachments` ADD CONSTRAINT `attachments_uploaded_by_id_users_id_fk` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `members` ADD CONSTRAINT `members_membership_type_id_membership_types_id_fk` FOREIGN KEY (`membership_type_id`) REFERENCES `membership_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `members` ADD CONSTRAINT `members_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_expense_category_id_expense_categories_id_fk` FOREIGN KEY (`expense_category_id`) REFERENCES `expense_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_member_id_members_id_fk` FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_created_by_id_users_id_fk` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_updated_by_id_users_id_fk` FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `attachments_txn_idx` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `events_date_idx` ON `events` (`event_date`);--> statement-breakpoint
CREATE INDEX `login_attempts_key_idx` ON `login_attempts` (`key_hash`,`created_at`);--> statement-breakpoint
CREATE INDEX `members_name_idx` ON `members` (`full_name`);--> statement-breakpoint
CREATE INDEX `members_phone_idx` ON `members` (`phone`);--> statement-breakpoint
CREATE INDEX `members_status_renewal_idx` ON `members` (`status`,`renewal_date`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `txn_date_idx` ON `transactions` (`txn_date`);--> statement-breakpoint
CREATE INDEX `txn_kind_status_idx` ON `transactions` (`kind`,`status`);--> statement-breakpoint
CREATE INDEX `txn_member_idx` ON `transactions` (`member_id`);--> statement-breakpoint
CREATE INDEX `txn_event_idx` ON `transactions` (`event_id`);--> statement-breakpoint
CREATE INDEX `txn_mode_idx` ON `transactions` (`mode`);