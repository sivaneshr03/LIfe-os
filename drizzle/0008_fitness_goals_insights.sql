ALTER TABLE `tracker_entries` ADD `text_value` text;
--> statement-breakpoint
ALTER TABLE `goals` ADD `timeframe` text;
--> statement-breakpoint
ALTER TABLE `goals` ADD `notes` text;
--> statement-breakpoint
CREATE TABLE `workout_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'strength' NOT NULL,
	`description` text,
	`category` text,
	`default_rest_seconds` integer DEFAULT 90 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workout_templates_user` ON `workout_templates` (`user_id`,`type`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `workout_template_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`exercise_name` text NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`target_reps` integer,
	`target_weight_grams` integer DEFAULT 0,
	`target_duration_seconds` integer,
	`rest_seconds` integer DEFAULT 90,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_workout_template_exercises_order` ON `workout_template_exercises` (`template_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `body_measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`weight_grams` integer,
	`body_fat_bps` integer,
	`chest_mm` integer,
	`waist_mm` integer,
	`hips_mm` integer,
	`bicep_left_mm` integer,
	`bicep_right_mm` integer,
	`thigh_left_mm` integer,
	`thigh_right_mm` integer,
	`calf_left_mm` integer,
	`calf_right_mm` integer,
	`neck_mm` integer,
	`shoulder_mm` integer,
	`forearm_mm` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_body_measurements_user_date` ON `body_measurements` (`user_id`,`date`);
--> statement-breakpoint
CREATE INDEX `idx_body_measurements_user_date` ON `body_measurements` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `goal_progress_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`milestone_id` text,
	`previous_progress` integer NOT NULL,
	`new_progress` integer NOT NULL,
	`change_delta` integer NOT NULL,
	`notes` text,
	`logged_at` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `goal_milestones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_goal_progress_logs_user_goal` ON `goal_progress_logs` (`user_id`,`goal_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `goal_task_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`task_id` text NOT NULL,
	`milestone_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `goal_milestones`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_goal_task_links_user_goal_task` ON `goal_task_links` (`user_id`,`goal_id`,`task_id`);
--> statement-breakpoint
CREATE INDEX `idx_goal_task_links_task` ON `goal_task_links` (`task_id`);
