import { z } from 'zod';

import { addonIdSchema, addonManifestSchema } from './manifest';

/** `listing` claims a new addon id; `update` publishes a new version of an addon the caller maintains. */
export const submissionKindSchema = z.enum(['listing', 'update']);

export const submissionStatusSchema = z.enum([
	'awaiting_upload',
	'pending_review',
	'changes_requested',
	'approved',
	'rejected',
	'superseded',
]);

/** Statuses that keep a submission in the queue: they hold a listing's addon id and count towards the pending caps. */
export const openSubmissionStatusSchema = submissionStatusSchema.extract([
	'awaiting_upload',
	'pending_review',
	'changes_requested',
]);

/** A GitHub repository as `owner/name`. */
export const repositorySchema = z
	.string()
	.regex(
		/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/,
		'Must be a GitHub owner/name.',
	);

export const submissionSchema = z.object({
	id: z.string().min(1),
	addonId: addonIdSchema,
	version: z.string(),
	kind: submissionKindSchema,
	status: submissionStatusSchema,
	repository: repositorySchema.nullable(),
	/** No repository was named, so reviewers cannot tie the artifact to source the author controls. */
	unverifiedSource: z.boolean(),
});

/**
 * The kind is derived server-side from whether `manifest.id` is an approved addon. Submitting again
 * supersedes the caller's own submission for the addon that awaits its upload or has changes requested.
 */
export const createSubmissionRequestSchema = z.object({
	manifest: addonManifestSchema,
	bundleSize: z.int().positive(),
	repository: repositorySchema.optional(),
	changelog: z.string().max(10_000).optional(),
});

/** A single-use presigned upload for the bundle; send exactly `bundleSize` bytes with `headers` before `expiresAt`. */
export const submissionUploadSchema = z.object({
	url: z.url(),
	method: z.literal('PUT'),
	headers: z.record(z.string(), z.string()),
	expiresAt: z.iso.datetime(),
});

export const createSubmissionResponseSchema = z.object({
	submission: submissionSchema,
	upload: submissionUploadSchema,
});

/** Sent once the bundle upload has completed. */
export const finalizeSubmissionRequestSchema = z.object({});

export const finalizeSubmissionResponseSchema = z.object({
	submission: submissionSchema,
});

export type SubmissionKind = z.infer<typeof submissionKindSchema>;
export type SubmissionStatus = z.infer<typeof submissionStatusSchema>;
export type OpenSubmissionStatus = z.infer<typeof openSubmissionStatusSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;
export type SubmissionUpload = z.infer<typeof submissionUploadSchema>;
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;
export type FinalizeSubmissionRequest = z.infer<typeof finalizeSubmissionRequestSchema>;
export type FinalizeSubmissionResponse = z.infer<typeof finalizeSubmissionResponseSchema>;

export default {
	submissionKindSchema,
	submissionStatusSchema,
	openSubmissionStatusSchema,
	repositorySchema,
	submissionSchema,
	createSubmissionRequestSchema,
	submissionUploadSchema,
	createSubmissionResponseSchema,
	finalizeSubmissionRequestSchema,
	finalizeSubmissionResponseSchema,
};
