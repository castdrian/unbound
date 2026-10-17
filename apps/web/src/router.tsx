import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

/**
 * @description Creates the app router; TanStack Start calls this once per request on the server and
 * once on the client.
 * @returns The router over the generated route tree.
 */
export function getRouter() {
	return createRouter({ routeTree, scrollRestoration: true });
}
