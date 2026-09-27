CREATE TABLE `finance_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_finance_contacts_user_name` ON `finance_contacts` (`user_id`,`name`);
--> statement-breakpoint
CREATE TABLE `finance_transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`transaction_id` text NOT NULL,
	`category_id` text,
	`amount_cents` integer NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `finance_transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_finance_txnsplits_user_txn` ON `finance_transaction_splits` (`user_id`,`transaction_id`);
--> statement-breakpoint
CREATE INDEX `idx_finance_txnsplits_user_cat` ON `finance_transaction_splits` (`user_id`,`category_id`);
--> statement-breakpoint
CREATE TABLE `finance_net_worth_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`year_month` text NOT NULL,
	`total_assets_cents` integer NOT NULL,
	`total_liabilities_cents` integer NOT NULL,
	`net_worth_cents` integer NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_finance_snapshots_user_month` ON `finance_net_worth_snapshots` (`user_id`,`year_month`);
--> statement-breakpoint
ALTER TABLE `finance_debts` ADD `debt_type` text DEFAULT 'loan' NOT NULL;
--> statement-breakpoint
ALTER TABLE `finance_debts` ADD `contact_id` text REFERENCES `finance_contacts`(`id`) ON DELETE set null;
--> statement-breakpoint
ALTER TABLE `finance_debts` ADD `due_date` text;
--> statement-breakpoint
ALTER TABLE `finance_transactions` ADD `has_splits` integer DEFAULT 0 NOT NULL;
