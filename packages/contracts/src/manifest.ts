import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { ADDON_TYPES } from '@unbound-app/types/addons';
import { z } from 'zod';

/**
 * A version string `Bun.semver` accepts as an exact version. Only parse request payloads with this on
 * Bun (the server and the CLI): the check runs `Bun.semver`, which the client runtime lacks.
 */
export const semverSchema = z
	.string()
	.refine((value) => Bun.semver.satisfies(value, value), 'Must be a semver version.');

/**
 * Addon ids become object-storage path segments (`addons/{id}/{version}/...`), so they are limited to
 * path-safe characters: alphanumeric runs joined by single `.`, `_` or `-`.
 */
export const addonIdSchema = z
	.string()
	.max(100)
	.regex(
		/^[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*$/,
		'Must be alphanumeric segments joined by ".", "_" or "-".',
	);

export const addonAuthorSchema = z.object({
	name: z.string().min(1),
	id: z.templateLiteral([z.int().nonnegative()]),
});

/**
 * The manifest an author publishes. Unknown keys pass through untouched so the stored manifest is
 * exactly what the author shipped; only the fields the platform relies on are validated.
 */
export const addonManifestSchema = z.looseObject({
	id: addonIdSchema,
	type: z.enum(ADDON_TYPES).optional(),
	name: z.string().min(1),
	description: z.string(),
	authors: z.array(addonAuthorSchema).min(1),
	icon: z.union([z.string(), z.object({ uri: z.string() })]).optional(),
	main: z.string().min(1),
	version: semverSchema,
	capabilities: z.array(z.enum(NATIVE_PLUGIN_CAPABILITIES)).optional(),
	minNativePluginApi: z.string().optional(),
	unbound: z.object({ min: semverSchema.optional() }).optional(),
});

export type PublishedManifest = z.infer<typeof addonManifestSchema>;

export default {
	semverSchema,
	addonIdSchema,
	addonAuthorSchema,
	addonManifestSchema,
};
