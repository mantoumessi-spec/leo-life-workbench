CREATE TABLE `calendar_connections` (
	`user_id` text PRIMARY KEY NOT NULL,
	`encrypted_token` text NOT NULL,
	`connected_at` text NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week` text NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`nonce` text NOT NULL,
	`expires_at` integer NOT NULL
);
