import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import createSubmissionEndpoint from '~/endpoints/create-submission';
import type { AppContext } from '~/lib/context';
import { submission, user } from '~/db/schema';
import { sweepStaging } from '~/lib/staging';

import { S3_TEST_ENV, authRequest, createTestContext, signInWithDiscord } from './helpers/context';
import { manifest, seedApprovedAddon, seedSubmission } from './helpers/addons';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const MINUTE_MS = 60_000;

const base = createTestContext(S3_TEST_ENV);
const ctx: AppContext = { ...base.ctx, now: () => NOW };

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	base.close();
});

let users = 0;

async function signUp() {
	users += 1;

	return signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Author ${users}`,
		email: `author-${users}@example.com`,
	});
}

function staged(key: string) {
	return ctx.storage.staging.exists(key);
}

function statusOf(id: string) {
	return ctx.db.select().from(submission).where(eq(submission.id, id)).get()?.status;
}

describe('sweepStaging', () => {
	test('deletes staged objects no open submission owns and keeps the rest', async () => {
		const { userId } = await signUp();
		const pending = await seedSubmission(ctx, userId, manifest('sweep.pending'));
		const approved = await seedSubmission(ctx, userId, manifest('sweep.approved'), {
			status: 'approved',
		});
		const orphan = `submissions/${Bun.randomUUIDv7()}/bundle`;

		await Promise.all(
			[pending.stagingKey, approved.stagingKey, orphan].map((key) =>
				ctx.storage.staging.write(key, 'bundle'),
			),
		);

		await sweepStaging(ctx);

		expect(await staged(pending.stagingKey)).toBe(true);
		expect(await staged(approved.stagingKey)).toBe(false);
		expect(await staged(orphan)).toBe(false);
	});

	test('expires lapsed reservations and deletes what they uploaded', async () => {
		const { userId } = await signUp();
		const lapsed = await seedSubmission(ctx, userId, manifest('sweep.lapsed'), {
			status: 'awaiting_upload',
			uploadExpiresAt: new Date(NOW.getTime() - MINUTE_MS),
		});
		const open = await seedSubmission(ctx, userId, manifest('sweep.open'), {
			status: 'awaiting_upload',
			uploadExpiresAt: new Date(NOW.getTime() + MINUTE_MS),
		});

		await ctx.storage.staging.write(lapsed.stagingKey, 'partial');
		await ctx.storage.staging.write(open.stagingKey, 'uploading');

		const result = await sweepStaging(ctx);

		expect(result.expired).toBe(1);
		expect(statusOf(lapsed.id)).toBe('expired');
		expect(await staged(lapsed.stagingKey)).toBe(false);
		expect(statusOf(open.id)).toBe('awaiting_upload');
		expect(await staged(open.stagingKey)).toBe(true);
	});
});

describe('banning a user', () => {
	test('cancels their open submissions, deletes their staged files and frees their ids', async () => {
		const banned = await signUp();
		const admin = await signUp();
		const other = await signUp();

		await ctx.db.update(user).set({ role: 'admin' }).where(eq(user.id, admin.userId));
		await seedApprovedAddon(ctx, banned.userId, manifest('ban.approved'));

		const listing = await seedSubmission(ctx, banned.userId, manifest('ban.listing'));
		const update = await seedSubmission(ctx, banned.userId, manifest('ban.approved', '1.1.0'), {
			kind: 'update',
			status: 'changes_requested',
		});

		await ctx.storage.staging.write(listing.stagingKey, 'listing');
		await ctx.storage.staging.write(update.stagingKey, 'update');

		const response = await authRequest(ctx, '/admin/ban-user', {
			method: 'POST',
			headers: admin.headers,
			body: JSON.stringify({ userId: banned.userId, banReason: 'Spam' }),
		});

		expect(response.status).toBe(200);
		expect([statusOf(listing.id), statusOf(update.id)]).toEqual(['cancelled', 'cancelled']);
		expect(await staged(listing.stagingKey)).toBe(false);
		expect(await staged(update.stagingKey)).toBe(false);

		const claimed = await createSubmissionEndpoint.handle(
			ctx,
			new Request(new URL('/api/v1/submissions', ctx.env.PUBLIC_URL), {
				method: 'POST',
				headers: other.headers,
				body: JSON.stringify({ manifest: manifest('ban.listing'), bundleSize: 7 }),
			}),
		);

		expect(createSubmissionResponseSchema.parse(await claimed.json()).submission.kind).toBe(
			'listing',
		);
		expect(
			await ctx.db.query.addonVersion.findFirst({ where: { addonId: 'ban.approved' } }),
		).toBeDefined();
	});
});
