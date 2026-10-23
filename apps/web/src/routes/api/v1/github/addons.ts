import { createFileRoute } from '@tanstack/react-router';

import listRepositoryAddons from '~/endpoints/list-repository-addons';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/github/addons')({
	server: {
		handlers: {
			GET: serve(listRepositoryAddons),
		},
	},
});
