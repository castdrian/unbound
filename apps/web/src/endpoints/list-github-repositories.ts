import { pushableRepositoriesResponseSchema } from '@unbound-app/contracts/source';
import { z } from 'zod';

import { requireCaller } from '~/lib/api/caller';
import { connectGitHub } from '~/lib/github';
import endpoint from '~/lib/api/endpoint';

const listGitHubRepositoriesEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: pushableRepositoriesResponseSchema },
	async ({ ctx, request }) => {
		const { user } = await requireCaller(ctx, request.headers);
		const github = await connectGitHub(ctx, user.id);

		return { repositories: await github.listPushable() };
	},
);

export default listGitHubRepositoriesEndpoint;
