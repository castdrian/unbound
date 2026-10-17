import { createFileRoute } from '@tanstack/react-router';

import listAddons from '~/endpoints/list-addons';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons')({
	server: {
		handlers: {
			GET: serve(listAddons),
		},
	},
});
