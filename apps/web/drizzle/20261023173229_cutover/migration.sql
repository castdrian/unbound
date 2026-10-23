-- Open upload-flow submissions have no pinned source, so close them before the open set narrows.
UPDATE submission SET status = 'expired' WHERE status IN ('awaiting_upload', 'pending_review', 'changes_requested');--> statement-breakpoint
ALTER TABLE `submission` DROP COLUMN `upload_expires_at`;--> statement-breakpoint
-- drizzle-kit does not diff index predicates, so the narrowed claim index is written by hand.
DROP INDEX `submission_listing_claim_uidx`;--> statement-breakpoint
CREATE UNIQUE INDEX `submission_listing_claim_uidx` ON `submission` (`addon_id`) WHERE "submission"."kind" = 'listing' and "submission"."status" in ('pending_review', 'changes_requested');
