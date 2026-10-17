import {
	createTestContext,
	schema,
	signInWithDiscord,
	snowflakeAt,
} from '@unbound-app/web/testing';
import { afterAll, describe, expect, test } from 'bun:test';

import { addonFiles, createApiKey, servePublishApi } from './helpers/publish';
import { createTempDir, runUbd } from './helpers/ubd';

const ADDON_MAX_BYTES = 64;

const { ctx, close } = createTestContext({ ADDON_MAX_BYTES: String(ADDON_MAX_BYTES) });
const server = servePublishApi(ctx);
const config = createTempDir();
const dirs = [config];

afterAll(async () => {
	await server.stop(true);

	for (const dir of dirs) dir.remove();

	close();
});

let users = 0;

async function publisher(discordId: string) {
	users += 1;

	const { headers } = await signInWithDiscord(ctx, {
		id: discordId,
		name: `Publisher ${users}`,
		email: `publisher-${users}@example.com`,
	});

	return createApiKey(ctx, headers);
}

function publish(id: string, bundle: string, apiKey: string | undefined) {
	const addon = createTempDir(addonFiles(id, { 'index.js': bundle }));

	dirs.push(addon);

	return runUbd(['publish'], addon.path, {
		UNBOUND_API_URL: server.url.href,
		UNBOUND_API_KEY: apiKey,
		XDG_CONFIG_HOME: config.path,
	});
}

async function submissionCount() {
	const rows = await ctx.db.select({ id: schema.submission.id }).from(schema.submission);

	return rows.length;
}

describe('ubd publish failures', () => {
	test('an oversize bundle is refused with the server limit before any upload is reserved', async () => {
		const key = await publisher('80351110224678912');
		const result = await publish('publish.oversize', 'x'.repeat(ADDON_MAX_BYTES + 1), key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe(
			`Bundles may be at most ${ADDON_MAX_BYTES} bytes. (artifact_too_large)\n`,
		);
		expect(await submissionCount()).toBe(0);
	});

	test('a spam gate prints the server error code and message', async () => {
		const key = await publisher(snowflakeAt(new Date()));
		const result = await publish('publish.too-new', 'export {};', key);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe(
			'Your Discord account must be at least 30 days old to submit addons. (account_too_new)\n',
		);
		expect(await submissionCount()).toBe(0);
	});

	test('publishing without a login or API key asks to log in', async () => {
		const result = await publish('publish.anonymous', 'export {};', undefined);

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toBe('Not logged in. Run `ubd login`, or set UNBOUND_API_KEY.\n');
	});
});
