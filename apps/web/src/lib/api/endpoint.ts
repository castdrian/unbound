import { createLogger } from '@unbound-app/logger';
import { z } from 'zod';

import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';

const logger = createLogger('Web', 'API');

export type EndpointInput<TBody> = {
	ctx: AppContext;
	request: Request;
	body: TBody;
};

export type EndpointSchemas<TBody extends z.ZodType, TResponse extends z.ZodType> = {
	/** `z.undefined()` for body-less requests. */
	body: TBody;
	response: TResponse;
};

/** A `/api/v1` handler bound to the contract schemas its request body and response follow. */
export type Endpoint<TBody extends z.ZodType, TResponse extends z.ZodType> = {
	schemas: EndpointSchemas<TBody, TResponse>;
	handle(ctx: AppContext, request: Request): Promise<Response>;
};

// UNKNOWN: the raw JSON body, validated by the endpoint's body schema next.
async function readJson(request: Request): Promise<unknown> {
	if (!request.body) return;

	return request.json().catch(() => {
		throw new ApiError('invalid_request', 'The request body must be JSON.');
	});
}

async function readBody<TBody extends z.ZodType>(
	request: Request,
	schema: TBody,
): Promise<z.output<TBody>> {
	const result = schema.safeParse(await readJson(request));

	if (!result.success) {
		throw new ApiError('invalid_request', z.prettifyError(result.error));
	}

	return result.data;
}

/**
 * @description Defines a JSON endpoint: parses the body against its contract schema, runs the
 * handler, validates the result against the response schema, and renders an {@link ApiError} as the
 * `{ error: { code, message } }` body. Anything else is logged and answered with `internal_error`.
 * @param schemas The request body and response schemas.
 * @param handler The endpoint logic.
 * @returns The endpoint, served from a route with `serve` and called directly from tests.
 */
export function endpoint<TBody extends z.ZodType, TResponse extends z.ZodType>(
	schemas: EndpointSchemas<TBody, TResponse>,
	handler: (input: EndpointInput<z.output<TBody>>) => Promise<z.input<TResponse>>,
): Endpoint<TBody, TResponse> {
	return {
		schemas,
		async handle(ctx, request) {
			try {
				const body = await readBody(request, schemas.body);
				const result = await handler({ ctx, request, body });

				return Response.json(schemas.response.parse(result));
			} catch (error) {
				if (error instanceof ApiError) {
					return error.toResponse();
				}

				logger.error(
					`Failed to handle ${request.method} ${new URL(request.url).pathname}:`,
					error,
				);

				return new ApiError('internal_error', 'Something went wrong.').toResponse();
			}
		},
	};
}

export default endpoint;
