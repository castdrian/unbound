import { createFileRoute } from '@tanstack/react-router';

import relistAddon from '~/endpoints/relist-addon';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/relist')({
	server: {
		handlers: {
			POST: serve(relistAddon),
		},
	},
});
