import { z } from 'zod';

import { addonIdSchema, addonManifestSchema, semverSchema } from './manifest';
import { userSummarySchema } from './account';
import { submissionSchema } from './publish';

export const sha256Schema = z
	.string()
	.regex(/^[0-9a-f]{64}$/, 'Must be a lowercase hex SHA-256 digest.');

/** Owners manage maintainers; every maintainer may publish updates. */
export const maintainerRoleSchema = z.enum(['owner', 'maintainer']);

/** An approved, published version, served immutably from the CDN. */
export const addonVersionSchema = z.object({
	version: semverSchema,
	manifest: addonManifestSchema,
	changelog: z.string().nullable(),
	bundleSize: z.int().positive(),
	sha256: sha256Schema,
	publishedAt: z.iso.datetime(),
	manifestUrl: z.url(),
	bundleUrl: z.url(),
});

export const addonSchema = z.object({
	id: addonIdSchema,
	createdAt: z.iso.datetime(),
	/** Hidden from listings and update checks; its published files stay up for existing installs. */
	delistedAt: z.iso.datetime().nullable(),
});

export const addonResponseSchema = z.object({
	addon: addonSchema,
});

export const listAddonsQuerySchema = z
	.object({
		/** The last addon id of the previous page. */
		cursor: addonIdSchema.optional(),
	})
	.optional();

/** Listed addons, ordered by id, each with its newest version. */
export const listAddonsResponseSchema = z.object({
	addons: z.array(
		z.object({
			id: addonIdSchema,
			latestVersion: addonVersionSchema,
		}),
	),
	nextCursor: addonIdSchema.nullable(),
});

export const maintainerSchema = userSummarySchema.extend({
	role: maintainerRoleSchema,
	addedAt: z.iso.datetime(),
});

export const addMaintainerRequestSchema = z.object({
	userId: z.string().min(1),
});

export const maintainersResponseSchema = z.object({
	maintainers: z.array(maintainerSchema),
});

export const transferAddonRequestSchema = z.object({
	userId: z.string().min(1),
	/** Whether the previous owner stays on as a maintainer. */
	keepPreviousOwner: z.boolean().default(true),
});

export const maintainedAddonSchema = addonSchema.extend({
	role: maintainerRoleSchema,
	latestVersion: addonVersionSchema.nullable(),
	/** Updates awaiting upload, review or the author's changes. */
	openSubmissions: z.array(submissionSchema),
});

/** The caller's addons and the new listings they have waiting, for the developer dashboard. */
export const myAddonsResponseSchema = z.object({
	addons: z.array(maintainedAddonSchema),
	openListings: z.array(submissionSchema),
});

export type MaintainerRole = z.infer<typeof maintainerRoleSchema>;
export type AddonVersion = z.infer<typeof addonVersionSchema>;
export type Addon = z.infer<typeof addonSchema>;
export type AddonResponse = z.infer<typeof addonResponseSchema>;
export type ListAddonsQuery = z.infer<typeof listAddonsQuerySchema>;
export type ListAddonsResponse = z.infer<typeof listAddonsResponseSchema>;
export type Maintainer = z.infer<typeof maintainerSchema>;
export type AddMaintainerRequest = z.infer<typeof addMaintainerRequestSchema>;
export type MaintainersResponse = z.infer<typeof maintainersResponseSchema>;
export type TransferAddonRequest = z.infer<typeof transferAddonRequestSchema>;
export type MaintainedAddon = z.infer<typeof maintainedAddonSchema>;
export type MyAddonsResponse = z.infer<typeof myAddonsResponseSchema>;

export default {
	sha256Schema,
	maintainerRoleSchema,
	addonVersionSchema,
	addonSchema,
	addonResponseSchema,
	listAddonsQuerySchema,
	listAddonsResponseSchema,
	maintainerSchema,
	addMaintainerRequestSchema,
	maintainersResponseSchema,
	transferAddonRequestSchema,
	maintainedAddonSchema,
	myAddonsResponseSchema,
};
