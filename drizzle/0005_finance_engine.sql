CREATE TABLE `finance_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`balance_cents` integer DEFAULT 0 NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_finance_accounts_user_archived` ON `finance_accounts` (`user_id`,`is_archived`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_finance_accounts_user_category` ON `finance_accounts` (`user_id`,`category_id`);
--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`category_id` text,
	`type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`transaction_date` text NOT NULL,
	`timestamp_ms` integer NOT NULL,
	`payee` text,
	`notes` text,
	`transfer_account_id` text,
	`transfer_transaction_id` text,
	`is_reconciled` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`transfer_account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_finance_txns_user_acc_date` ON `finance_transactions` (`user_id`,`account_id`,`transaction_date`);
--> statement-breakpoint
CREATE INDEX `idx_finance_txns_user_cat_date` ON `finance_transactions` (`user_id`,`category_id`,`transaction_date`);
--> statement-breakpoint
CREATE TABLE `finance_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text NOT NULL,
	`period` text DEFAULT 'monthly' NOT NULL,
	`year_month` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`rollover` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_finance_budgets_user_cat_month` ON `finance_budgets` (`user_id`,`category_id`,`year_month`);
--> statement-breakpoint
CREATE TABLE `finance_debts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`name` text NOT NULL,
	`creditor` text NOT NULL,
	`total_owed_cents` integer NOT NULL,
	`interest_rate_bps` integer DEFAULT 0 NOT NULL,
	`minimum_payment_cents` integer DEFAULT 0 NOT NULL,
	`target_payoff_date` text,
	`is_paid_off` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_finance_debts_user_paidoff` ON `finance_debts` (`user_id`,`is_paid_off`);
--> statement-breakpoint
CREATE TABLE `finance_debt_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`debt_id` text NOT NULL,
	`transaction_id` text,
	`date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`principal_cents` integer,
	`interest_cents` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`debt_id`) REFERENCES `finance_debts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `finance_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_finance_debt_payments_user_debt_date` ON `finance_debt_payments` (`user_id`,`debt_id`,`date`);
