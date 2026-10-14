CREATE TABLE `ai_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_reviews` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`request_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
