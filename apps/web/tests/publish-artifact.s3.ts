import { myAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import finalizeSubmissionEndpoint from '~/endpoints/finalize-submission';
import createSubmissionEndpoint from '~/endpoints/create-submission';
import myAddonsEndpoint from '~/endpoints/my-addons';
import { publishArtifact } from '~/api/publish';
import { createApiClient } from '~/api/client';
import { submission } from '~/db/schema';
import type { Api } from '~/api';

import {
	S3_TEST_ENV,
	browserSessionHeaders,
	createTestContext,
	signInWithDiscord,
} from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';
import { manifest } from './helpers/addons';

const MAX_BYTES = 64;

const { ctx, close } = createTestContext({ ...S3_TEST_ENV, ADDON_MAX_BYTES: String(MAX_BYTES) });

const server = serveEndpoints(ctx, {
	'POST /api/v1/submissions': createSubmissionEndpoint,
	'POST /api/v1/submissions/$id/finalize': finalizeSubmissionEndpoint,
	'GET /api/v1/me/addons': myAddonsEndpoint,
});

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await server.stop(true);
	close();
});

let users = 0;

// The browser calls the API with its session cookie, not a bearer token.
async function signUpInBrowser() {
	users += 1;

	const { token } = await signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Browser Publisher ${users}`,
		email: `browser-publisher-${users}@example.com`,
	});

	return createApiClient<Api>({
		baseUrl: server.url.href,
		headers: await browserSessionHeaders(ctx, token),
	});
}

describe('publishing from the browser', () => {
	test('a new listing is uploaded, finalized and listed as pending on the dashboard', async () => {
		const request = await signUpInBrowser();
		const bundle = new Blob(['console.log("hello");'], { type: 'text/javascript' });

		const published = await publishArtifact(request, {
			manifest: manifest('browser.publish'),
			bundle,
			changelog: 'First release.',
		});

		const dashboard = await request('GET /api/v1/me/addons', {
			response: myAddonsResponseSchema,
		});

		expect(published.status).toBe('pending_review');
		expect(dashboard.openListings.map(({ id, status }) => ({ id, status }))).toEqual([
			{ id: published.id, status: 'pending_review' },
		]);

		const [row] = await ctx.db.select().from(submission).where(eq(submission.id, published.id));

		expect(await ctx.storage.staging.file(row?.stagingKey ?? '').text()).toBe(
			'console.log("hello");',
		);
	});

	test('an oversize bundle is refused with the server limit before anything is reserved', async () => {
		const request = await signUpInBrowser();
		const bundle = new Blob(['x'.repeat(MAX_BYTES + 1)]);

		expect(
			await failure(publishArtifact(request, { manifest: manifest('browser.big'), bundle })),
		).toEqual({ status: 413, code: 'artifact_too_large' });
		expect(
			await ctx.db.select().from(submission).where(eq(submission.addonId, 'browser.big')),
		).toEqual([]);
	});

	test('republishing after changes were requested replaces the submission and clears the note', async () => {
		const request = await signUpInBrowser();
		const first = await publishArtifact(request, {
			manifest: manifest('browser.republish'),
			bundle: new Blob(['first']),
		});

		await ctx.db
			.update(submission)
			.set({
				status: 'changes_requested',
				reviewDecision: 'changes_requested',
				reviewNote: 'Rename the settings page.',
				reviewedAt: ctx.now(),
			})
			.where(eq(submission.id, first.id));

		const before = await request('GET /api/v1/me/addons', { response: myAddonsResponseSchema });

		expect(before.openListings[0]?.review?.note).toBe('Rename the settings page.');

		const second = await publishArtifact(request, {
			manifest: manifest('browser.republish'),
			bundle: new Blob(['second']),
		});

		const after = await request('GET /api/v1/me/addons', { response: myAddonsResponseSchema });

		expect(
			after.openListings.map(({ id, status, review }) => ({ id, status, review })),
		).toEqual([{ id: second.id, status: 'pending_review', review: null }]);
	});
});
