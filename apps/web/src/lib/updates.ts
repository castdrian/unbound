import type { UpdatesRequest, UpdatesResponse } from '@unbound-app/contracts/updates';
import { and, eq, inArray, isNull, lte, max } from 'drizzle-orm';

import { getArtifactKeys, getCdnUrl } from '~/lib/artifacts';
import { addon, addonVersion } from '~/db/schema';
import { toVersionKey } from '~/lib/version-key';
import type { AppContext } from '~/lib/context';

/**
 * @description Builds the single statement that finds, per listed addon, its newest approved version
 * the client can run. SQLite fills the other selected columns from the row holding the `max()`.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The query, unexecuted.
 */
export function newestCompatibleVersions(ctx: AppContext, request: UpdatesRequest) {
	return ctx.db
		.select({
			addonId: addonVersion.addonId,
			version: addonVersion.version,
			versionKey: max(addonVersion.versionKey),
			manifest: addonVersion.manifest,
			changelog: addonVersion.changelog,
			sha256: addonVersion.sha256,
		})
		.from(addonVersion)
		.innerJoin(addon, eq(addon.id, addonVersion.addonId))
		.where(
			and(
				inArray(
					addonVersion.addonId,
					request.addons.map((installed) => installed.id),
				),
				lte(addonVersion.minClientKey, toVersionKey(request.clientVersion)),
				isNull(addon.delistedAt),
			),
		)
		.groupBy(addonVersion.addonId);
}

/**
 * @description Resolves the client's update check in one query: for each installed addon that has a
 * newer approved version compatible with the client, the newest such version and its CDN URLs.
 * Unknown, delisted and up-to-date addons are left out.
 * @param ctx The application context.
 * @param request The client version and installed addons.
 * @returns The available updates.
 */
export async function findUpdates(
	ctx: AppContext,
	request: UpdatesRequest,
): Promise<UpdatesResponse> {
	if (request.addons.length === 0) {
		return { updates: [] };
	}

	const installed = new Map(
		request.addons.map((entry) => [entry.id, toVersionKey(entry.version)]),
	);
	const rows = await newestCompatibleVersions(ctx, request);

	const updates = rows
		.filter((row) => row.versionKey && row.versionKey > (installed.get(row.addonId) ?? ''))
		.map((row) => {
			const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

			return {
				id: row.addonId,
				version: row.version,
				manifestUrl: getCdnUrl(ctx.env, keys.manifest),
				bundleUrl: getCdnUrl(ctx.env, keys.bundle),
				sha256: row.sha256,
				changelog: row.changelog,
			};
		});

	return { updates };
}

export default { newestCompatibleVersions, findUpdates };
