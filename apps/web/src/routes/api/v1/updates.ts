import { createFileRoute } from '@tanstack/react-router';

import checkUpdates from '~/endpoints/check-updates';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/updates')({
	server: {
		handlers: {
			POST: serve(checkUpdates),
		},
	},
});
