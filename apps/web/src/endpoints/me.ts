import { meResponseSchema } from '@unbound-app/contracts/account';
import { z } from 'zod';

import { requireCaller, toCallerProfile } from '~/lib/api/caller';
import endpoint from '~/lib/api/endpoint';

const me = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: meResponseSchema },
	async ({ ctx, request }) => {
		const { user } = await requireCaller(ctx, request.headers);

		return { user: toCallerProfile(user) };
	},
);

export default me;
