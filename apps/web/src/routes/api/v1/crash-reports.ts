import { createFileRoute } from '@tanstack/react-router';

import reportCrash from '~/endpoints/report-crash';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/crash-reports')({
	server: {
		handlers: {
			POST: serve(reportCrash),
		},
	},
});
