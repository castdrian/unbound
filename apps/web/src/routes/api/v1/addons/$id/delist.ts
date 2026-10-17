import { createFileRoute } from '@tanstack/react-router';

import delistAddon from '~/endpoints/delist-addon';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/delist')({
	server: {
		handlers: {
			POST: serve(delistAddon),
		},
	},
});
