import { createFileRoute } from '@tanstack/react-router';

import finalizeSubmission from '~/endpoints/finalize-submission';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/submissions/$id/finalize')({
	server: {
		handlers: {
			POST: serve(finalizeSubmission),
		},
	},
});
