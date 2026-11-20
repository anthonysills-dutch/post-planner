CREATE TABLE `collection_items` (
	`collection_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	PRIMARY KEY(`collection_id`, `entry_id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`added_by` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`topic` text NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`source_url` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_org` ON `library_entries` (`org_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`scheduled_at` integer,
	`publishing_at` integer,
	`published_at` integer,
	`external_id` text,
	`external_url` text,
	`failure_reason` text,
	`impressions` integer DEFAULT 0 NOT NULL,
	`reactions` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`reposts` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `posts_user_status` ON `posts` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `posts_due` ON `posts` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`time_zone` text DEFAULT 'UTC' NOT NULL,
	`weekly_goal` integer DEFAULT 3 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_post` ON `share_links` (`post_id`);--> statement-breakpoint
CREATE TABLE `slots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`weekday` integer NOT NULL,
	`minute` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slots_user_time` ON `slots` (`user_id`,`weekday`,`minute`);