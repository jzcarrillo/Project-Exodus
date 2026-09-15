CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`application` text NOT NULL,
	`action` text NOT NULL,
	`note` text NOT NULL,
	`created` text NOT NULL,
	`seen` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activity_owner` ON `activity` (`owner`);--> statement-breakpoint
CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`service` text NOT NULL,
	`status` text NOT NULL,
	`data` text NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_applications_owner` ON `applications` (`owner`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`application` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_owner` ON `documents` (`owner`);--> statement-breakpoint
CREATE INDEX `idx_documents_application` ON `documents` (`application`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated` text NOT NULL
);
