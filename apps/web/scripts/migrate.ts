import { createLogger } from '@unbound-app/logger';

import { createDatabase } from '../src/db/database';
import { migrateDatabase } from '../src/db/migrate';
import { parseEnv } from '../src/lib/env';

const logger = createLogger('Web', 'Migrate');
const env = parseEnv();

migrateDatabase(createDatabase(env.DATABASE_PATH));
logger.success(`Migrated ${env.DATABASE_PATH}.`);
