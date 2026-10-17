import { createFileRoute } from '@tanstack/react-router';

import listMaintainers from '~/endpoints/list-maintainers';
import addMaintainer from '~/endpoints/add-maintainer';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/addons/$id/maintainers')({
	server: {
		handlers: {
			GET: serve(listMaintainers),
			POST: serve(addMaintainer),
		},
	},
});
