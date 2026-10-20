import UpdatesStore from '~/stores/updates';
import { getStore } from '~/api/storage';

const Storage = getStore('unbound');

let pending: ReturnType<typeof setTimeout> | undefined;

/** Checks for addon updates once after startup, applying them when `updater.auto` is on. */
export function start() {
	// Built-ins start before the addon managers load their entities.
	pending = setTimeout(async () => {
		const { check, applyAll } = UpdatesStore.getState();

		await check();

		if (Storage.get('updater.auto', true)) {
			await applyAll();
		}
	});
}

/** Cancels an update check that has not started yet. */
export function stop() {
	clearTimeout(pending);
}

export default { start, stop };
