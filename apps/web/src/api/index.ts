import type { z } from 'zod';

import type { Route as RemoveMaintainerRoute } from '~/routes/api/v1/addons/$id/maintainers/$userId';
import type { Route as FinalizeSubmissionRoute } from '~/routes/api/v1/submissions/$id/finalize';
import type { Route as ReviewSubmissionRoute } from '~/routes/api/v1/submissions/$id/review';
import type { Route as MaintainersRoute } from '~/routes/api/v1/addons/$id/maintainers';
import type { Route as TransferAddonRoute } from '~/routes/api/v1/addons/$id/transfer';
import type { Route as DelistAddonRoute } from '~/routes/api/v1/addons/$id/delist';
import type { Route as RelistAddonRoute } from '~/routes/api/v1/addons/$id/relist';
import type { Route as ReviewQueueRoute } from '~/routes/api/v1/review/queue';
import type { Route as SubmissionsRoute } from '~/routes/api/v1/submissions';
import type { Route as MyAddonsRoute } from '~/routes/api/v1/me/addons';
import type { Route as UpdatesRoute } from '~/routes/api/v1/updates';
import type { Route as AddonsRoute } from '~/routes/api/v1/addons';
import type { FileRoutesByFullPath } from '~/routeTree.gen';
import type { Route as MeRoute } from '~/routes/api/v1/me';
import type { ServedEndpoint } from '~/lib/api/serve';
import type { Endpoint } from '~/lib/api/endpoint';

// `handlers` may also be a factory function; only the plain method record carries endpoint types.
type Handlers<R> = R extends { options: { server?: { handlers?: infer H } } }
	? Exclude<NonNullable<H>, CallableFunction>
	: never;

type RouteEntry<H> =
	H extends ServedEndpoint<Endpoint<infer TBody, infer TResponse, infer TQuery>>
		? { body: z.input<TBody>; query: z.input<TQuery>; response: TResponse }
		: never;

// Importing the generated route tree also brings its route type augmentations into consumers' programs.
/** Maps every `serve`d handler of a server route to its `"METHOD /path"` API map entry. */
export type RouteApi<R extends { fullPath: keyof FileRoutesByFullPath }> = {
	[
		M in keyof Handlers<R> & string as RouteEntry<Handlers<R>[M]> extends never
			? never
			: `${M} ${R['fullPath']}`
	]: RouteEntry<Handlers<R>[M]>;
};

/** The typed map of every `/api/v1` route, for `createApiClient<Api>()`. Type-only: import with `import type`. */
export type Api = RouteApi<typeof MeRoute> &
	RouteApi<typeof MyAddonsRoute> &
	RouteApi<typeof SubmissionsRoute> &
	RouteApi<typeof FinalizeSubmissionRoute> &
	RouteApi<typeof ReviewQueueRoute> &
	RouteApi<typeof ReviewSubmissionRoute> &
	RouteApi<typeof UpdatesRoute> &
	RouteApi<typeof AddonsRoute> &
	RouteApi<typeof MaintainersRoute> &
	RouteApi<typeof RemoveMaintainerRoute> &
	RouteApi<typeof TransferAddonRoute> &
	RouteApi<typeof DelistAddonRoute> &
	RouteApi<typeof RelistAddonRoute>;
