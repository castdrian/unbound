import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import app from '~/lib/app';

export type AccountApiKey = {
	id: string;
	name: string | null;
	start: string | null;
	createdAt: Date;
	expiresAt: Date | null;
	lastRequest: Date | null;
};

export type LinkedAccount = {
	/** The Better Auth account row id, which unlinking takes. */
	id: string;
	/** The OAuth provider, e.g. `discord` or `github`. */
	providerId: string;
};

export type AccountOverview = {
	accounts: LinkedAccount[];
	apiKeys: AccountApiKey[];
};

/**
 * @description Loads what `/account` manages for the signed-in user: linked accounts and API keys.
 * @returns The linked accounts and the user's API keys, newest first.
 */
export const getAccountOverview = createServerFn({ method: 'GET' }).handler(
	async (): Promise<AccountOverview> => {
		const headers = getRequestHeaders();
		const [accounts, keys] = await Promise.all([
			app.auth.api.listUserAccounts({ headers }),
			app.auth.api.listApiKeys({
				headers,
				query: { sortBy: 'createdAt', sortDirection: 'desc' },
			}),
		]);

		return {
			accounts: accounts.map((account) => ({
				id: account.id,
				providerId: account.providerId,
			})),
			apiKeys: keys.apiKeys.map((key) => ({
				id: key.id,
				name: key.name,
				start: key.start,
				createdAt: key.createdAt,
				expiresAt: key.expiresAt,
				lastRequest: key.lastRequest,
			})),
		};
	},
);

export default { getAccountOverview };
