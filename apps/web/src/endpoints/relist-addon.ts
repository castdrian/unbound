import { addonResponseSchema } from '@unbound-app/contracts/addons';
import { z } from 'zod';

import endpoint, { requireParam } from '~/lib/api/endpoint';
import { requireCaller } from '~/lib/api/caller';
import { relistAddon } from '~/lib/addons';

const relistAddonEndpoint = endpoint(
	{ body: z.undefined(), query: z.undefined(), response: addonResponseSchema },
	async ({ ctx, request, params }) => {
		const caller = await requireCaller(ctx, request.headers);

		return relistAddon(ctx, caller, requireParam(params, 'id'));
	},
);

export default relistAddonEndpoint;
