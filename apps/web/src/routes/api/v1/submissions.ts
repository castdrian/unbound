import { createFileRoute } from '@tanstack/react-router';

import createSubmission from '~/endpoints/create-submission';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/submissions')({
	server: {
		handlers: {
			POST: serve(createSubmission),
		},
	},
});
