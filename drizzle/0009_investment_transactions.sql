ALTER TABLE `investment_assets` ADD COLUMN `account_id` text;
--> statement-breakpoint
ALTER TABLE `investment_assets` ADD COLUMN `realized_gain_loss_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_investment_assets_user_acc` ON `investment_assets` (`user_id`, `account_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `investment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`account_id` text,
	`type` text NOT NULL,
	`date` text NOT NULL,
	`units_micro` integer DEFAULT 0 NOT NULL,
	`price_per_unit_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`fee_cents` integer DEFAULT 0 NOT NULL,
	`realized_gain_cents` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `investment_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `finance_accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invest_tx_user_date` ON `investment_transactions` (`user_id`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invest_tx_asset_date` ON `investment_transactions` (`asset_id`, `date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_invest_tx_user_type` ON `investment_transactions` (`user_id`, `type`);
