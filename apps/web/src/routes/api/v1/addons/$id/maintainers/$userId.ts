import { createFileRoute } from '@tanstack/react-router';

import removeMaintainer from '~/endpoints/remove-maintainer';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/maintainers/$userId')({
	server: {
		handlers: {
			DELETE: serve(removeMaintainer),
		},
	},
});
