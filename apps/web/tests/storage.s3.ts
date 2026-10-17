import { afterAll, describe, expect, test } from 'bun:test';

import { presignStagingUpload } from '~/lib/storage';

import { S3_TEST_ENV, createTestContext } from './helpers/context';

const { ctx, close } = createTestContext(S3_TEST_ENV);

const key = `tests/${crypto.randomUUID()}/index.js`;

afterAll(async () => {
	await Promise.all([ctx.storage.staging.delete(key), ctx.storage.public.delete(key)]);
	close();
});

describe('createStorage', () => {
	test('staging and public are separate buckets', async () => {
		await ctx.storage.staging.write(key, 'staged');

		expect(await ctx.storage.staging.file(key).text()).toBe('staged');
		expect(await ctx.storage.public.exists(key)).toBe(false);

		await ctx.storage.public.write(key, 'published');

		expect(await ctx.storage.public.file(key).text()).toBe('published');
		expect(await ctx.storage.staging.file(key).text()).toBe('staged');
	});

	test('presigns a staging download for reviewers', async () => {
		const url = ctx.storage.staging.presign(key, { method: 'GET', expiresIn: 60 });
		const response = await fetch(url);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe('staged');
	});
});

describe('presignStagingUpload', () => {
	const uploadKey = `tests/${crypto.randomUUID()}/bundle`;

	afterAll(() => ctx.storage.staging.delete(uploadKey));

	function presign(signedAt: Date = new Date()) {
		return presignStagingUpload(ctx.env, { key: uploadKey, size: 5, signedAt, expiresIn: 60 });
	}

	test('rejects a body of a different length', async () => {
		const { url, headers } = presign();
		const response = await fetch(url, { method: 'PUT', headers, body: 'too long' });

		expect(response.ok).toBe(false);
		expect(await ctx.storage.staging.exists(uploadKey)).toBe(false);
	});

	test('rejects an expired URL', async () => {
		const { url, headers } = presign(new Date(Date.now() - 120_000));
		const response = await fetch(url, { method: 'PUT', headers, body: 'hello' });

		expect(response.status).toBe(403);
		expect(await ctx.storage.staging.exists(uploadKey)).toBe(false);
	});

	test('uploads once and refuses to overwrite', async () => {
		const { url, headers } = presign();

		expect((await fetch(url, { method: 'PUT', headers, body: 'hello' })).status).toBe(200);
		expect((await fetch(url, { method: 'PUT', headers, body: 'world' })).status).toBe(412);
		expect(await ctx.storage.staging.file(uploadKey).text()).toBe('hello');
	});
});
