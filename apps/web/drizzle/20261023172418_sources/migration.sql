CREATE TABLE `submission_source` (
	`submission_id` text PRIMARY KEY,
	`repository_id` integer NOT NULL,
	`path` text NOT NULL,
	`ref` text NOT NULL,
	`commit_sha` text NOT NULL,
	`bundle_path` text NOT NULL,
	`bundle_blob_sha` text NOT NULL,
	`addon_md` text,
	`changelog` text,
	`details` text NOT NULL,
	CONSTRAINT `fk_submission_source_submission_id_submission_id_fk` FOREIGN KEY (`submission_id`) REFERENCES `submission`(`id`)
);
