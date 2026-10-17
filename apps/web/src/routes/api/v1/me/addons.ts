import { createFileRoute } from '@tanstack/react-router';

import myAddons from '~/endpoints/my-addons';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/me/addons')({
	server: {
		handlers: {
			GET: serve(myAddons),
		},
	},
});
