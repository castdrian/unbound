import {
	listRepositoryAddonsQuerySchema,
	listRepositoryAddonsResponseSchema,
} from '@unbound-app/contracts/source';
import { z } from 'zod';

import { listRepositoryAddons } from '~/lib/addon-source';
import { requireCaller } from '~/lib/api/caller';
import { connectGitHub } from '~/lib/github';
import endpoint from '~/lib/api/endpoint';

const listRepositoryAddonsEndpoint = endpoint(
	{
		body: z.undefined(),
		query: listRepositoryAddonsQuerySchema,
		response: listRepositoryAddonsResponseSchema,
	},
	async ({ ctx, request, query }) => {
		const { user } = await requireCaller(ctx, request.headers);
		const github = await connectGitHub(ctx, user.id);

		return listRepositoryAddons(ctx, github, query);
	},
);

export default listRepositoryAddonsEndpoint;
