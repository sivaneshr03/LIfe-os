CREATE TABLE `investment_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`units_micro` integer DEFAULT 0 NOT NULL,
	`avg_cost_basis_cents` integer DEFAULT 0 NOT NULL,
	`latest_price_cents` integer DEFAULT 0 NOT NULL,
	`latest_price_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_investment_assets_user_symbol` ON `investment_assets` (`user_id`,`symbol`);
--> statement-breakpoint
CREATE INDEX `idx_investment_assets_user_type` ON `investment_assets` (`user_id`,`asset_type`);
--> statement-breakpoint
CREATE TABLE `investment_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`price_cents` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `investment_assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_investment_quotes_asset_time` ON `investment_quotes` (`asset_id`,`recorded_at`);
