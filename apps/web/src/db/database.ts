import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database as SQLite } from 'bun:sqlite';

import relations from '~/db/relations';

// 256 MiB of the file is memory-mapped; reads past that fall back to regular I/O.
const MMAP_SIZE = 256 * 1024 * 1024;
const BUSY_TIMEOUT_MS = 5000;

export const PRAGMAS = {
	journal_mode: 'WAL',
	synchronous: 'NORMAL',
	foreign_keys: 'ON',
	busy_timeout: BUSY_TIMEOUT_MS,
	mmap_size: MMAP_SIZE,
	temp_store: 'MEMORY',
} as const;

/**
 * @description Opens the SQLite database with the performance and integrity pragmas applied. The
 * process should hold exactly one instance: it is the single writer connection.
 * @param path The database file path, or `:memory:`.
 * @returns The Drizzle database, with the raw `bun:sqlite` handle on `$client`.
 */
export function createDatabase(path: string) {
	const sqlite = new SQLite(path, { create: true, strict: true });

	for (const [pragma, value] of Object.entries(PRAGMAS)) {
		sqlite.run(`PRAGMA ${pragma} = ${value};`);
	}

	return drizzle({ client: sqlite, relations });
}

export type Database = ReturnType<typeof createDatabase>;

export default { PRAGMAS, createDatabase };
