import { createFileRoute } from '@tanstack/react-router';

import transferAddon from '~/endpoints/transfer-addon';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/transfer')({
	server: {
		handlers: {
			POST: serve(transferAddon),
		},
	},
});
