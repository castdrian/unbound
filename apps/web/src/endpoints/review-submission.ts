import {
	reviewSubmissionRequestSchema,
	reviewSubmissionResponseSchema,
} from '@unbound-app/contracts/review';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { requireCaller } from '~/lib/api/caller';
import { reviewSubmission } from '~/lib/review';

const reviewSubmissionEndpoint = endpoint(
	{
		body: reviewSubmissionRequestSchema,
		query: z.undefined(),
		response: reviewSubmissionResponseSchema,
	},
	async ({ ctx, request, params, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return reviewSubmission(ctx, caller, requireParam(params, 'id'), body);
	},
);

export default reviewSubmissionEndpoint;
