import { basename } from 'node:path';

import type { DiscoveredAddon } from '~/lib/discovery';

/**
 * @description Names an addon's bundle inside its output directory. A static addon ships the file
 * named by `main` as-is; a built addon's bundle is the JavaScript the build emits for `main`.
 * @param addon The addon.
 * @param main The manifest's `main`.
 * @returns The bundle's path relative to the addon's output directory.
 */
export function getBundleName(addon: DiscoveredAddon, main: string): string {
	return addon.static ? main : basename(main).replace(/\.\w+$/, '.js');
}

export default getBundleName;
