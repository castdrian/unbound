import { z } from 'zod';

import { addonIdSchema, semverSchema } from './manifest';
import { addonVersionSchema } from './addons';

export const installedAddonSchema = z.object({
	id: addonIdSchema,
	version: semverSchema,
});

export const updatesRequestSchema = z.object({
	clientVersion: semverSchema,
	addons: z
		.array(installedAddonSchema)
		.max(500)
		.refine(
			(addons) => new Set(addons.map((addon) => addon.id)).size === addons.length,
			'Addon ids must be unique.',
		),
});

/** The release a manager installs: where to fetch it and the bundle digest to verify. */
export const addonReleaseSchema = addonVersionSchema
	.pick({ version: true, manifestUrl: true, bundleUrl: true, sha256: true, changelog: true })
	.extend({ id: addonIdSchema });

/** The most changelogs one update lists. */
export const MAX_UPDATE_CHANGELOGS = 20;

export const versionChangelogSchema = addonVersionSchema.pick({
	version: true,
	changelog: true,
	publishedAt: true,
});

/** The newest compatible release, with `changelogs` covering every version it skips over. */
export const addonUpdateSchema = addonReleaseSchema.extend({
	/** Each version newer than the installed one, up to and including `version`, newest first. */
	changelogs: z.array(versionChangelogSchema).max(MAX_UPDATE_CHANGELOGS).default([]),
});

/** Only addons with a newer approved version compatible with `clientVersion` are listed. */
export const updatesResponseSchema = z.object({
	updates: z.array(addonUpdateSchema),
});

export type InstalledAddon = z.infer<typeof installedAddonSchema>;
export type UpdatesRequest = z.infer<typeof updatesRequestSchema>;
export type AddonRelease = z.infer<typeof addonReleaseSchema>;
export type VersionChangelog = z.infer<typeof versionChangelogSchema>;
export type AddonUpdate = z.infer<typeof addonUpdateSchema>;
export type UpdatesResponse = z.infer<typeof updatesResponseSchema>;

export default {
	MAX_UPDATE_CHANGELOGS,
	installedAddonSchema,
	updatesRequestSchema,
	addonReleaseSchema,
	versionChangelogSchema,
	addonUpdateSchema,
	updatesResponseSchema,
};
