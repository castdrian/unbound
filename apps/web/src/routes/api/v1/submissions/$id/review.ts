import { createFileRoute } from '@tanstack/react-router';

import reviewSubmission from '~/endpoints/review-submission';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/submissions/$id/review')({
	server: {
		handlers: {
			POST: serve(reviewSubmission),
		},
	},
});
