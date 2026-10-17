import {
	finalizeSubmissionRequestSchema,
	finalizeSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';

import { finalizeSubmission } from '~/lib/submissions';
import { requireCaller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import endpoint from '~/lib/api/endpoint';

const finalizeSubmissionEndpoint = endpoint(
	{
		body: finalizeSubmissionRequestSchema.optional(),
		response: finalizeSubmissionResponseSchema,
	},
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		if (!params.id) {
			throw new ApiError('invalid_request', 'A submission id is required.');
		}

		return finalizeSubmission(ctx, caller, params.id);
	},
);

export default finalizeSubmissionEndpoint;
