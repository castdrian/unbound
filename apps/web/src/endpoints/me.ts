import { meResponseSchema } from '@unbound-app/contracts/account';
import { z } from 'zod';

import { requireCaller } from '~/lib/api/caller';
import { DEFAULT_ROLE } from '~/lib/auth/access';
import endpoint from '~/lib/api/endpoint';

const me = endpoint(
	{ body: z.undefined(), response: meResponseSchema },
	async ({ ctx, request }) => {
		const { user } = await requireCaller(ctx, request.headers);

		return {
			user: {
				id: user.id,
				name: user.name,
				image: user.image ?? null,
				role: user.role ?? DEFAULT_ROLE,
			},
		};
	},
);

export default me;
