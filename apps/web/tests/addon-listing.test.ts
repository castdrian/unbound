import type { AddonSort, ListAddonsQuery, SortOrder } from '@unbound-app/contracts/addons';
import { listAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { SQLQueryBindings } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import { getAddonDetails, queryListedAddons } from '~/lib/addons';
import listAddonsEndpoint from '~/endpoints/list-addons';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';
import { createApiClient } from '~/api/client';
import { createDatabase } from '~/db/database';
import { addon } from '~/db/schema';
import type { Api } from '~/api';

import { manifest, seedApprovedAddon, seedSubmission, seedVersion } from './helpers/addons';
import { createTestContext, signInWithDiscord } from './helpers/context';
import { failure, serveEndpoints } from './helpers/server';

type PlanStep = {
	detail: string;
};

const LISTING_MIGRATION = '20261017110421_listing';

const base = createTestContext({ ADDON_LIST_PAGE_SIZE: '2' });
const ctx = base.ctx;
const server = serveEndpoints(ctx, { 'GET /api/v1/addons': listAddonsEndpoint });
const client = createApiClient<Api>({ baseUrl: server.url.href });

afterAll(async () => {
	await server.stop(true);
	base.close();
});

function onDay(day: number): AppContext {
	return { ...ctx, now: () => new Date(Date.UTC(2026, 9, day)) };
}

let ownerId = '';

beforeAll(async () => {
	({ userId: ownerId } = await signInWithDiscord(ctx, {
		id: '80351110224679001',
		name: 'Lister',
		email: 'lister@example.com',
	}));

	await seedApprovedAddon(
		onDay(1),
		ownerId,
		manifest('list.alpha', '1.0.0', { name: 'Alpha', description: 'Old description.' }),
	);
	await seedVersion(
		onDay(5),
		ownerId,
		manifest('list.alpha', '1.1.0', { name: 'Alpha', description: 'Adds reactions.' }),
	);
	// An older version approved later is not the newest, so it changes nothing listed.
	await seedVersion(
		onDay(6),
		ownerId,
		manifest('list.alpha', '1.0.1', { name: 'Alpha', description: 'Old description.' }),
	);
	await seedApprovedAddon(
		onDay(1),
		ownerId,
		manifest('list.able', '1.0.0', { name: 'Alpha', description: 'Another one.' }),
	);
	await seedApprovedAddon(
		onDay(2),
		ownerId,
		manifest('list.bravo', '1.0.0', {
			name: 'Bravo',
			description: 'A dark theme.',
			main: 'theme.json',
		}),
	);
	await seedApprovedAddon(
		onDay(3),
		ownerId,
		manifest('list.charlie', '1.0.0', {
			name: 'Charlie',
			description: 'Shows 100% of reactions.',
			type: 'plugin',
		}),
	);
	await seedApprovedAddon(
		onDay(4),
		ownerId,
		manifest('list.echo', '1.0.0', {
			name: 'Echo',
			description: 'A light theme.',
			type: 'theme',
		}),
	);
	await seedApprovedAddon(onDay(2), ownerId, manifest('list.delta', '1.0.0', { name: 'Delta' }));
	await ctx.db.update(addon).set({ delistedAt: new Date() }).where(eq(addon.id, 'list.delta'));
	await seedSubmission(ctx, ownerId, manifest('list.pending', '1.0.0', { name: 'Pending' }));
});

function list(query: ListAddonsQuery) {
	return client('GET /api/v1/addons', { query, response: listAddonsResponseSchema });
}

// Follows `nextCursor` to the end, returning each page's ids.
async function pages(query: ListAddonsQuery = {}): Promise<string[][]> {
	const result: string[][] = [];
	let cursor: string | undefined;

	do {
		const page = await list({ ...query, cursor });

		result.push(page.addons.map((entry) => entry.id));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	return result;
}

async function ids(query: ListAddonsQuery = {}): Promise<string[]> {
	return (await pages(query)).flat();
}

describe('listing', () => {
	test('lists approved, listed addons with their newest version, two per page by name', async () => {
		const first = await list({});

		expect(
			first.addons.map((entry) => [entry.id, entry.type, entry.latestVersion.version]),
		).toEqual([
			['list.able', 'plugin', '1.0.0'],
			['list.alpha', 'plugin', '1.1.0'],
		]);
		expect(await pages()).toEqual([
			['list.able', 'list.alpha'],
			['list.bravo', 'list.charlie'],
			['list.echo'],
		]);
	});

	test.each<[AddonSort, SortOrder, string[]]>([
		['name', 'asc', ['list.able', 'list.alpha', 'list.bravo', 'list.charlie', 'list.echo']],
		['name', 'desc', ['list.echo', 'list.charlie', 'list.bravo', 'list.alpha', 'list.able']],
		['created', 'asc', ['list.able', 'list.alpha', 'list.bravo', 'list.charlie', 'list.echo']],
		['created', 'desc', ['list.echo', 'list.charlie', 'list.bravo', 'list.alpha', 'list.able']],
		['updated', 'asc', ['list.able', 'list.bravo', 'list.charlie', 'list.echo', 'list.alpha']],
		['updated', 'desc', ['list.alpha', 'list.echo', 'list.charlie', 'list.bravo', 'list.able']],
	])('pages by %s %s without skipping or repeating ties', async (sort, order, expected) => {
		expect(await ids({ sort, order })).toEqual(expected);
	});

	test('filters by type, taking an untyped manifest with a JSON main as a theme', async () => {
		expect(await ids({ type: 'plugin' })).toEqual(['list.able', 'list.alpha', 'list.charlie']);
		expect(await ids({ type: 'theme', sort: 'created', order: 'desc' })).toEqual([
			'list.echo',
			'list.bravo',
		]);
		expect(await ids({ type: 'font' })).toEqual([]);
	});

	test('searches the newest name and description case-insensitively, with literal wildcards', async () => {
		expect(await ids({ q: 'REACTIONS' })).toEqual(['list.alpha', 'list.charlie']);
		expect(await ids({ q: 'bravo' })).toEqual(['list.bravo']);
		expect(await ids({ q: '100%' })).toEqual(['list.charlie']);
		expect(await ids({ q: '_' })).toEqual([]);
		expect(await ids({ q: 'old description' })).toEqual([]);
		expect(await ids({ q: 'theme', type: 'theme', sort: 'name', order: 'desc' })).toEqual([
			'list.echo',
			'list.bravo',
		]);
	});

	test('never lists delisted addons or unapproved listings', async () => {
		expect(await ids({ q: 'delta' })).toEqual([]);
		expect(await ids({ q: 'pending' })).toEqual([]);
	});

	test('refuses a cursor that is malformed or from another sort', async () => {
		const { nextCursor } = await list({ sort: 'name' });

		expect(await failure(list({ cursor: 'not-a-cursor' }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
		expect(await failure(list({ sort: 'created', cursor: nextCursor ?? undefined }))).toEqual({
			status: 400,
			code: 'invalid_request',
		});
	});

	test.each<ListAddonsQuery>([
		{ sort: 'name' },
		{ sort: 'created', order: 'desc' },
		{ sort: 'updated' },
		{ type: 'plugin', sort: 'name', order: 'desc' },
		{ type: 'theme', sort: 'created' },
		{ type: 'plugin', sort: 'updated', q: 'a' },
	])('reads %o in index order without sorting', async (query) => {
		const { nextCursor } = await list(query);
		const { sql, params } = queryListedAddons(ctx, {
			...query,
			cursor: nextCursor ?? undefined,
		}).toSQL();
		const plan = ctx.db.$client
			.query<PlanStep, SQLQueryBindings[]>(`EXPLAIN QUERY PLAN ${sql}`)
			.all(...params.map((param) => (typeof param === 'number' ? param : String(param))))
			.map((step) => step.detail);

		expect(plan).toContainEqual(expect.stringMatching(/USING (COVERING )?INDEX addon_listed_/));
		expect(plan).not.toContainEqual(expect.stringMatching(/TEMP B-TREE/));
		expect(plan).not.toContainEqual(expect.stringMatching(/^SCAN addon_version/));
	});
});

describe('addon details', () => {
	test('returns every version newest first and the maintainers', async () => {
		const details = await getAddonDetails(ctx, 'list.alpha');

		expect(details?.type).toBe('plugin');
		expect(details?.versions.map((version) => version.version)).toEqual([
			'1.1.0',
			'1.0.1',
			'1.0.0',
		]);
		expect(details?.versions[0]?.manifestUrl).toBe(
			`${ctx.env.CDN_URL}/addons/list.alpha/1.1.0/manifest.json`,
		);
		expect(details?.maintainers.map((member) => [member.id, member.role])).toEqual([
			[ownerId, 'owner'],
		]);
	});

	test('hides delisted and unapproved addons', async () => {
		expect(await getAddonDetails(ctx, 'list.delta')).toBeUndefined();
		expect(await getAddonDetails(ctx, 'list.pending')).toBeUndefined();
	});
});

describe('listing migration', () => {
	test('backfills the listing columns of existing addons from their newest version', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'ub-listing-'));
		const previous = join(directory, 'migrations');
		const applied = (await readdir(MIGRATIONS_FOLDER)).filter(
			(name) => name < LISTING_MIGRATION,
		);
		const db = createDatabase(join(directory, 'app.db'));

		try {
			for (const name of applied) {
				await cp(join(MIGRATIONS_FOLDER, name), join(previous, name), { recursive: true });
			}

			migrate(db, { migrationsFolder: previous });

			// Published out of version order: 1.10.0 is the newest even though 1.2.0 came last.
			const versions = [
				{ version: '1.0.0', publishedAt: 1000, description: 'First.' },
				{ version: '1.10.0', publishedAt: 2000, description: 'Newest.' },
				{ version: '1.2.0', publishedAt: 3000, description: 'Backport.' },
			];

			db.$client.run(`INSERT INTO user (id, name, email) VALUES ('u', 'U', 'u@example.com')`);
			db.$client.run(`INSERT INTO addon (id) VALUES ('old.theme'), ('old.plugin')`);

			for (const id of ['old.theme', 'old.plugin']) {
				for (const { version, publishedAt, description } of versions) {
					const main = id === 'old.theme' ? 'theme.json' : 'index.js';
					const published = JSON.stringify(manifest(id, version, { description, main }));
					const submissionId = `${id}@${version}`;

					db.$client.run(
						`INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, bundle_size, staging_key, upload_expires_at, created_at)
						VALUES (?, ?, 'u', 'listing', 'approved', ?, ?, 1, ?, 0, 0)`,
						[submissionId, id, version, published, submissionId],
					);
					db.$client.run(
						`INSERT INTO addon_version (addon_id, version, version_key, min_client_key, submission_id, manifest, bundle_size, sha256, published_at)
						VALUES (?, ?, ?, '', ?, ?, 1, 'x', ?)`,
						[id, version, toVersionKey(version), submissionId, published, publishedAt],
					);
				}
			}

			migrateDatabase(db);

			const migrated = await db.select().from(addon).orderBy(addon.id);
			const newest = { name: 'Hello', description: 'Newest.', updatedAt: new Date(2000) };

			expect(migrated).toMatchObject([
				{ id: 'old.plugin', type: 'plugin', ...newest },
				{ id: 'old.theme', type: 'theme', ...newest },
			]);
		} finally {
			db.$client.close();
			await rm(directory, { recursive: true });
		}
	});
});
