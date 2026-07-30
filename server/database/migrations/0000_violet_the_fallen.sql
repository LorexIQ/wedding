CREATE TABLE `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`login` text NOT NULL,
	`password_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_login_unique` ON `admin_users` (`login`);--> statement-breakpoint
CREATE TABLE `companions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_id` integer NOT NULL,
	`fio` text NOT NULL,
	`drinks` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fio` text NOT NULL,
	`phone` text,
	`comment` text,
	`drinks` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
