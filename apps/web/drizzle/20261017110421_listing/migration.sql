-- SQLite only adds a NOT NULL column with a constant default; every row is backfilled below.
ALTER TABLE `addon` ADD `type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `addon` ADD `name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `addon` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `addon` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Mirrors `toAddonSummary` in `src/lib/addons.ts`.
UPDATE `addon` SET (`type`, `name`, `description`, `updated_at`) = (
	SELECT
		coalesce(
			json_extract(`v`.`manifest`, '$.type'),
			iif(json_extract(`v`.`manifest`, '$.main') GLOB '*.json', 'theme', 'plugin')
		),
		json_extract(`v`.`manifest`, '$.name'),
		json_extract(`v`.`manifest`, '$.description'),
		`v`.`published_at`
	FROM `addon_version` `v`
	WHERE `v`.`addon_id` = `addon`.`id`
	ORDER BY `v`.`version_key` DESC
	LIMIT 1
);--> statement-breakpoint
CREATE INDEX `addon_listed_name_idx` ON `addon` (`name`,`id`) WHERE "addon"."delisted_at" is null;--> statement-breakpoint
CREATE INDEX `addon_listed_type_name_idx` ON `addon` (`type`,`name`,`id`) WHERE "addon"."delisted_at" is null;--> statement-breakpoint
CREATE INDEX `addon_listed_createdAt_idx` ON `addon` (`created_at`,`id`) WHERE "addon"."delisted_at" is null;--> statement-breakpoint
CREATE INDEX `addon_listed_type_createdAt_idx` ON `addon` (`type`,`created_at`,`id`) WHERE "addon"."delisted_at" is null;--> statement-breakpoint
CREATE INDEX `addon_listed_updatedAt_idx` ON `addon` (`updated_at`,`id`) WHERE "addon"."delisted_at" is null;--> statement-breakpoint
CREATE INDEX `addon_listed_type_updatedAt_idx` ON `addon` (`type`,`updated_at`,`id`) WHERE "addon"."delisted_at" is null;
