import { createFileRoute } from '@tanstack/react-router';

import listGitHubRepositories from '~/endpoints/list-github-repositories';
import serve from '~/lib/api/serve';

export const Route = createFileRoute('/api/v1/github/repositories')({
	server: {
		handlers: {
			GET: serve(listGitHubRepositories),
		},
	},
});
