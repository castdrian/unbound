import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createAppContext } from '~/lib/context';
import type { AppContext } from '~/lib/context';
import { createDatabase } from '~/db/database';
import { migrateDatabase } from '~/db/migrate';
import type { EnvSource } from '~/lib/env';
import { parseEnv } from '~/lib/env';

export const TEST_ENV = {
	PUBLIC_URL: 'http://localhost:3000',
	CDN_URL: 'http://cdn.localhost:3000',
	BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters',
	DISCORD_CLIENT_ID: 'discord-client',
	DISCORD_CLIENT_SECRET: 'discord-secret',
	GITHUB_CLIENT_ID: 'github-client',
	GITHUB_CLIENT_SECRET: 'github-secret',
	S3_ENDPOINT: 'http://127.0.0.1:9000',
	S3_REGION: 'us-east-1',
	S3_ACCESS_KEY_ID: 'access-key',
	S3_SECRET_ACCESS_KEY: 'secret-key',
	S3_STAGING_BUCKET: 'unbound-staging',
	S3_PUBLIC_BUCKET: 'unbound-addons',
} satisfies EnvSource;

export type TestContext = {
	ctx: AppContext;
	/** Closes the database and deletes its temporary directory. */
	close: () => void;
};

export type DiscordProfile = {
	id: string;
	name: string;
	email: string;
};

export type SignedInUser = {
	userId: string;
	headers: Headers;
};

/**
 * @description Builds an application context over a fresh, migrated SQLite file in a temporary
 * directory, from {@link TEST_ENV} plus any overrides.
 * @param overrides Environment variables to replace.
 * @returns The context and a `close` that disposes of the database.
 */
export function createTestContext(overrides: EnvSource = {}): TestContext {
	const dir = mkdtempSync(join(tmpdir(), 'unbound-web-'));
	const env = parseEnv({ ...TEST_ENV, DATABASE_PATH: join(dir, 'unbound.db'), ...overrides });
	const db = createDatabase(env.DATABASE_PATH);

	migrateDatabase(db);

	return {
		ctx: createAppContext(env, db),
		close: () => {
			db.$client.close();
			rmSync(dir, { recursive: true, force: true });
		},
	};
}

/**
 * @description Sends a request to the Better Auth handler as a same-origin browser would.
 * @param ctx The application context.
 * @param path The path below `/api/auth`, e.g. `/get-session`.
 * @param init The request init; a plain object `body` is sent as JSON.
 * @returns The auth handler's response.
 */
export function authRequest(ctx: AppContext, path: string, init: RequestInit = {}) {
	const headers = new Headers(init.headers);

	headers.set('origin', ctx.env.PUBLIC_URL);

	if (init.body) {
		headers.set('content-type', 'application/json');
	}

	return ctx.auth.handler(
		new Request(new URL(`/api/auth${path}`, ctx.env.PUBLIC_URL), { ...init, headers }),
	);
}

/**
 * @description Creates a user and Discord account exactly as the Discord OAuth callback does (through
 * Better Auth's internal adapter, so database hooks such as the admin plugin's default role run),
 * then opens a session for it. Discord itself is never contacted.
 * @param ctx The application context.
 * @param profile The Discord profile the callback would have received.
 * @returns The user id and headers carrying the session as a bearer token.
 */
export async function signInWithDiscord(
	ctx: AppContext,
	profile: DiscordProfile,
): Promise<SignedInUser> {
	const { internalAdapter } = await ctx.auth.$context;

	const { user } = await internalAdapter.createOAuthUser(
		{ name: profile.name, email: profile.email, emailVerified: true, image: null },
		{ providerId: 'discord', accountId: profile.id },
	);

	const session = await internalAdapter.createSession(user.id);

	return {
		userId: user.id,
		headers: new Headers({ authorization: `Bearer ${session.token}` }),
	};
}
