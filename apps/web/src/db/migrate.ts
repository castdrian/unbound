import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { join } from 'node:path';

import type { Database } from '~/db/database';

export const MIGRATIONS_FOLDER = join(import.meta.dirname, '..', '..', 'drizzle');

/**
 * @description Applies every pending drizzle-kit migration from `apps/web/drizzle`.
 * @param db The database to migrate.
 */
export function migrateDatabase(db: Database) {
	migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

export default { MIGRATIONS_FOLDER, migrateDatabase };
