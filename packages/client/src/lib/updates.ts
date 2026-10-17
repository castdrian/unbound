import {
	installedAddonSchema,
	updatesRequestSchema,
	updatesResponseSchema,
} from '@unbound-app/contracts/updates';
import type { InstalledAddon } from '@unbound-app/contracts/updates';
import { createApiClient } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import type { Addon } from '@unbound-app/types';
import type { Api } from '@unbound-app/web/api';

import type { Addons } from '~/managers/addons';

const logger = createLogger('Updater');

/** The part of an addon manager the updater drives; each manager narrows the entity type. */
type UpdatableManager = Pick<Addons<Addon>, 'getEntities' | 'update'>;

export type UpdateCheckOptions = {
	/** Origin of the Unbound web API. */
	baseUrl: string;
	clientVersion: string;
};

/**
 * @description Sends one `POST /api/v1/updates` for every installed addon across the given
 * managers, then has each owning manager apply its returned update. Addons the server doesn't know
 * are never listed back, so they keep their current version.
 * @param managers The addon managers whose installed addons are checked.
 * @param options The API origin and this client's version.
 */
export async function checkForUpdates(
	managers: UpdatableManager[],
	options: UpdateCheckOptions,
): Promise<void> {
	const owners = new Map<string, UpdatableManager>();
	const addons: InstalledAddon[] = [];

	for (const manager of managers) {
		for (const entity of manager.getEntities()) {
			// Locally built addons may not carry a marketplace id or a semver version.
			const installed = installedAddonSchema.safeParse({
				id: entity.id,
				version: entity.data.version,
			});

			if (!installed.success || owners.has(installed.data.id)) {
				continue;
			}

			owners.set(installed.data.id, manager);
			addons.push(installed.data);
		}
	}

	if (!addons.length) return;

	const request = createApiClient<Api>({ baseUrl: options.baseUrl });

	try {
		const { updates } = await request('POST /api/v1/updates', {
			body: updatesRequestSchema.parse({ clientVersion: options.clientVersion, addons }),
			response: updatesResponseSchema,
		});

		await Promise.all(
			updates.map(async (update) => owners.get(update.id)?.update(update.id, update)),
		);
	} catch (error) {
		logger.error('Failed to check for addon updates:', error);
	}
}

export default { checkForUpdates };
