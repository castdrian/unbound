import { createFileRoute } from '@tanstack/react-router';

import reviewQueue from '~/endpoints/review-queue';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/review/queue')({
	server: {
		handlers: {
			GET: serve(reviewQueue),
		},
	},
});
