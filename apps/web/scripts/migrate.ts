import { createLogger } from '@unbound-app/logger';

import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'Migrate');
const env = parseEnv();

migrateDatabase(createDatabase(env.DATABASE_PATH));
logger.success(`Migrated ${env.DATABASE_PATH}.`);
