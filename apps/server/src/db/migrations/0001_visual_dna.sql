CREATE TABLE `saved_cards` (
	`user_id` text NOT NULL,
	`dna_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `dna_id`),
	FOREIGN KEY (`user_id`) REFERENCES `anon_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dna_id`) REFERENCES `visual_dna`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `visual_dna` (
	`id` text PRIMARY KEY NOT NULL,
	`track_ref` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` text,
	`owner_id` text,
	`origin` text NOT NULL,
	`model` text NOT NULL,
	`remix_prompt` text,
	`json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visual_dna_track_idx` ON `visual_dna` (`track_ref`,`kind`);--> statement-breakpoint
CREATE INDEX `visual_dna_owner_idx` ON `visual_dna` (`owner_id`,`created_at`);