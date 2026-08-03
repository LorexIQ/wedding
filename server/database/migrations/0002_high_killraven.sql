CREATE TABLE `settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rsvp_deadline_at` integer
);
--> statement-breakpoint
ALTER TABLE `guests` ADD `attending` integer;--> statement-breakpoint
ALTER TABLE `guests` ADD `allow_companions` integer DEFAULT true NOT NULL;