import { listAddonsQuerySchema, listAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { listAddons } from '~/lib/addons';
import endpoint from '~/lib/api/endpoint';

const listAddonsEndpoint = endpoint(
	{ body: z.undefined(), query: listAddonsQuerySchema, response: listAddonsResponseSchema },
	async ({ ctx, query }) => listAddons(ctx, query),
);

export default listAddonsEndpoint;
