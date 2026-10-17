import type { z } from 'zod';

import type { Route as FinalizeSubmissionRoute } from '~/routes/api/v1/submissions/$id/finalize';
import type { Route as SubmissionsRoute } from '~/routes/api/v1/submissions';
import type { Route as MeRoute } from '~/routes/api/v1/me';
import type { ServedEndpoint } from '~/lib/api/serve';
import type { Endpoint } from '~/lib/api/endpoint';

// `handlers` may also be a factory function; only the plain method record carries endpoint types.
type Handlers<R> = R extends { options: { server?: { handlers?: infer H } } }
	? Exclude<NonNullable<H>, CallableFunction>
	: never;

type RouteEntry<H> =
	H extends ServedEndpoint<Endpoint<infer TBody, infer TResponse>>
		? { body: z.input<TBody>; response: TResponse }
		: never;

/** Maps every `serve`d handler of a server route to its `"METHOD /path"` API map entry. */
export type RouteApi<R extends { fullPath: string }> = {
	[
		M in keyof Handlers<R> & string as RouteEntry<Handlers<R>[M]> extends never
			? never
			: `${M} ${R['fullPath']}`
	]: RouteEntry<Handlers<R>[M]>;
};

/** The typed map of every `/api/v1` route, for `createApiClient<Api>()`. Type-only: import with `import type`. */
export type Api = RouteApi<typeof MeRoute> &
	RouteApi<typeof SubmissionsRoute> &
	RouteApi<typeof FinalizeSubmissionRoute>;
