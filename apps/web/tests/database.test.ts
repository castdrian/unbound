import { afterAll, describe, expect, test } from 'bun:test';

import { createTestContext } from './helpers/context';

const { ctx, close } = createTestContext();

afterAll(close);

type PragmaRow = Record<string, string | number>;

function pragma(name: string) {
	const row = ctx.db.$client.query<PragmaRow, []>(`PRAGMA ${name};`).get();

	return row ? Object.values(row)[0] : undefined;
}

describe('createDatabase', () => {
	test('applies the performance and integrity pragmas', () => {
		expect(pragma('journal_mode')).toBe('wal');
		// 1 = NORMAL.
		expect(pragma('synchronous')).toBe(1);
		expect(pragma('foreign_keys')).toBe(1);
		expect(pragma('busy_timeout')).toBe(5000);
		expect(pragma('mmap_size')).toBe(256 * 1024 * 1024);
		// 2 = MEMORY.
		expect(pragma('temp_store')).toBe(2);
	});

	test('the migrations create every Better Auth table', () => {
		const tables = ctx.db.$client
			.query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;")
			.values()
			.map(([name]) => name);

		expect(tables).toEqual(
			expect.arrayContaining([
				'user',
				'session',
				'account',
				'verification',
				'device_code',
				'apikey',
				'rate_limit',
			]),
		);
	});

	test('enforces foreign keys', () => {
		expect(() =>
			ctx.db.$client.run(
				"INSERT INTO session (id, expires_at, token, updated_at, user_id) VALUES ('s', 0, 't', 0, 'missing');",
			),
		).toThrow(/FOREIGN KEY/);
	});
});
