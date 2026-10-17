import type {
	CreateSubmissionRequest,
	CreateSubmissionResponse,
	FinalizeSubmissionResponse,
	OpenSubmissionStatus,
	Submission,
} from '@unbound-app/contracts/publish';
import { openSubmissionStatusSchema } from '@unbound-app/contracts/publish';
import { and, count, eq, gte, inArray, ne } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission } from '~/db/schema';
import { requirePermission } from '~/lib/api/caller';
import { presignStagingUpload } from '~/lib/storage';
import type { Transaction } from '~/db/database';
import { getSnowflakeDate } from '~/lib/discord';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { hasPushAccess } from '~/lib/github';
import { ApiError } from '~/lib/api/errors';

export type SubmissionRow = typeof submission.$inferSelect;

type LinkedAccount = {
	providerId: string;
	accountId: string;
	accessToken: string | null;
};

type Reservation = {
	created: SubmissionRow;
	replaced: SubmissionRow | undefined;
};

const DAY_MS = 86_400_000;

export const OPEN_SUBMISSION_STATUSES = openSubmissionStatusSchema.options;

/** The caller's own open submission in one of these states is superseded by submitting the addon again. */
export const REPLACEABLE_SUBMISSION_STATUSES = [
	'awaiting_upload',
	'changes_requested',
] as const satisfies OpenSubmissionStatus[];

/**
 * @description Renders a submission row as the wire contract.
 * @param row The submission row.
 * @returns The submission as API responses carry it.
 */
export function toSubmission(row: SubmissionRow): Submission {
	return {
		id: row.id,
		addonId: row.addonId,
		version: row.version,
		kind: row.kind,
		status: row.status,
		repository: row.repository,
		unverifiedSource: row.repository === null,
		review:
			row.reviewDecision && row.reviewedAt
				? {
						decision: row.reviewDecision,
						note: row.reviewNote,
						reviewedAt: row.reviewedAt.toISOString(),
					}
				: null,
	};
}

async function checkRateLimit(ctx: AppContext, userId: string, now: Date) {
	const since = new Date(now.getTime() - ctx.env.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000);
	const [recent] = await ctx.db
		.select({ total: count() })
		.from(submission)
		.where(and(eq(submission.authorId, userId), gte(submission.createdAt, since)));

	if (recent && recent.total >= ctx.env.SUBMISSION_RATE_LIMIT_MAX) {
		throw new ApiError('rate_limited', 'Too many submissions. Try again later.');
	}
}

function checkAccountAge(ctx: AppContext, discord: LinkedAccount | undefined, now: Date) {
	if (!discord) {
		throw new ApiError('forbidden', 'A Discord account is required to submit addons.');
	}

	const days = ctx.env.SUBMISSION_MIN_ACCOUNT_AGE_DAYS;
	const age = now.getTime() - getSnowflakeDate(discord.accountId).getTime();

	if (age < days * DAY_MS) {
		throw new ApiError(
			'account_too_new',
			`Your Discord account must be at least ${days} days old to submit addons.`,
		);
	}
}

async function verifyRepository(
	ctx: AppContext,
	github: LinkedAccount | undefined,
	repository: string,
) {
	if (!github?.accessToken) {
		throw new ApiError(
			'github_not_linked',
			`Link your GitHub account to submit from ${repository}.`,
		);
	}

	if (await hasPushAccess(ctx.env, github.accessToken, repository)) return;

	throw new ApiError(
		'github_no_push_access',
		`Your linked GitHub account cannot push to ${repository}.`,
	);
}

/**
 * Runs inside an immediate transaction so the claim and cap checks and the insert see no
 * concurrent submission.
 */
function reserve(
	ctx: AppContext,
	tx: Transaction,
	caller: Caller,
	request: CreateSubmissionRequest,
	now: Date,
): Reservation {
	const { manifest } = request;
	const { user } = caller;
	const approved = tx.select({ id: addon.id }).from(addon).where(eq(addon.id, manifest.id)).get();

	if (approved) {
		const maintainer = tx
			.select({ role: addonMaintainer.role })
			.from(addonMaintainer)
			.where(
				and(eq(addonMaintainer.addonId, manifest.id), eq(addonMaintainer.userId, user.id)),
			)
			.get();

		if (!maintainer) {
			throw new ApiError('not_maintainer', `You are not a maintainer of ${manifest.id}.`);
		}

		requirePermission(caller, { update: ['create'] });

		const existing = tx
			.select({ version: addonVersion.version })
			.from(addonVersion)
			.where(
				and(
					eq(addonVersion.addonId, manifest.id),
					eq(addonVersion.version, manifest.version),
				),
			)
			.get();

		if (existing) {
			throw new ApiError(
				'version_exists',
				`${manifest.id} already has a version ${manifest.version}.`,
			);
		}
	} else {
		requirePermission(caller, { submission: ['create'] });
	}

	const open = tx
		.select()
		.from(submission)
		.where(
			and(
				eq(submission.addonId, manifest.id),
				inArray(submission.status, OPEN_SUBMISSION_STATUSES),
			),
		)
		.all();

	const replaced = open.find(
		(row) =>
			row.authorId === user.id &&
			REPLACEABLE_SUBMISSION_STATUSES.some((status) => status === row.status),
	);

	const others = open.filter((row) => row !== replaced);

	if (approved && others.length >= ctx.env.SUBMISSION_MAX_PENDING_UPDATES) {
		throw new ApiError(
			'pending_update_exists',
			`${manifest.id} already has an update waiting for review.`,
		);
	}

	if (!approved && others.length > 0) {
		throw new ApiError(
			'addon_id_taken',
			`The addon id ${manifest.id} is claimed by another submission.`,
		);
	}

	if (!approved) {
		const pending = tx
			.select({ total: count() })
			.from(submission)
			.where(
				and(
					eq(submission.authorId, user.id),
					eq(submission.kind, 'listing'),
					inArray(submission.status, OPEN_SUBMISSION_STATUSES),
					replaced ? ne(submission.id, replaced.id) : undefined,
				),
			)
			.get();

		if (pending && pending.total >= ctx.env.SUBMISSION_MAX_PENDING_LISTINGS) {
			throw new ApiError(
				'pending_listing_cap',
				`You can have at most ${ctx.env.SUBMISSION_MAX_PENDING_LISTINGS} new listings waiting for review.`,
			);
		}
	}

	if (replaced) {
		tx.update(submission)
			.set({ status: 'superseded' })
			.where(eq(submission.id, replaced.id))
			.run();
	}

	const id = Bun.randomUUIDv7();
	const created = tx
		.insert(submission)
		.values({
			id,
			addonId: manifest.id,
			authorId: user.id,
			kind: approved ? 'update' : 'listing',
			status: 'awaiting_upload',
			version: manifest.version,
			manifest,
			changelog: request.changelog ?? null,
			repository: request.repository ?? null,
			bundleSize: request.bundleSize,
			stagingKey: `submissions/${id}/bundle`,
			uploadExpiresAt: new Date(now.getTime() + ctx.env.SUBMISSION_UPLOAD_TTL_SECONDS * 1000),
			createdAt: now,
		})
		.returning()
		.get();

	return { created, replaced };
}

/**
 * @description Opens a submission and reserves its upload: checks the size limit, the submission
 * rate, the Discord account age and, when a repository is named, GitHub push access; then claims
 * the addon id (new listing) or checks maintainership (update), enforces the pending caps,
 * supersedes the caller's own replaceable submission for the addon (deleting its staged bundle)
 * and presigns a single-use upload of exactly `bundleSize` bytes.
 * @param ctx The application context.
 * @param caller The submitting user.
 * @param request The validated create request.
 * @returns The new submission and its upload.
 */
export async function createSubmission(
	ctx: AppContext,
	caller: Caller,
	request: CreateSubmissionRequest,
): Promise<CreateSubmissionResponse> {
	const now = ctx.now();

	if (request.bundleSize > ctx.env.ADDON_MAX_BYTES) {
		throw new ApiError(
			'artifact_too_large',
			`Bundles may be at most ${ctx.env.ADDON_MAX_BYTES} bytes.`,
		);
	}

	await checkRateLimit(ctx, caller.user.id, now);

	const accounts = await ctx.db.query.account.findMany({
		where: { userId: caller.user.id, providerId: { in: ['discord', 'github'] } },
		columns: { providerId: true, accountId: true, accessToken: true },
	});

	const find = (providerId: string) => accounts.find((entry) => entry.providerId === providerId);

	checkAccountAge(ctx, find('discord'), now);

	if (request.repository) {
		await verifyRepository(ctx, find('github'), request.repository);
	}

	const { created, replaced } = ctx.db.transaction(
		(tx) => reserve(ctx, tx, caller, request, now),
		{ behavior: 'immediate' },
	);

	if (replaced) {
		await ctx.storage.staging.delete(replaced.stagingKey);
	}

	const upload = presignStagingUpload(ctx.env, {
		key: created.stagingKey,
		size: created.bundleSize,
		signedAt: now,
		expiresIn: ctx.env.SUBMISSION_UPLOAD_TTL_SECONDS,
	});

	return {
		submission: toSubmission(created),
		upload: { ...upload, method: 'PUT', expiresAt: created.uploadExpiresAt.toISOString() },
	};
}

async function hashObject(file: Bun.S3File): Promise<string> {
	const hasher = new Bun.CryptoHasher('sha256');

	for await (const chunk of file.stream()) {
		hasher.update(chunk);
	}

	return hasher.digest('hex');
}

/**
 * @description Confirms the caller's upload landed with the declared size, records its SHA-256 and
 * moves the submission to `pending_review`. An object uploaded before the URL expired is accepted
 * even if finalize itself runs later; a wrong-sized object is deleted so the URL can be used again.
 * @param ctx The application context.
 * @param caller The submitting user.
 * @param id The submission id.
 * @returns The submission, now pending review.
 */
export async function finalizeSubmission(
	ctx: AppContext,
	caller: Caller,
	id: string,
): Promise<FinalizeSubmissionResponse> {
	const row = await ctx.db.query.submission.findFirst({
		where: { id, authorId: caller.user.id },
	});

	if (!row) {
		throw new ApiError('not_found', `Submission ${id} does not exist.`);
	}

	if (row.status !== 'awaiting_upload') {
		throw new ApiError('submission_not_awaiting_upload', `Submission ${id} is ${row.status}.`);
	}

	const file = ctx.storage.staging.file(row.stagingKey);

	if (!(await file.exists())) {
		if (ctx.now() > row.uploadExpiresAt) {
			throw new ApiError('upload_expired', `The upload for submission ${id} has expired.`);
		}

		throw new ApiError('upload_missing', `Nothing has been uploaded for submission ${id}.`);
	}

	const { size } = await file.stat();

	if (size !== row.bundleSize) {
		await file.delete();

		if (size > ctx.env.ADDON_MAX_BYTES) {
			throw new ApiError(
				'artifact_too_large',
				`Bundles may be at most ${ctx.env.ADDON_MAX_BYTES} bytes.`,
			);
		}

		throw new ApiError(
			'upload_size_mismatch',
			`Uploaded ${size} bytes but declared ${row.bundleSize}.`,
		);
	}

	const sha256 = await hashObject(file);

	const [updated] = await ctx.db
		.update(submission)
		.set({ status: 'pending_review', sha256, submittedAt: ctx.now() })
		.where(and(eq(submission.id, id), eq(submission.status, 'awaiting_upload')))
		.returning();

	if (!updated) {
		throw new ApiError('submission_not_awaiting_upload', `Submission ${id} changed meanwhile.`);
	}

	return { submission: toSubmission(updated) };
}

export default {
	OPEN_SUBMISSION_STATUSES,
	REPLACEABLE_SUBMISSION_STATUSES,
	toSubmission,
	createSubmission,
	finalizeSubmission,
};
