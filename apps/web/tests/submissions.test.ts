import { createSubmissionResponseSchema } from '@unbound-app/contracts/publish';
import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { addon, addonMaintainer, addonVersion, submission, user } from '~/db/schema';
import createSubmissionEndpoint from '~/endpoints/create-submission';
import type { AppContext } from '~/lib/context';
import { API_KEY_HEADER } from '~/api/client';

import {
	authRequest,
	authorizeDevice,
	browserSessionHeaders,
	createTestContext,
	linkGitHub,
	signInWithDiscord,
	snowflakeAt,
} from './helpers/context';

const NOW = new Date('2026-10-17T12:00:00.000Z');
const DAY_MS = 86_400_000;
const REPOSITORY = 'unbound-mod/hello';

// GitHub's `GET /repos/{owner}/{repo}` for one repository, answering per access token.
const github = Bun.serve({
	port: 0,
	routes: {
		[`/repos/${REPOSITORY}`]: (request) => {
			const push = { 'Bearer pusher': true, 'Bearer reader': false }[
				request.headers.get('authorization') ?? ''
			];

			if (push === undefined) {
				return Response.json({ message: 'Bad credentials' }, { status: 401 });
			}

			return Response.json({
				full_name: REPOSITORY,
				permissions: { admin: false, maintain: false, push, triage: true, pull: true },
			});
		},
	},
});

const base = createTestContext({ GITHUB_API_URL: github.url.href });
const ctx: AppContext = { ...base.ctx, now: () => NOW };

afterAll(async () => {
	await github.stop(true);
	base.close();
});

type SubmitRequest = Partial<CreateSubmissionRequest> & Pick<CreateSubmissionRequest, 'manifest'>;

let users = 0;

function manifest(id: string, version: string = '1.0.0'): PublishedManifest {
	return {
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Mario', id: '1234567890' }],
		version,
		main: 'index.js',
	};
}

async function signUp(target: AppContext = ctx, accountAgeDays: number = 365) {
	users += 1;

	return signInWithDiscord(target, {
		id: snowflakeAt(new Date(target.now().getTime() - accountAgeDays * DAY_MS)),
		name: `User ${users}`,
		email: `user-${users}@example.com`,
	});
}

function submit(headers: Headers, request: SubmitRequest, target: AppContext = ctx) {
	return createSubmissionEndpoint.handle(
		target,
		new Request(new URL('/api/v1/submissions', target.env.PUBLIC_URL), {
			method: 'POST',
			headers,
			body: JSON.stringify({ bundleSize: 1024, ...request }),
		}),
	);
}

async function accepted(response: Response) {
	expect(response.status).toBe(200);

	return createSubmissionResponseSchema.parse(await response.json());
}

async function refused(response: Response) {
	const { error } = apiErrorResponseSchema.parse(await response.json());

	return { status: response.status, code: error.code };
}

// Stands in for the review slice approving a first listing.
async function seedApprovedAddon(ownerId: string, id: string, version: string = '1.0.0') {
	const submissionId = crypto.randomUUID();

	await ctx.db.insert(submission).values({
		id: submissionId,
		addonId: id,
		authorId: ownerId,
		kind: 'listing',
		status: 'approved',
		version,
		manifest: manifest(id, version),
		bundleSize: 1024,
		stagingKey: `submissions/${submissionId}/bundle`,
		uploadExpiresAt: new Date(0),
		sha256: 'a'.repeat(64),
		createdAt: new Date(0),
	});

	await ctx.db.insert(addon).values({ id });
	await ctx.db.insert(addonMaintainer).values({ addonId: id, userId: ownerId, role: 'owner' });
	await ctx.db.insert(addonVersion).values({
		addonId: id,
		version,
		submissionId,
		manifest: manifest(id, version),
		bundleSize: 1024,
		sha256: 'a'.repeat(64),
	});

	await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, ownerId));
}

describe('authentication', () => {
	test('accepts a browser session, a device-flow session and an API key', async () => {
		const browser = await signUp();
		const device = await signUp();
		const ci = await signUp();

		const created = await authRequest(ctx, '/api-key/create', {
			method: 'POST',
			headers: ci.headers,
			body: JSON.stringify({ name: 'ci' }),
		});

		const { key } = await created.json();

		const responses = await Promise.all([
			submit(await browserSessionHeaders(ctx, browser.token), {
				manifest: manifest('auth.browser'),
			}),
			submit(await authorizeDevice(ctx, device.headers), {
				manifest: manifest('auth.device'),
			}),
			submit(new Headers({ [API_KEY_HEADER]: key }), { manifest: manifest('auth.api-key') }),
		]);

		expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
	});

	test('rejects an anonymous caller', async () => {
		const response = await submit(new Headers(), { manifest: manifest('auth.anonymous') });

		expect(await refused(response)).toEqual({ status: 401, code: 'unauthorized' });
	});
});

describe('new listings', () => {
	test('claims the addon id and reserves a single-use upload of the declared size', async () => {
		const { userId, headers } = await signUp();
		const result = await accepted(
			await submit(headers, { manifest: manifest('listing.claim') }),
		);

		expect(result.submission).toEqual({
			id: expect.any(String),
			addonId: 'listing.claim',
			version: '1.0.0',
			kind: 'listing',
			status: 'awaiting_upload',
			repository: null,
			unverifiedSource: true,
		});

		expect(result.upload.method).toBe('PUT');
		expect(result.upload.headers).toEqual({ 'content-length': '1024', 'if-none-match': '*' });
		expect(result.upload.expiresAt).toBe(
			new Date(NOW.getTime() + ctx.env.SUBMISSION_UPLOAD_TTL_SECONDS * 1000).toISOString(),
		);

		const row = await ctx.db.query.submission.findFirst({
			where: { id: result.submission.id },
		});

		expect(row).toMatchObject({ authorId: userId, bundleSize: 1024, sha256: null });
		expect(new URL(result.upload.url).pathname).toBe(
			`/${ctx.env.S3_STAGING_BUCKET}/${row?.stagingKey}`,
		);
	});

	test('refuses an id another user has claimed', async () => {
		const first = await signUp();
		const second = await signUp();

		await accepted(await submit(first.headers, { manifest: manifest('listing.taken') }));

		const response = await submit(second.headers, { manifest: manifest('listing.taken') });

		expect(await refused(response)).toEqual({ status: 409, code: 'addon_id_taken' });
	});

	test('releases the id once the claiming submission is rejected', async () => {
		const first = await signUp();
		const second = await signUp();
		const claimed = await accepted(
			await submit(first.headers, { manifest: manifest('listing.released') }),
		);

		await ctx.db
			.update(submission)
			.set({ status: 'rejected' })
			.where(eq(submission.id, claimed.submission.id));

		const result = await accepted(
			await submit(second.headers, { manifest: manifest('listing.released') }),
		);

		expect(result.submission.kind).toBe('listing');
	});

	test('caps the pending new listings per user', async () => {
		const { headers } = await signUp();

		await accepted(await submit(headers, { manifest: manifest('cap.one') }));
		await accepted(await submit(headers, { manifest: manifest('cap.two') }));

		const response = await submit(headers, { manifest: manifest('cap.three') });

		expect(await refused(response)).toEqual({ status: 409, code: 'pending_listing_cap' });
	});

	test('rejects a bundle over ADDON_MAX_BYTES without reserving the id', async () => {
		const { headers } = await signUp();
		const response = await submit(headers, {
			manifest: manifest('listing.huge'),
			bundleSize: ctx.env.ADDON_MAX_BYTES + 1,
		});

		expect(await refused(response)).toEqual({ status: 413, code: 'artifact_too_large' });
		expect(
			await ctx.db.query.submission.findFirst({ where: { addonId: 'listing.huge' } }),
		).toBeUndefined();
	});

	test('rejects a manifest that fails the shared contract', async () => {
		const { headers } = await signUp();
		const response = await submit(headers, {
			manifest: { ...manifest('listing.invalid'), version: 'one' },
		});

		expect(await refused(response)).toEqual({ status: 400, code: 'invalid_request' });
	});
});

describe('account age', () => {
	test('requires a Discord account at least SUBMISSION_MIN_ACCOUNT_AGE_DAYS old', async () => {
		const days = ctx.env.SUBMISSION_MIN_ACCOUNT_AGE_DAYS;
		const young = await signUp(ctx, days - 1);
		const old = await signUp(ctx, days);

		const response = await submit(young.headers, { manifest: manifest('age.young') });

		expect(await refused(response)).toEqual({ status: 403, code: 'account_too_new' });
		await accepted(await submit(old.headers, { manifest: manifest('age.old') }));
	});
});

describe('updates', () => {
	test('a user who does not maintain the addon cannot submit an update', async () => {
		const owner = await signUp();
		const stranger = await signUp();

		await seedApprovedAddon(owner.userId, 'update.foreign');

		const response = await submit(stranger.headers, {
			manifest: manifest('update.foreign', '1.1.0'),
		});

		expect(await refused(response)).toEqual({ status: 403, code: 'not_maintainer' });
	});

	test('allows one pending update per addon across its maintainers', async () => {
		const owner = await signUp();
		const maintainer = await signUp();

		await seedApprovedAddon(owner.userId, 'update.pending');
		await ctx.db.insert(addonMaintainer).values({
			addonId: 'update.pending',
			userId: maintainer.userId,
			role: 'maintainer',
		});
		await ctx.db.update(user).set({ role: 'developer' }).where(eq(user.id, maintainer.userId));

		const first = await accepted(
			await submit(owner.headers, { manifest: manifest('update.pending', '1.1.0') }),
		);

		const response = await submit(maintainer.headers, {
			manifest: manifest('update.pending', '1.2.0'),
		});

		expect(first.submission.kind).toBe('update');
		expect(await refused(response)).toEqual({ status: 409, code: 'pending_update_exists' });
	});

	test('refuses a version the addon already has', async () => {
		const owner = await signUp();

		await seedApprovedAddon(owner.userId, 'update.existing');

		const response = await submit(owner.headers, { manifest: manifest('update.existing') });

		expect(await refused(response)).toEqual({ status: 409, code: 'version_exists' });
	});
});

describe('source verification', () => {
	test('a named repository requires a linked GitHub account', async () => {
		const { headers } = await signUp();
		const response = await submit(headers, {
			manifest: manifest('source.unlinked'),
			repository: REPOSITORY,
		});

		expect(await refused(response)).toEqual({ status: 403, code: 'github_not_linked' });
	});

	test('a named repository requires push access', async () => {
		const { userId, headers } = await signUp();

		await linkGitHub(ctx, userId, 'reader');

		const response = await submit(headers, {
			manifest: manifest('source.reader'),
			repository: REPOSITORY,
		});

		expect(await refused(response)).toEqual({ status: 403, code: 'github_no_push_access' });
	});

	test('a repository the author can push to is recorded as a verified source', async () => {
		const { userId, headers } = await signUp();

		await linkGitHub(ctx, userId, 'pusher');

		const result = await accepted(
			await submit(headers, { manifest: manifest('source.pusher'), repository: REPOSITORY }),
		);

		expect(result.submission).toMatchObject({
			repository: REPOSITORY,
			unverifiedSource: false,
		});
	});

	test('a revoked GitHub token asks the author to link GitHub again', async () => {
		const { userId, headers } = await signUp();

		await linkGitHub(ctx, userId, 'revoked');

		const response = await submit(headers, {
			manifest: manifest('source.revoked'),
			repository: REPOSITORY,
		});

		expect(await refused(response)).toEqual({ status: 403, code: 'github_not_linked' });
	});
});

describe('rate limiting', () => {
	test('limits submissions per user within SUBMISSION_RATE_LIMIT_WINDOW_SECONDS', async () => {
		const limited = createTestContext({
			SUBMISSION_RATE_LIMIT_MAX: '2',
			SUBMISSION_MAX_PENDING_LISTINGS: '10',
		});

		let clock = NOW;
		const target: AppContext = { ...limited.ctx, now: () => clock };

		try {
			const { headers } = await signUp(target);

			await accepted(await submit(headers, { manifest: manifest('rate.one') }, target));
			await accepted(await submit(headers, { manifest: manifest('rate.two') }, target));

			const response = await submit(headers, { manifest: manifest('rate.three') }, target);

			expect(await refused(response)).toEqual({ status: 429, code: 'rate_limited' });

			clock = new Date(
				NOW.getTime() + target.env.SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000 + 1,
			);

			await accepted(await submit(headers, { manifest: manifest('rate.three') }, target));
		} finally {
			limited.close();
		}
	});
});
