ALTER TABLE `addon_version` ADD `version_key` text NOT NULL;--> statement-breakpoint
ALTER TABLE `addon_version` ADD `min_client_key` text NOT NULL;--> statement-breakpoint
ALTER TABLE `submission` ADD `review_decision` text;--> statement-breakpoint
CREATE INDEX `addon_version_addonId_versionKey_idx` ON `addon_version` (`addon_id`,`version_key`);--> statement-breakpoint
CREATE INDEX `submission_status_submittedAt_idx` ON `submission` (`status`,`submitted_at`);