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

export const addonUpdateSchema = addonVersionSchema
	.pick({ version: true, manifestUrl: true, bundleUrl: true, sha256: true, changelog: true })
	.extend({ id: addonIdSchema });

/** Only addons with a newer approved version compatible with `clientVersion` are listed. */
export const updatesResponseSchema = z.object({
	updates: z.array(addonUpdateSchema),
});

export type InstalledAddon = z.infer<typeof installedAddonSchema>;
export type UpdatesRequest = z.infer<typeof updatesRequestSchema>;
export type AddonUpdate = z.infer<typeof addonUpdateSchema>;
export type UpdatesResponse = z.infer<typeof updatesResponseSchema>;

export default {
	installedAddonSchema,
	updatesRequestSchema,
	addonUpdateSchema,
	updatesResponseSchema,
};
