import { createFileRoute } from '@tanstack/react-router';

import serve from '~/lib/api/serve';
import me from '~/endpoints/me';

export const Route = createFileRoute('/api/v1/me')({
	server: {
		handlers: {
			GET: serve(me),
		},
	},
});
