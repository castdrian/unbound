import { createLogger } from '@unbound-app/logger';
import { join } from 'node:path';

import { parseEnv } from '../src/lib/env';

const logger = createLogger('Web', 'Serve');
const env = parseEnv();

const dist = join(import.meta.dirname, '..', 'dist');
const { default: server } = await import(join(dist, 'server', 'server.js'));

const assets = new Bun.Glob('**/*');
const routes: Record<string, Bun.BunFile> = {};

for await (const path of assets.scan(join(dist, 'client'))) {
	routes[`/${path}`] = Bun.file(join(dist, 'client', path));
}

Bun.serve({
	port: env.PORT,
	routes,
	fetch: (request) => server.fetch(request),
});

logger.success(`Serving ${Object.keys(routes).length} assets and the app on port ${env.PORT}.`);
