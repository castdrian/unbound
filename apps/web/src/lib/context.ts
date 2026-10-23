import type { Database } from '~/db/database';
import { createStorage } from '~/lib/storage';
import { createAuth } from '~/lib/auth/auth';
import type { Storage } from '~/lib/storage';
import type { Auth } from '~/lib/auth/auth';
import type { Env } from '~/lib/env';

/** Everything a request handler needs, passed explicitly so tests can build their own. */
export type AppContext = {
	env: Env;
	db: Database;
	auth: Auth;
	storage: Storage;
	/** The clock for account age, rate windows and the staging grace; tests pin it instead of sleeping. */
	now: () => Date;
};

/**
 * @description Wires the auth instance and storage clients around a database and environment.
 * @param env The validated environment.
 * @param db The open, migrated database.
 * @returns The application context.
 */
export function createAppContext(env: Env, db: Database): AppContext {
	const storage = createStorage(env);

	return {
		env,
		db,
		auth: createAuth(db, env, storage),
		storage,
		now: () => new Date(),
	};
}

export default { createAppContext };
