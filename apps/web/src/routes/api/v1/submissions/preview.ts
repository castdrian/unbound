import { createFileRoute } from '@tanstack/react-router';

import previewSubmission from '~/endpoints/preview-submission';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/submissions/preview')({
	server: {
		handlers: {
			POST: serve(previewSubmission),
		},
	},
});
