import { updatesRequestSchema, updatesResponseSchema } from '@unbound-app/contracts/updates';
import { z } from 'zod';

import { consumeRateLimit, getClientIp } from '~/lib/rate-limit';
import { findUpdates } from '~/lib/updates';
import endpoint from '~/lib/api/endpoint';

const checkUpdatesEndpoint = endpoint(
	{ body: updatesRequestSchema, query: z.undefined(), response: updatesResponseSchema },
	async ({ ctx, request, body }) => {
		consumeRateLimit(ctx, {
			key: `api:updates:${getClientIp(ctx, request)}`,
			windowSeconds: ctx.env.UPDATES_RATE_LIMIT_WINDOW_SECONDS,
			max: ctx.env.UPDATES_RATE_LIMIT_MAX,
		});

		return findUpdates(ctx, body);
	},
);

export default checkUpdatesEndpoint;
