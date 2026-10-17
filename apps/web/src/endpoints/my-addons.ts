import { myAddonsResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import { requireCaller } from '~/lib/api/caller';
import { listMyAddons } from '~/lib/addons';
import endpoint from '~/lib/api/endpoint';

const myAddonsEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: myAddonsResponseSchema },
	async ({ ctx, request }) => {
		const caller = await requireCaller(ctx, request.headers);

		return listMyAddons(ctx, caller);
	},
);

export default myAddonsEndpoint;
