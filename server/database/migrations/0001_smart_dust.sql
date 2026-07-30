PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_guests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`fio` text,
	`phone` text,
	`comment` text,
	`drinks` text DEFAULT '[]' NOT NULL,
	`invite_code` text,
	`submitted` integer DEFAULT false NOT NULL,
	`envelope_opened` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_guests`("id", "fio", "phone", "comment", "drinks", "created_at", "updated_at") SELECT "id", "fio", "phone", "comment", "drinks", "created_at", "updated_at" FROM `guests`;--> statement-breakpoint
DROP TABLE `guests`;--> statement-breakpoint
ALTER TABLE `__new_guests` RENAME TO `guests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `guests_invite_code_unique` ON `guests` (`invite_code`);