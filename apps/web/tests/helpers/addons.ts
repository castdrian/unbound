import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { eq } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission, user } from '~/db/schema';
import type { SubmissionRow } from '~/lib/submissions';
import type { AppContext } from '~/lib/context';
import { toVersionRow } from '~/lib/review';

type SubmissionInsert = typeof submission.$inferInsert;

/**
 * @description Builds a valid manifest for tests.
 * @param id The addon id.
 * @param version The version.
 * @param overrides Fields to replace, e.g. `unbound`.
 * @returns The manifest.
 */
export function manifest(
	id: string,
	version: string = '1.0.0',
	overrides: Partial<PublishedManifest> = {},
): PublishedManifest {
	return {
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Mario', id: '1234567890' }],
		version,
		main: 'index.js',
		...overrides,
	};
}

/**
 * @description Stores a finalized submission row directly, without touching object storage.
 * @param ctx The application context.
 * @param authorId The submitting user.
 * @param published The submitted manifest.
 * @param overrides Columns to replace, e.g. `kind` and `status`.
 * @returns The submission row.
 */
export async function seedSubmission(
	ctx: AppContext,
	authorId: string,
	published: PublishedManifest,
	overrides: Partial<SubmissionInsert> = {},
): Promise<SubmissionRow> {
	const id = Bun.randomUUIDv7();

	const [row] = await ctx.db
		.insert(submission)
		.values({
			id,
			addonId: published.id,
			authorId,
			kind: 'listing',
			status: 'pending_review',
			version: published.version,
			manifest: published,
			changelog: `Changes in ${published.version}.`,
			bundleSize: 1024,
			stagingKey: `submissions/${id}/bundle`,
			uploadExpiresAt: ctx.now(),
			sha256: new Bun.CryptoHasher('sha256').update(id).digest('hex'),
			createdAt: ctx.now(),
			submittedAt: ctx.now(),
			...overrides,
		})
		.returning();

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	return row;
}

/**
 * @description Stores an approved submission and its live version row, as approval would, without
 * touching object storage.
 * @param ctx The application context.
 * @param authorId The submitting user.
 * @param published The approved manifest.
 * @param sha256 The bundle's SHA-256; defaults to a digest of the version for tests that never
 * download the bundle.
 * @returns The approved submission row.
 */
export async function seedVersion(
	ctx: AppContext,
	authorId: string,
	published: PublishedManifest,
	sha256: string = new Bun.CryptoHasher('sha256').update(published.version).digest('hex'),
): Promise<SubmissionRow> {
	const row = await seedSubmission(ctx, authorId, published, { status: 'approved', sha256 });

	await ctx.db.insert(addonVersion).values(toVersionRow(row, sha256, ctx.now()));

	return row;
}

/**
 * @description Stores an approved addon owned by `ownerId` with one live version, and gives the owner
 * the `developer` role first approval grants.
 * @param ctx The application context.
 * @param ownerId The owner.
 * @param published The first approved manifest.
 * @returns The approved submission row.
 */
export async function seedApprovedAddon(
	ctx: AppContext,
	ownerId: string,
	published: PublishedManifest,
): Promise<SubmissionRow> {
	await ctx.db.insert(addon).values({ id: published.id });
	await ctx.db
		.insert(addonMaintainer)
		.values({ addonId: published.id, userId: ownerId, role: 'owner' });
	await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, ownerId));

	return seedVersion(ctx, ownerId, published);
}
