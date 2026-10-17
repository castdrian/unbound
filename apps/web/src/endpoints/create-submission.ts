import {
	createSubmissionRequestSchema,
	createSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import { z } from 'zod';

import { createSubmission } from '~/lib/submissions';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const createSubmissionEndpoint = endpoint(
	{
		body: createSubmissionRequestSchema,
		query: z.undefined(),
		response: createSubmissionResponseSchema,
	},
	async ({ ctx, request, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return createSubmission(ctx, caller, body);
	},
);

export default createSubmissionEndpoint;
