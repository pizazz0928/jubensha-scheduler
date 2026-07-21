CREATE TABLE `dm_script_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`dm_id` text NOT NULL,
	`script_id` text NOT NULL,
	`proficiency` integer DEFAULT 3 NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`willing` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `dms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`nickname` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`gender` text DEFAULT '未设置' NOT NULL,
	`status` text DEFAULT '未到店' NOT NULL,
	`in_store` integer DEFAULT false NOT NULL,
	`can_host` integer DEFAULT true NOT NULL,
	`can_fill` integer DEFAULT true NOT NULL,
	`styles` text DEFAULT '[]' NOT NULL,
	`specialties` text DEFAULT '[]' NOT NULL,
	`available_from` text DEFAULT '12:00' NOT NULL,
	`available_until` text DEFAULT '24:00' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`capacity` integer NOT NULL,
	`status` text DEFAULT '空闲' NOT NULL,
	`supported_types` text DEFAULT '[]' NOT NULL,
	`needs_cleaning` integer DEFAULT false NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scripts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`min_players` integer NOT NULL,
	`standard_players` integer NOT NULL,
	`max_players` integer NOT NULL,
	`duration_minutes` integer NOT NULL,
	`prep_minutes` integer DEFAULT 30 NOT NULL,
	`review_minutes` integer DEFAULT 30 NOT NULL,
	`allow_dm_fill` integer DEFAULT true NOT NULL,
	`max_dm_fill` integer DEFAULT 1 NOT NULL,
	`min_proficiency` integer DEFAULT 3 NOT NULL,
	`required_gender` text DEFAULT '不限' NOT NULL,
	`required_style` text DEFAULT '不限' NOT NULL,
	`room_requirement` text DEFAULT '普通房' NOT NULL,
	`difficulty` text DEFAULT '中等' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
