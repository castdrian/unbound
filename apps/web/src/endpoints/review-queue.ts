import { reviewQueueQuerySchema, reviewQueueResponseSchema } from '@unbound-app/contracts/review';
import { z } from 'zod';

import { requireCaller } from '~/lib/api/caller';
import { listReviewQueue } from '~/lib/review';
import endpoint from '~/lib/api/endpoint';

const reviewQueueEndpoint = endpoint(
	{ body: z.undefined(), query: reviewQueueQuerySchema, response: reviewQueueResponseSchema },
	async ({ ctx, request, query }) => {
		const caller = await requireCaller(ctx, request.headers);

		return listReviewQueue(ctx, caller, query?.kind);
	},
);

export default reviewQueueEndpoint;
