import { createFileRoute } from '@tanstack/react-router';

import type { ServerHandlerArgs } from '~/lib/api/serve';
import app from '~/lib/app';

function handler({ request }: ServerHandlerArgs) {
	return app.auth.handler(request);
}

export const Route = createFileRoute('/api/auth/$')({
	server: {
		handlers: {
			GET: handler,
			POST: handler,
		},
	},
});
