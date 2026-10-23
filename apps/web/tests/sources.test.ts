import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { catalogResponseSchema } from '@unbound-app/contracts/addons';
import type { Changelog } from '@unbound-app/contracts/changelog';

import checkUpdatesEndpoint from '~/endpoints/check-updates';
import getCatalogEndpoint from '~/endpoints/get-catalog';
import { createApiClient } from '~/api/client';
import { getAddonDetails } from '~/lib/addons';
import { findUpdates } from '~/lib/updates';
import type { Api } from '~/api';

import {
	shippedCatalogResponseSchema,
	shippedUpdatesResponseSchema,
} from './helpers/shipped-contracts';
import { manifest, REPOSITORY_DETAILS, seedApprovedAddon, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { serveEndpoints } from './helpers/server';

const base = createTestContext();
const ctx = base.ctx;
const server = serveEndpoints(ctx, {
	'GET /api/v1/catalog': getCatalogEndpoint,
	'POST /api/v1/updates': checkUpdatesEndpoint,
});
const client = createApiClient<Api>({ baseUrl: server.url.href });

const CHANGES: Changelog = {
	date: '2026-10-17',
	sections: [{ type: 'added', items: ['Changes in 1.1.0.'] }],
};

const SOURCED = { changelog: 'Added:\n- Changes in 1.1.0.', changes: CHANGES };
const LEGACY = { changelog: 'Changes in 1.0.0.', changes: null };

const PIN = {
	repository: 'acme/addons',
	repositoryId: 42,
	path: 'plugins/hello',
	ref: 'v1.1.0',
	commitSha: 'c'.repeat(40),
	bundlePath: 'plugins/hello/dist/index.js',
	bundleBlobSha: 'b'.repeat(40),
};

const UPDATES_REQUEST = {
	clientVersion: '1.0.0',
	addons: [
		{ id: 'src.mixed', version: '0.9.0' },
		{ id: 'src.legacy', version: '0.9.0' },
	],
};

afterAll(async () => {
	await server.stop(true);
	base.close();
});

beforeAll(async () => {
	const { userId } = await signInWithDiscord(ctx, {
		id: '80351110224679101',
		name: 'Sourcer',
		email: 'sourcer@example.com',
	});

	await seedApprovedAddon(ctx, userId, manifest('src.legacy', '1.0.0'));
	await seedApprovedAddon(ctx, userId, manifest('src.mixed', '1.0.0'));
	await seedVersion(ctx, userId, manifest('src.mixed', '1.1.0'), undefined, {
		repositoryId: 42,
		ref: 'v1.1.0',
		commitSha: 'c'.repeat(40),
		bundleBlobSha: 'b'.repeat(40),
		addonMd: '# Mixed',
	});
	await seedApprovedAddon(ctx, userId, manifest('src.bare', '1.0.0'), {
		changelog: null,
		addonMd: null,
	});
});

describe('versions read from GitHub', () => {
	test('the catalog carries text and sections for a sourced version, text alone for a legacy one', async () => {
		const { addons } = await client('GET /api/v1/catalog', { response: catalogResponseSchema });
		const latest = new Map(addons.map((entry) => [entry.id, entry.latestVersion]));

		expect(latest.get('src.mixed')).toMatchObject({ ...SOURCED, source: PIN });
		expect(latest.get('src.legacy')).toMatchObject({ ...LEGACY, source: null });
		expect(latest.get('src.bare')).toMatchObject({ changelog: null, changes: null });
		expect(latest.get('src.bare')?.source?.repository).toBe('acme/addons');
	});

	test('details render each version in its own format, with the newest ADDON.md and details', async () => {
		const details = await getAddonDetails(ctx, 'src.mixed');

		expect(details?.versions.map(({ changelog, changes }) => ({ changelog, changes }))).toEqual(
			[SOURCED, LEGACY],
		);
		expect(details?.addonMd).toBe('# Mixed');
		expect(details?.details).toEqual(REPOSITORY_DETAILS);

		const legacy = await getAddonDetails(ctx, 'src.legacy');

		expect(legacy?.addonMd).toBeNull();
		expect(legacy?.details).toBeNull();
	});

	test('the update check returns text and sections for the offered and skipped versions', async () => {
		const { updates } = await findUpdates(ctx, UPDATES_REQUEST);
		const byId = new Map(updates.map((update) => [update.id, update]));

		expect(byId.get('src.mixed')).toMatchObject(SOURCED);
		expect(
			byId.get('src.mixed')?.changelogs.map(({ version, changelog, changes }) => ({
				version,
				changelog,
				changes,
			})),
		).toEqual([
			{ version: '1.1.0', ...SOURCED },
			{ version: '1.0.0', ...LEGACY },
		]);
		expect(byId.get('src.legacy')).toMatchObject(LEGACY);
	});
});

describe('shipped clients', () => {
	test('still parse the catalog, reading the changelog as text and dropping the new fields', async () => {
		const response = await fetch(new URL('/api/v1/catalog', server.url));
		const parsed = shippedCatalogResponseSchema.safeParse(await response.json());

		expect(parsed.error).toBeUndefined();

		const mixed = parsed.data?.addons.find((entry) => entry.id === 'src.mixed');

		expect(mixed?.latestVersion.changelog).toBe(SOURCED.changelog);
		expect(Object.keys(mixed?.latestVersion ?? {})).not.toContain('changes');
		expect(Object.keys(mixed?.latestVersion ?? {})).not.toContain('source');
	});

	test('still parse the update check', async () => {
		const response = await fetch(new URL('/api/v1/updates', server.url), {
			method: 'POST',
			headers: { [ctx.env.IP_ADDRESS_HEADER]: '203.0.113.7' },
			body: JSON.stringify(UPDATES_REQUEST),
		});
		const parsed = shippedUpdatesResponseSchema.safeParse(await response.json());

		expect(parsed.error).toBeUndefined();

		const mixed = parsed.data?.updates.find((update) => update.id === 'src.mixed');

		expect(mixed?.changelog).toBe(SOURCED.changelog);
		expect(mixed?.changelogs.map((entry) => entry.changelog)).toEqual([
			SOURCED.changelog,
			LEGACY.changelog,
		]);
	});
});
