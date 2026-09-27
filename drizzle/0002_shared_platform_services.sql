ALTER TABLE `user_preferences` ADD COLUMN `timezone` text DEFAULT 'UTC' NOT NULL;
--> statement-breakpoint
ALTER TABLE `user_preferences` ADD COLUMN `base_currency` text DEFAULT 'USD' NOT NULL;
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`parent_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`icon` text,
	`color` text,
	`description` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_categories_user_domain` ON `categories` (`user_id`,`domain`,`is_enabled`);
--> statement-breakpoint
CREATE INDEX `idx_categories_user_parent` ON `categories` (`user_id`,`parent_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_categories_user_domain_parent_slug` ON `categories` (`user_id`,`domain`,`parent_id`,`slug`);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_tags_user_slug` ON `tags` (`user_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `idx_tags_user_created` ON `tags` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tag_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_entity_tags_unique` ON `entity_tags` (`user_id`,`entity_type`,`entity_id`,`tag_id`);
--> statement-breakpoint
CREATE INDEX `idx_entity_tags_lookup` ON `entity_tags` (`user_id`,`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE INDEX `idx_entity_tags_tag` ON `entity_tags` (`user_id`,`tag_id`);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`title` text NOT NULL,
	`description` text,
	`remind_at` integer NOT NULL,
	`recurrence_rule` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`snoozed_until` integer,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_reminders_user_due` ON `reminders` (`user_id`,`status`,`remind_at`);
--> statement-breakpoint
CREATE INDEX `idx_reminders_user_entity` ON `reminders` (`user_id`,`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`action_url` text,
	`is_read` integer DEFAULT 0 NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_unread` ON `in_app_notifications` (`user_id`,`is_read`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user_created` ON `in_app_notifications` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text NOT NULL,
	`metadata` text,
	`ip_hash` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_activity_user_timeline` ON `activity_events` (`user_id`,`domain`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_activity_user_entity` ON `activity_events` (`user_id`,`entity_type`,`entity_id`);
--> statement-breakpoint
CREATE TABLE `saved_views` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`domain` text NOT NULL,
	`name` text NOT NULL,
	`filter_config` text NOT NULL,
	`sort_config` text,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_saved_views_user_domain` ON `saved_views` (`user_id`,`domain`,`is_pinned`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `import_export_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`domain` text NOT NULL,
	`format` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_items` integer DEFAULT 0 NOT NULL,
	`processed_items` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`error_details` text,
	`summary` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_user_status` ON `import_export_jobs` (`user_id`,`type`,`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `attachment_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_size` integer NOT NULL,
	`mime_type` text NOT NULL,
	`storage_provider` text DEFAULT 'deferred' NOT NULL,
	`storage_key` text,
	`sha256` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_user_entity` ON `attachment_meta` (`user_id`,`entity_type`,`entity_id`);
