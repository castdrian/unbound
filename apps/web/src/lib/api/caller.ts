import type { Permissions } from '~/lib/auth/access';
import { hasPermission } from '~/lib/auth/access';
import type { AppContext } from '~/lib/context';
import type { Session } from '~/lib/auth/auth';
import { API_KEY_HEADER } from '~/api/client';
import { ApiError } from '~/lib/api/errors';

export type CallerUser = Session['user'];

export type Caller = {
	user: CallerUser;
	/** `session` covers both the browser cookie and the device-flow bearer token. */
	via: 'session' | 'api-key';
};

function isBanned(target: CallerUser): boolean {
	if (!target.banned) {
		return false;
	}

	return !target.banExpires || target.banExpires.getTime() > Date.now();
}

async function resolveApiKey(ctx: AppContext, key: string): Promise<Caller | undefined> {
	const result = await ctx.auth.api.verifyApiKey({ body: { key } });

	if (!result.valid || !result.key) return;

	const owner = await ctx.db.query.user.findFirst({ where: { id: result.key.referenceId } });

	if (!owner || isBanned(owner)) return;

	return { user: owner, via: 'api-key' };
}

/**
 * @description Resolves who is calling: an API key header wins, otherwise the session cookie or bearer
 * token. Banned users never resolve.
 * @param ctx The application context.
 * @param headers The request headers.
 * @returns The caller, or `undefined` when the request is anonymous or its credentials are invalid.
 */
export async function resolveCaller(
	ctx: AppContext,
	headers: Headers,
): Promise<Caller | undefined> {
	const key = headers.get(API_KEY_HEADER);

	if (key) {
		return resolveApiKey(ctx, key);
	}

	// Banning revokes every session, so a live session never belongs to a banned user.
	const session = await ctx.auth.api.getSession({ headers });

	if (!session) return;

	return { user: session.user, via: 'session' };
}

/**
 * @description Resolves the caller and fails with `unauthorized` when there is none.
 * @param ctx The application context.
 * @param headers The request headers.
 * @returns The caller.
 */
export async function requireCaller(ctx: AppContext, headers: Headers): Promise<Caller> {
	const caller = await resolveCaller(ctx, headers);

	if (!caller) {
		throw new ApiError('unauthorized', 'Sign in or provide an API key.');
	}

	return caller;
}

/**
 * @description Fails with `forbidden` unless the caller's role grants every listed permission.
 * @param caller The resolved caller.
 * @param permissions The permissions required.
 */
export function requirePermission(caller: Caller, permissions: Permissions) {
	if (hasPermission(caller.user.role, permissions)) return;

	throw new ApiError('forbidden', 'You do not have permission to do this.');
}

export default { resolveCaller, requireCaller, requirePermission };
