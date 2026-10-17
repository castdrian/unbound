import { z } from 'zod';

import { reviewDecisionSchema, submissionKindSchema, submissionSchema } from './publish';
import { addonVersionSchema, sha256Schema } from './addons';
import { addonManifestSchema } from './manifest';
import { userSummarySchema } from './account';

const noteSchema = z.string().trim().min(1).max(10_000);

export const reviewQueueQuerySchema = z
	.object({
		kind: submissionKindSchema.optional(),
	})
	.optional();

export const reviewQueueItemSchema = z.object({
	submission: submissionSchema,
	manifest: addonManifestSchema,
	changelog: z.string().nullable(),
	bundleSize: z.int().positive(),
	sha256: sha256Schema,
	submittedAt: z.iso.datetime(),
	submitter: userSummarySchema,
	/** The viewer authored it or maintains the addon, so the server refuses their review with `self_review`. */
	selfReview: z.boolean(),
	/** The addon's newest approved version, for updates. */
	previousVersion: addonVersionSchema.nullable(),
	/** A short-lived presigned download of the staged bundle. */
	artifact: z.object({
		url: z.url(),
		expiresAt: z.iso.datetime(),
	}),
});

/** Submissions pending review, oldest first. */
export const reviewQueueResponseSchema = z.object({
	submissions: z.array(reviewQueueItemSchema),
});

export const reviewSubmissionRequestSchema = z.discriminatedUnion('decision', [
	z.object({
		decision: reviewDecisionSchema.extract(['approved']),
		note: noteSchema.optional(),
	}),
	z.object({
		decision: reviewDecisionSchema.extract(['rejected', 'changes_requested']),
		/** The rejection reason or the changes the author must make. */
		note: noteSchema,
	}),
]);

export const reviewSubmissionResponseSchema = z.object({
	submission: submissionSchema,
});

export type ReviewQueueQuery = z.infer<typeof reviewQueueQuerySchema>;
export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
export type ReviewQueueResponse = z.infer<typeof reviewQueueResponseSchema>;
export type ReviewSubmissionRequest = z.infer<typeof reviewSubmissionRequestSchema>;
export type ReviewSubmissionResponse = z.infer<typeof reviewSubmissionResponseSchema>;

export default {
	reviewQueueQuerySchema,
	reviewQueueItemSchema,
	reviewQueueResponseSchema,
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
};
