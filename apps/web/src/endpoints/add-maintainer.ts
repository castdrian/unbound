import {
	addMaintainerRequestSchema,
	maintainersResponseSchema,
} from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { requireCaller } from '~/lib/api/caller';
import { addMaintainer } from '~/lib/addons';

const addMaintainerEndpoint = endpoint(
	{ body: addMaintainerRequestSchema, query: z.undefined(), response: maintainersResponseSchema },
	async ({ ctx, request, params, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return addMaintainer(ctx, caller, requireParam(params, 'id'), body.userId);
	},
);

export default addMaintainerEndpoint;
