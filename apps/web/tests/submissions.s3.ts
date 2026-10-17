import {
	createSubmissionResponseSchema,
	finalizeSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import type { CreateSubmissionResponse, SubmissionUpload } from '@unbound-app/contracts/publish';
import { afterAll, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import finalizeSubmissionEndpoint from '~/endpoints/finalize-submission';
import createSubmissionEndpoint from '~/endpoints/create-submission';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import { submission } from '~/db/schema';
import type { Api } from '~/api';

import { S3_TEST_ENV, createTestContext, signInWithDiscord } from './helpers/context';

const base = createTestContext(S3_TEST_ENV);

// `undefined` follows the real clock, which the presigned URLs must agree with to be accepted.
let pinned: Date | undefined;
const ctx: AppContext = { ...base.ctx, now: () => pinned ?? new Date() };

const server = Bun.serve({
	port: 0,
	routes: {
		'/api/v1/submissions': {
			POST: (request) => createSubmissionEndpoint.handle(ctx, request),
		},
		'/api/v1/submissions/:id/finalize': {
			POST: (request) => finalizeSubmissionEndpoint.handle(ctx, request, request.params),
		},
	},
});

afterAll(async () => {
	const rows = await ctx.db.select({ key: submission.stagingKey }).from(submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await server.stop(true);
	base.close();
});

let users = 0;

async function signUp() {
	users += 1;

	const { headers } = await signInWithDiscord(ctx, {
		id: '80351110224678912',
		name: `Publisher ${users}`,
		email: `publisher-${users}@example.com`,
	});

	return createApiClient<Api>({ baseUrl: server.url.href, headers });
}

type Client = Awaited<ReturnType<typeof signUp>>;

function create(client: Client, id: string, bundle: string): Promise<CreateSubmissionResponse> {
	return client('POST /api/v1/submissions', {
		body: {
			manifest: {
				id,
				name: 'Hello',
				description: 'Says hello.',
				authors: [{ name: 'Mario', id: '1234567890' }],
				version: '1.0.0',
				main: 'index.js',
			},
			bundleSize: Buffer.byteLength(bundle),
		},
		response: createSubmissionResponseSchema,
	});
}

function upload({ url, method, headers }: SubmissionUpload, bundle: string) {
	return fetch(url, { method, headers, body: bundle });
}

function finalize(client: Client, id: string) {
	return client('POST /api/v1/submissions/$id/finalize', {
		params: { id },
		response: finalizeSubmissionResponseSchema,
	});
}

function finalizeFailure(client: Client, id: string) {
	return finalize(client, id).catch((cause: unknown) => cause);
}

function findRow(id: string) {
	const row = ctx.db.select().from(submission).where(eq(submission.id, id)).get();

	if (!row) {
		throw new Error(`Submission ${id} was not stored.`);
	}

	return row;
}

describe('publishing a new listing', () => {
	test('creates, uploads and finalizes a submission into pending review', async () => {
		const client = await signUp();
		const bundle = 'console.log("hello");';
		const created = await create(client, 's3.publish', bundle);

		expect((await upload(created.upload, bundle)).status).toBe(200);

		const { submission: finalized } = await finalize(client, created.submission.id);
		const row = findRow(created.submission.id);

		expect(finalized.status).toBe('pending_review');
		expect(row.sha256).toBe(new Bun.CryptoHasher('sha256').update(bundle).digest('hex'));
		expect(await ctx.storage.staging.file(row.stagingKey).text()).toBe(bundle);
	});

	test('the upload URL works once and finalize runs once', async () => {
		const client = await signUp();
		const bundle = 'export default 1;';
		const created = await create(client, 's3.single-use', bundle);

		await upload(created.upload, bundle);
		await finalize(client, created.submission.id);

		expect((await upload(created.upload, 'export default 2;')).status).toBe(412);
		expect(await finalizeFailure(client, created.submission.id)).toMatchObject({
			code: 'submission_not_awaiting_upload',
			status: 409,
		});

		const { stagingKey } = findRow(created.submission.id);

		expect(await ctx.storage.staging.file(stagingKey).text()).toBe(bundle);
	});

	test('an upload larger than the declared size is refused', async () => {
		const client = await signUp();
		const created = await create(client, 's3.oversized', 'small');

		expect((await upload(created.upload, 'much larger than declared')).ok).toBe(false);
		expect(await finalizeFailure(client, created.submission.id)).toMatchObject({
			code: 'upload_missing',
			status: 409,
		});
	});

	test('an expired upload URL is refused and finalize reports the expiry', async () => {
		const client = await signUp();

		pinned = new Date(Date.now() - (ctx.env.SUBMISSION_UPLOAD_TTL_SECONDS + 60) * 1000);

		const created = await create(client, 's3.expired', 'late');

		pinned = undefined;

		expect((await upload(created.upload, 'late')).status).toBe(403);
		expect(await finalizeFailure(client, created.submission.id)).toMatchObject({
			code: 'upload_expired',
			status: 410,
		});
	});

	test('a staged object of the wrong size is deleted on finalize', async () => {
		const client = await signUp();
		const created = await create(client, 's3.mismatch', 'four');
		const { stagingKey } = findRow(created.submission.id);

		// Written past the presigned URL, as a store that ignores the signed length would allow.
		await ctx.storage.staging.write(stagingKey, 'eight!!!');

		expect(await finalizeFailure(client, created.submission.id)).toMatchObject({
			code: 'upload_size_mismatch',
			status: 400,
		});
		expect(await ctx.storage.staging.exists(stagingKey)).toBe(false);
	});
});

describe('republishing', () => {
	test('after changes are requested, a new submission replaces the staged artifact', async () => {
		const client = await signUp();
		const first = await create(client, 's3.republish', 'first');

		await upload(first.upload, 'first');
		await finalize(client, first.submission.id);
		await ctx.db
			.update(submission)
			.set({ status: 'changes_requested' })
			.where(eq(submission.id, first.submission.id));

		const second = await create(client, 's3.republish', 'second');
		const replaced = findRow(first.submission.id);

		expect(second.submission.id).not.toBe(first.submission.id);
		expect(replaced.status).toBe('superseded');
		expect(await ctx.storage.staging.exists(replaced.stagingKey)).toBe(false);

		await upload(second.upload, 'second');

		expect((await finalize(client, second.submission.id)).submission.status).toBe(
			'pending_review',
		);
	});
});
