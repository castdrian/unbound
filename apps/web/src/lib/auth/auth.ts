import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2';
import { admin, bearer, deviceAuthorization } from 'better-auth/plugins';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { apiKey } from '@better-auth/api-key';
import { betterAuth } from 'better-auth';

import { API_KEY_HEADER, CLI_CLIENT_ID } from '~/api/client';
import { DEFAULT_ROLE, ac, roles } from '~/lib/auth/access';
import type { Database } from '~/db/database';
import * as schema from '~/db/schema';
import type { Env } from '~/lib/env';

export const DEVICE_VERIFICATION_PATH = '/device';

/**
 * @description Builds the Better Auth instance: Discord is the only sign-up path, GitHub can only be
 * linked to an existing session, and the CLI authenticates through device authorization or API keys.
 * @param db The database the auth tables live in.
 * @param env The validated environment.
 * @returns The configured Better Auth instance.
 */
export function createAuth(db: Database, env: Env) {
	return betterAuth({
		appName: 'Unbound',
		baseURL: env.PUBLIC_URL,
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.PUBLIC_URL],
		database: drizzleAdapter(db, { provider: 'sqlite', schema }),
		socialProviders: {
			discord: {
				clientId: env.DISCORD_CLIENT_ID,
				clientSecret: env.DISCORD_CLIENT_SECRET,
			},
			github: {
				clientId: env.GITHUB_CLIENT_ID,
				clientSecret: env.GITHUB_CLIENT_SECRET,
				disableSignUp: true,
			},
		},
		account: {
			accountLinking: {
				enabled: true,
				// GitHub is linked explicitly from a signed-in session; an OAuth sign-in must never attach
				// itself to an account just because the emails match.
				disableImplicitLinking: true,
				allowDifferentEmails: true,
			},
		},
		rateLimit: {
			enabled: true,
			storage: 'database',
			window: env.AUTH_RATE_LIMIT_WINDOW_SECONDS,
			max: env.AUTH_RATE_LIMIT_MAX,
		},
		advanced: {
			ipAddress: {
				ipAddressHeaders: [env.IP_ADDRESS_HEADER],
			},
		},
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== '/sign-in/social' || ctx.body?.provider !== 'github') return;

				throw new APIError('FORBIDDEN', {
					message: 'GitHub can only be linked to an existing account.',
				});
			}),
		},
		plugins: [
			admin({ ac, roles, defaultRole: DEFAULT_ROLE, adminRoles: ['admin'] }),
			bearer(),
			deviceAuthorization({
				verificationUri: DEVICE_VERIFICATION_PATH,
				validateClient: (clientId) => clientId === CLI_CLIENT_ID,
			}),
			apiKey({
				apiKeyHeaders: API_KEY_HEADER,
				rateLimit: {
					enabled: true,
					timeWindow: env.API_KEY_RATE_LIMIT_WINDOW_SECONDS * 1000,
					maxRequests: env.API_KEY_RATE_LIMIT_MAX,
				},
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session'];

export default { DEVICE_VERIFICATION_PATH, createAuth };
