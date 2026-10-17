import { apiErrorResponseSchema } from '@unbound-app/contracts/errors';
import type { ApiErrorCode } from '@unbound-app/contracts/errors';
import type { z } from 'zod';

/** The header `ubd publish` sends an API key in, for CI publishing. */
export const API_KEY_HEADER = 'x-api-key';

/** The OAuth `client_id` `ubd login` sends to the device authorization endpoints. */
export const CLI_CLIENT_ID = 'ubd';

/** One `"METHOD /path"` entry of the API map: the request body type and the response schema. */
export type ApiRoute = {
	body: unknown;
	response: z.ZodType;
};

export type ApiMap = Record<string, ApiRoute>;

type PathOf<K> = K extends `${string} ${infer Path}` ? Path : never;

type ParamNames<Path> = Path extends `${string}$${infer Param}/${infer Rest}`
	? Param | ParamNames<Rest>
	: Path extends `${string}$${infer Param}`
		? Param
		: never;

type ParamsOption<K> = [ParamNames<PathOf<K>>] extends [never]
	? { params?: never }
	: { params: Record<ParamNames<PathOf<K>>, string> };

type BodyOption<R extends ApiRoute> = undefined extends R['body']
	? { body?: R['body'] }
	: { body: R['body'] };

export type RequestOptions<K, R extends ApiRoute> = ParamsOption<K> &
	BodyOption<R> & {
		/** The route's contract response schema; the compiler checks it is the one the route declares. */
		response: R['response'];
		headers?: HeadersInit;
	};

export type ApiClientOptions = {
	baseUrl: string;
	headers?: HeadersInit;
};

/** A non-2xx response from the API, carrying the contract error code. */
export class ApiRequestError extends Error {
	constructor(
		public readonly code: ApiErrorCode,
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = 'ApiRequestError';
	}
}

function buildPath(path: string, params: Record<string, string> | undefined): string {
	return path.replaceAll(/\$(\w+)/g, (_, name: string) => {
		const value = params?.[name];

		if (value === undefined) {
			throw new Error(`Missing path parameter ${name} for ${path}.`);
		}

		return encodeURIComponent(value);
	});
}

async function toRequestError(response: Response): Promise<ApiRequestError> {
	const parsed = apiErrorResponseSchema.safeParse(await response.json().catch(() => null));

	if (!parsed.success) {
		return new ApiRequestError(
			'internal_error',
			response.status,
			`Unexpected ${response.status} response without an error body.`,
		);
	}

	return new ApiRequestError(parsed.data.error.code, response.status, parsed.data.error.message);
}

/**
 * @description Creates a typed client for the Unbound web API. Routes, bodies and responses are
 * checked against the API map exported by `@unbound-app/web/api`; responses are parsed with the
 * route's contract schema and `{ error: { code, message } }` bodies are thrown as
 * {@link ApiRequestError}.
 * @template Api The API map, `Api` from `@unbound-app/web/api`.
 * @param options The API origin and headers sent with every request (e.g. credentials).
 * @returns A `request(route, options)` function.
 */
export function createApiClient<Api extends ApiMap>(options: ApiClientOptions) {
	return async function request<K extends keyof Api & string>(
		route: K,
		init: RequestOptions<K, Api[K]>,
	): Promise<z.output<Api[K]['response']>> {
		const separator = route.indexOf(' ');
		const method = route.slice(0, separator);
		const path = route.slice(separator + 1);
		const headers = new Headers(options.headers);

		for (const [name, value] of new Headers(init.headers)) {
			headers.set(name, value);
		}

		if (init.body !== undefined) {
			headers.set('content-type', 'application/json');
		}

		const response = await fetch(new URL(buildPath(path, init.params), options.baseUrl), {
			method,
			headers,
			body: init.body === undefined ? undefined : JSON.stringify(init.body),
		});

		if (!response.ok) {
			throw await toRequestError(response);
		}

		return init.response.parse(await response.json());
	};
}

export default { API_KEY_HEADER, CLI_CLIENT_ID, ApiRequestError, createApiClient };
