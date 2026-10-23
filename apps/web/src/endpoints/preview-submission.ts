import { createSubmissionRequestSchema } from '@unbound-app/contracts/publish';
import { submissionPreviewResponseSchema } from '@unbound-app/contracts/review';
import { z } from 'zod';

import { previewSubmission } from '~/lib/submissions';
import { requireCaller } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const previewSubmissionEndpoint = endpoint(
	{
		body: createSubmissionRequestSchema,
		query: z.undefined(),
		response: submissionPreviewResponseSchema,
	},
	async ({ ctx, request, body }) => {
		const caller = await requireCaller(ctx, request.headers);

		return previewSubmission(ctx, caller, body);
	},
);

export default previewSubmissionEndpoint;
