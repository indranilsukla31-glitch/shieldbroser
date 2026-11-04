CREATE TABLE `anon_users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`track_ref` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `track_ref`),
	FOREIGN KEY (`user_id`) REFERENCES `anon_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tracks` (
	`ref` text PRIMARY KEY NOT NULL,
	`json` text NOT NULL,
	`lyrics_json` text NOT NULL,
	`audio_url` text NOT NULL,
	`fetched_at` integer NOT NULL
);
