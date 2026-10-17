CREATE TABLE `addon` (
	`id` text PRIMARY KEY,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`delisted_at` integer
);
--> statement-breakpoint
CREATE TABLE `addon_maintainer` (
	`addon_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `addon_maintainer_pk` PRIMARY KEY(`addon_id`, `user_id`),
	CONSTRAINT `fk_addon_maintainer_addon_id_addon_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_addon_maintainer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `addon_version` (
	`addon_id` text NOT NULL,
	`version` text NOT NULL,
	`submission_id` text NOT NULL,
	`manifest` text NOT NULL,
	`changelog` text,
	`bundle_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`published_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT `addon_version_pk` PRIMARY KEY(`addon_id`, `version`),
	CONSTRAINT `fk_addon_version_addon_id_addon_id_fk` FOREIGN KEY (`addon_id`) REFERENCES `addon`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_addon_version_submission_id_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`)
);
--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY,
	`addon_id` text NOT NULL,
	`author_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`version` text NOT NULL,
	`manifest` text NOT NULL,
	`changelog` text,
	`repository` text,
	`bundle_size` integer NOT NULL,
	`staging_key` text NOT NULL UNIQUE,
	`upload_expires_at` integer NOT NULL,
	`sha256` text,
	`created_at` integer NOT NULL,
	`submitted_at` integer,
	`reviewer_id` text,
	`reviewed_at` integer,
	`review_note` text,
	CONSTRAINT `fk_submission_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_submission_reviewer_id_user_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `addon_maintainer_userId_idx` ON `addon_maintainer` (`user_id`);--> statement-breakpoint
CREATE INDEX `submission_addonId_status_idx` ON `submission` (`addon_id`,`status`);--> statement-breakpoint
CREATE INDEX `submission_authorId_createdAt_idx` ON `submission` (`author_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `submission_listing_claim_uidx` ON `submission` (`addon_id`) WHERE "submission"."kind" = 'listing' and "submission"."status" in ('awaiting_upload', 'pending_review', 'changes_requested');