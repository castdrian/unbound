import { afterAll, describe, expect, test } from 'bun:test';

import { createTestContext } from './helpers/context';

// Run through `bun scripts/test-s3.ts`, which starts MinIO and provides these.
const { ctx, close } = createTestContext({
	S3_ENDPOINT: process.env.S3_ENDPOINT,
	S3_REGION: process.env.S3_REGION,
	S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
	S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
	S3_STAGING_BUCKET: process.env.S3_STAGING_BUCKET,
	S3_PUBLIC_BUCKET: process.env.S3_PUBLIC_BUCKET,
});

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
