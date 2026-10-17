import { API_URL, CLIENT_VERSION } from '~/lib/constants';
import { checkForUpdates } from '~/lib/updates';
import { plugins } from '~/managers/plugins';
import { themes } from '~/managers/themes';
import { icons } from '~/managers/icons';

let pending: ReturnType<typeof setTimeout> | undefined;

/** Checks for addon updates once, after startup has loaded every addon manager. */
export function start() {
	// Built-ins start before the addon managers load their entities.
	pending = setTimeout(() => {
		void checkForUpdates([plugins, themes, icons], {
			baseUrl: API_URL,
			clientVersion: CLIENT_VERSION,
		});
	});
}

/** Cancels an update check that has not started yet. */
export function stop() {
	clearTimeout(pending);
}

export default { start, stop };
