import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { MIGRATIONS_FOLDER, migrateDatabase } from '~/db/migrate';
import { toVersionKey } from '~/lib/version-key';
import { createDatabase } from '~/db/database';

import { manifest } from './helpers/addons';

const CUTOVER_MIGRATION = '20261023170206_cutover';

type Row = {
	id: string;
	status: string;
};

type ColumnRow = {
	name: string;
};

const LEGACY_ROWS = [
	{ id: 'legacy.uploading', status: 'awaiting_upload' },
	{ id: 'legacy.pending', status: 'pending_review' },
	{ id: 'legacy.changes', status: 'changes_requested' },
	{ id: 'legacy.approved', status: 'approved' },
	{ id: 'legacy.rejected', status: 'rejected' },
];

describe('cutover migration', () => {
	test('expires open upload-flow submissions and leaves approved history alone', async () => {
		const directory = await mkdtemp(join(tmpdir(), 'ub-cutover-'));
		const previous = join(directory, 'migrations');
		const applied = (await readdir(MIGRATIONS_FOLDER)).filter(
			(name) => name < CUTOVER_MIGRATION,
		);
		const db = createDatabase(join(directory, 'app.db'));

		try {
			for (const name of applied) {
				await cp(join(MIGRATIONS_FOLDER, name), join(previous, name), { recursive: true });
			}

			migrate(db, { migrationsFolder: previous });

			db.$client.run(`INSERT INTO user (id, name, email) VALUES ('u', 'U', 'u@example.com')`);
			db.$client.run(
				`INSERT INTO addon (id, type, name, description, updated_at) VALUES ('legacy.approved', 'plugin', 'Hello', 'Says hello.', 0)`,
			);

			for (const { id, status } of LEGACY_ROWS) {
				db.$client.run(
					`INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, changelog, bundle_size, staging_key, upload_expires_at, sha256, created_at)
					VALUES (?, ?, 'u', 'listing', ?, '1.0.0', ?, 'Legacy notes.', 1, ?, 0, 'x', 0)`,
					[id, id, status, JSON.stringify(manifest(id)), `submissions/${id}/bundle`],
				);
			}

			db.$client.run(
				`INSERT INTO addon_version (addon_id, version, version_key, min_client_key, submission_id, manifest, changelog, bundle_size, sha256, published_at)
				VALUES ('legacy.approved', '1.0.0', ?, '', 'legacy.approved', ?, 'Legacy notes.', 1, 'x', 0)`,
				[toVersionKey('1.0.0'), JSON.stringify(manifest('legacy.approved'))],
			);

			const versionBefore = db.$client.query('SELECT * FROM addon_version').all();

			migrateDatabase(db);

			const statuses = db.$client
				.query<Row, []>('SELECT id, status FROM submission ORDER BY id')
				.all();
			const columns = db.$client
				.query<ColumnRow, []>(`SELECT name FROM pragma_table_info('submission')`)
				.all()
				.map((column) => column.name);

			expect(statuses).toEqual([
				{ id: 'legacy.approved', status: 'approved' },
				{ id: 'legacy.changes', status: 'expired' },
				{ id: 'legacy.pending', status: 'expired' },
				{ id: 'legacy.rejected', status: 'rejected' },
				{ id: 'legacy.uploading', status: 'expired' },
			]);
			expect(db.$client.query('SELECT * FROM addon_version').all()).toEqual(versionBefore);
			expect(columns).not.toContain('upload_expires_at');

			const insertListing = (id: string, status: string) =>
				db.$client.run(
					`INSERT INTO submission (id, addon_id, author_id, kind, status, version, manifest, bundle_size, staging_key, created_at)
					VALUES (?, 'legacy.pending', 'u', 'listing', ?, '1.0.0', '{}', 1, ?, 0)`,
					[id, status, `submissions/${id}/bundle`],
				);

			insertListing('claim', 'pending_review');
			insertListing('retired', 'awaiting_upload');

			expect(() => insertListing('twice', 'changes_requested')).toThrow(/UNIQUE/);
		} finally {
			db.$client.close();
			await rm(directory, { recursive: true });
		}
	});
});
