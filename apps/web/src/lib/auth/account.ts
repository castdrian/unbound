import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import type { ApiKey } from '@better-auth/api-key';
import type { Account } from 'better-auth';

import app from '~/lib/app';

export type AccountApiKey = Pick<
	ApiKey,
	'id' | 'name' | 'start' | 'createdAt' | 'expiresAt' | 'lastRequest'
>;

/** `id` is the account row id, which unlinking takes. */
export type LinkedAccount = Pick<Account, 'id' | 'providerId'>;

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
