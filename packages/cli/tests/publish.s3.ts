import {
	S3_TEST_ENV,
	createTestContext,
	schema,
	signInWithDiscord,
} from '@unbound-app/web/testing';
import { afterAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { addonFiles, createApiKey, servePublishApi } from './helpers/publish';
import { createTempDir, runUbd } from './helpers/ubd';

const { ctx, close } = createTestContext(S3_TEST_ENV);
const server = servePublishApi(ctx);
const config = createTempDir();

const addon = createTempDir(
	addonFiles(
		'publish.sample',
		{
			'package.json': JSON.stringify({
				scripts: { build: 'bun build index.ts --outdir dist' },
			}),
			'index.ts': 'export const greeting: string = "hello";\n',
		},
		'index.ts',
	),
);

afterAll(async () => {
	const rows = await ctx.db.select({ key: schema.submission.stagingKey }).from(schema.submission);

	await Promise.all(rows.map((row) => ctx.storage.staging.delete(row.key)));
	await server.stop(true);
	addon.remove();
	config.remove();
	close();
});

describe('ubd publish', () => {
	test('with only an API key in env, builds, uploads and leaves a submission pending review', async () => {
		const { headers } = await signInWithDiscord(ctx, {
			id: '80351110224678912',
			name: 'Publisher',
			email: 'publisher@example.com',
		});

		const result = await runUbd(['publish', '--changelog', 'First release.'], addon.path, {
			UNBOUND_API_URL: server.url.href,
			UNBOUND_API_KEY: await createApiKey(ctx, headers),
			XDG_CONFIG_HOME: config.path,
		});

		expect(result.exitCode).toBe(0);

		const row = await ctx.db.query.submission.findFirst({
			where: { addonId: 'publish.sample' },
		});

		const bundle = Bun.file(join(addon.path, 'dist', 'index.js'));
		const sha256 = new Bun.CryptoHasher('sha256').update(await bundle.bytes()).digest('hex');

		expect(row).toMatchObject({
			status: 'pending_review',
			kind: 'listing',
			changelog: 'First release.',
			bundleSize: bundle.size,
			sha256,
			manifest: { id: 'publish.sample', main: 'index.js' },
		});
		expect(result.stdout).toEndWith(
			`Submitted publish.sample 1.0.0 as listing ${row?.id} (unverified source): pending_review.\n`,
		);
		expect(await ctx.storage.staging.exists(row?.stagingKey ?? '')).toBe(true);
	});
});
