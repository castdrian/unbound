import { join } from 'node:path';

import { resolveDevServerUrl } from '../dev-host';

export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
export const HOST = process.env.HOST || '0.0.0.0';
export const DIST_DIR = join(__dirname, '..', '..', 'dist');

// The address a device on the LAN should point at - matches what the dev build
// bakes into the bundle, so the two never drift.
export const LAN_URL = resolveDevServerUrl();

export const WATCH_DEBOUNCE = 100;

/** The JavaScript build every bytecode bundle is compiled from; its hash identifies a build. */
export const BUNDLE_SOURCE_NAME = 'unbound.js';

/** Written last by every build, so its change marks a finished build. */
export const MANIFEST_NAME = 'manifest.json';

/** Matches every bundle artifact a loader may download: `unbound.js` and `unbound[.N].bundle`. */
export const BUNDLE_PATTERN = /^unbound(\.\d+)?\.bundle$|^unbound\.js$/;

export default {
	PORT,
	HOST,
	DIST_DIR,
	LAN_URL,
	WATCH_DEBOUNCE,
	BUNDLE_SOURCE_NAME,
	MANIFEST_NAME,
	BUNDLE_PATTERN,
};
