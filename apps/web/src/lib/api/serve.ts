import type { z } from 'zod';

import type { Endpoint } from '~/lib/api/endpoint';
import app from '~/lib/app';

export type ServerHandlerArgs = {
	request: Request;
};

/** A TanStack Start server route handler that remembers which endpoint it serves, for the API map. */
export type ServedEndpoint<E> = ((args: ServerHandlerArgs) => Promise<Response>) & {
	endpoint: E;
};

/**
 * @description Binds an endpoint to the process-wide app context as a server route handler.
 * @param target The endpoint to serve.
 * @returns The handler to place under a method in `server.handlers`.
 */
export function serve<TBody extends z.ZodType, TResponse extends z.ZodType>(
	target: Endpoint<TBody, TResponse>,
): ServedEndpoint<Endpoint<TBody, TResponse>> {
	return Object.assign(({ request }: ServerHandlerArgs) => target.handle(app, request), {
		endpoint: target,
	});
}

export default serve;
