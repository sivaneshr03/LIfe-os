CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`status` text DEFAULT 'active' NOT NULL,
	`target_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_projects_user_slug` ON `projects` (`user_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `idx_projects_user_status` ON `projects` (`user_id`,`status`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_boards_user_project` ON `boards` (`user_id`,`project_id`);
--> statement-breakpoint
CREATE TABLE `board_columns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`board_id` text NOT NULL,
	`name` text NOT NULL,
	`status_mapping` text DEFAULT 'todo' NOT NULL,
	`color` text,
	`wip_limit` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_board_columns_order` ON `board_columns` (`user_id`,`board_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `recurrence_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_task_id` text NOT NULL,
	`frequency` text NOT NULL,
	`interval` integer DEFAULT 1 NOT NULL,
	`by_day_of_week` text,
	`by_day_of_month` integer,
	`by_month` integer,
	`end_type` text DEFAULT 'never' NOT NULL,
	`end_count` integer,
	`end_date` text,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`last_generated_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recurrence_user_active` ON `recurrence_rules` (`user_id`,`is_active`);
--> statement-breakpoint
CREATE TABLE `recurrence_exceptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recurrence_rule_id` text NOT NULL,
	`occurrence_date` text NOT NULL,
	`action` text NOT NULL,
	`rescheduled_to_date` text,
	`override_task_id` text,
	`reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurrence_rule_id`) REFERENCES `recurrence_rules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_recurrence_exception_date` ON `recurrence_exceptions` (`user_id`,`recurrence_rule_id`,`occurrence_date`);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`project_id` text,
	`board_id` text,
	`board_column_id` text,
	`category_id` text,
	`parent_task_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`due_date` text,
	`due_time` text,
	`due_timestamp_ms` integer,
	`start_date` text,
	`completed_at` integer,
	`archived_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`sort_order_board` integer DEFAULT 0 NOT NULL,
	`estimated_minutes` integer,
	`actual_minutes` integer,
	`recurrence_rule_id` text,
	`recurrence_occurrence_date` text,
	`is_recurring_template` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`board_column_id`) REFERENCES `board_columns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recurrence_rule_id`) REFERENCES `recurrence_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_status_due` ON `tasks` (`user_id`,`status`,`due_date`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_project` ON `tasks` (`user_id`,`project_id`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_board_col` ON `tasks` (`user_id`,`board_column_id`,`sort_order_board`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_parent` ON `tasks` (`user_id`,`parent_task_id`);
--> statement-breakpoint
CREATE INDEX `idx_tasks_user_recurrence` ON `tasks` (`user_id`,`recurrence_rule_id`,`recurrence_occurrence_date`);
--> statement-breakpoint
CREATE TABLE `task_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`task_id` text NOT NULL,
	`title` text NOT NULL,
	`is_completed` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_task_checklist_order` ON `task_checklist_items` (`task_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `daily_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`summary` text,
	`mood` integer,
	`energy` integer,
	`word_count` integer DEFAULT 0 NOT NULL,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_daily_notes_user_date` ON `daily_notes` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`project_id` text,
	`parent_note_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`summary` text,
	`is_pinned` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`reading_time_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`parent_note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_notes_user_list` ON `notes` (`user_id`,`is_archived`,`is_pinned`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_notes_user_category` ON `notes` (`user_id`,`category_id`);
--> statement-breakpoint
CREATE INDEX `idx_notes_user_project` ON `notes` (`user_id`,`project_id`);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`target_model` text,
	`current_version` integer DEFAULT 1 NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_prompts_user_slug` ON `prompts` (`user_id`,`slug`);
--> statement-breakpoint
CREATE INDEX `idx_prompts_user_favorite` ON `prompts` (`user_id`,`is_favorite`);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`version` integer NOT NULL,
	`system_prompt` text,
	`template` text NOT NULL,
	`variables` text,
	`change_notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_prompt_version` ON `prompt_versions` (`user_id`,`prompt_id`,`version`);
