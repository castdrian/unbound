import { z } from 'zod';

import { addonIdSchema, semverSchema } from './manifest';

/** The most installed addons a single updates request may ask about. */
export const UPDATES_BATCH_LIMIT = 500;

export const installedAddonSchema = z.object({
	id: addonIdSchema,
	version: semverSchema,
});

export const updatesRequestSchema = z.object({
	clientVersion: semverSchema,
	addons: z
		.array(installedAddonSchema)
		.max(UPDATES_BATCH_LIMIT)
		.refine(
			(addons) => new Set(addons.map((addon) => addon.id)).size === addons.length,
			'Addon ids must be unique.',
		),
});

// Parsed on the client, so versions are not re-checked with `Bun.semver` here: the server only ever
// emits versions it validated on publish.
export const addonUpdateSchema = z.object({
	id: addonIdSchema,
	version: z.string(),
	manifestUrl: z.url(),
	bundleUrl: z.url(),
	sha256: z.string().regex(/^[0-9a-f]{64}$/, 'Must be a lowercase hex SHA-256 digest.'),
	changelog: z.string().nullable(),
});

/** Only addons with a newer approved version compatible with `clientVersion` are listed. */
export const updatesResponseSchema = z.object({
	updates: z.array(addonUpdateSchema),
});

export type InstalledAddon = z.infer<typeof installedAddonSchema>;
export type UpdatesRequest = z.infer<typeof updatesRequestSchema>;
export type AddonUpdate = z.infer<typeof addonUpdateSchema>;
export type UpdatesResponse = z.infer<typeof updatesResponseSchema>;

export default {
	UPDATES_BATCH_LIMIT,
	installedAddonSchema,
	updatesRequestSchema,
	addonUpdateSchema,
	updatesResponseSchema,
};
