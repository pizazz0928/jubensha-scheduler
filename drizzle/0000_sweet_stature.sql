CREATE TABLE `dispatch_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operation_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`time` text NOT NULL,
	`operator` text NOT NULL,
	`content` text NOT NULL,
	`category` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL
);
