import {
	addonPathSchema,
	commitShaSchema,
	gitRefSchema,
	repositoryDetailsSchema,
	repositoryInputSchema,
	repositorySchema,
} from './source';
import { addonIdSchema, addonManifestSchema } from './manifest';
import { z } from './zod';

/** `listing` claims a new addon id; `update` publishes a new version of an addon the caller maintains. */
export const submissionKindSchema = z.enum(['listing', 'update']);

export const submissionStatusSchema = z.enum([
	'awaiting_upload',
	'pending_review',
	'changes_requested',
	'approved',
	'rejected',
	'superseded',
	/** The upload reservation lapsed without being finalized. */
	'expired',
	/** Closed without review because the author was banned. */
	'cancelled',
]);

/** Statuses that keep a submission in the queue: they hold a listing's addon id and count towards the pending caps. */
export const openSubmissionStatusSchema = z.enum([
	'awaiting_upload',
	'pending_review',
	'changes_requested',
] satisfies SubmissionStatus[]);

/** The statuses a reviewer's decision moves a pending submission to. */
export const reviewDecisionSchema = z.enum([
	'approved',
	'rejected',
	'changes_requested',
] satisfies SubmissionStatus[]);

export const submissionReviewSchema = z.object({
	decision: reviewDecisionSchema,
	/** The rejection reason or requested changes; optional only on approval. */
	note: z.nullable(z.string()),
	reviewedAt: z.iso.datetime(),
});

export const submissionSchema = z.object({
	id: z.string().check(z.minLength(1)),
	addonId: addonIdSchema,
	version: z.string(),
	kind: submissionKindSchema,
	status: submissionStatusSchema,
	repository: z.nullable(repositorySchema),
	/** No repository was named, so reviewers cannot tie the artifact to source the author controls. */
	unverifiedSource: z.boolean(),
	/** The reviewer's decision, once one was made. */
	review: z.nullable(submissionReviewSchema),
});

export const MAX_CHANGELOG_LENGTH = 10_000;

/**
 * The kind is derived server-side from whether `manifest.id` is an approved addon. Submitting again
 * supersedes the caller's own submission for the addon that awaits its upload or has changes requested.
 */
export const createSubmissionRequestSchema = z.object({
	manifest: addonManifestSchema,
	bundleSize: z.int().check(z.positive()),
	repository: z.optional(repositorySchema),
	changelog: z.optional(z.string().check(z.maxLength(MAX_CHANGELOG_LENGTH))),
});

/** The details an author may override; omitted fields keep what GitHub says. */
export const submissionDetailsOverridesSchema = z.object({
	homepage: z.optional(repositoryDetailsSchema.shape.homepage),
	tags: z.optional(repositoryDetailsSchema.shape.tags),
});

/** One addon directory of a public repository at the commit the author previewed. */
export const submitFromRepositoryRequestSchema = z.object({
	repository: repositoryInputSchema,
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; it must still resolve to `commitSha`. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	details: z.optional(submissionDetailsOverridesSchema),
});

/** A presigned upload for the bundle; send exactly `bundleSize` bytes with `headers` before `expiresAt`. */
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
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type SubmissionReview = z.infer<typeof submissionReviewSchema>;
export type Submission = z.infer<typeof submissionSchema>;
export type CreateSubmissionRequest = z.infer<typeof createSubmissionRequestSchema>;
export type SubmissionDetailsOverrides = z.infer<typeof submissionDetailsOverridesSchema>;
export type SubmitFromRepositoryRequest = z.infer<typeof submitFromRepositoryRequestSchema>;
export type SubmissionUpload = z.infer<typeof submissionUploadSchema>;
export type CreateSubmissionResponse = z.infer<typeof createSubmissionResponseSchema>;
export type FinalizeSubmissionRequest = z.infer<typeof finalizeSubmissionRequestSchema>;
export type FinalizeSubmissionResponse = z.infer<typeof finalizeSubmissionResponseSchema>;

export default {
	MAX_CHANGELOG_LENGTH,
	submissionKindSchema,
	submissionStatusSchema,
	openSubmissionStatusSchema,
	reviewDecisionSchema,
	submissionReviewSchema,
	submissionSchema,
	createSubmissionRequestSchema,
	submissionDetailsOverridesSchema,
	submitFromRepositoryRequestSchema,
	submissionUploadSchema,
	createSubmissionResponseSchema,
	finalizeSubmissionRequestSchema,
	finalizeSubmissionResponseSchema,
};
