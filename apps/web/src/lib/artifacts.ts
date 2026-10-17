import type { AddonVersion } from '@unbound-app/contracts/addons';

import type { addonVersion } from '~/db/schema';
import type { Env } from '~/lib/env';

export type AddonVersionRow = typeof addonVersion.$inferSelect;

export type ArtifactKeys = {
	manifest: string;
	bundle: string;
};

/**
 * @description Builds the public bucket keys an approved version is published under. The bundle sits
 * at `main` relative to the manifest, which is how the client resolves it.
 * @param addonId The addon id.
 * @param version The approved version.
 * @param main The manifest's `main`.
 * @returns The manifest and bundle keys.
 */
export function getArtifactKeys(addonId: string, version: string, main: string): ArtifactKeys {
	const directory = `addons/${addonId}/${version}`;

	return { manifest: `${directory}/manifest.json`, bundle: `${directory}/${main}` };
}

/**
 * @description Builds the CDN URL of a public bucket key.
 * @param env The validated environment.
 * @param key The public bucket key.
 * @returns The URL below `CDN_URL`.
 */
export function getCdnUrl(env: Env, key: string): string {
	return new URL(key, env.CDN_URL.endsWith('/') ? env.CDN_URL : `${env.CDN_URL}/`).href;
}

/**
 * @description Renders an approved version row as the wire contract, with its CDN URLs.
 * @param env The validated environment.
 * @param row The version row.
 * @returns The version as API responses carry it.
 */
export function toAddonVersion(env: Env, row: AddonVersionRow): AddonVersion {
	const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

	return {
		version: row.version,
		manifest: row.manifest,
		changelog: row.changelog,
		bundleSize: row.bundleSize,
		sha256: row.sha256,
		publishedAt: row.publishedAt.toISOString(),
		manifestUrl: getCdnUrl(env, keys.manifest),
		bundleUrl: getCdnUrl(env, keys.bundle),
	};
}

export default { getArtifactKeys, getCdnUrl, toAddonVersion };
