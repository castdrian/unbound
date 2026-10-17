import { NATIVE_PLUGIN_CAPABILITIES } from '@unbound-app/types/native';
import { ADDON_TYPES } from '@unbound-app/types/addons';
import { z } from 'zod';

/**
 * A strict SemVer 2.0.0 version (the specification's own pattern): no `v` prefix, no leading zeros.
 * Versions become object-storage path segments and are ordered by the server, so loose forms are refused.
 */
export const semverSchema = z
	.string()
	.max(64)
	.regex(
		/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
		'Must be a semver version.',
	);

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
	// The bundle is published next to the manifest at `addons/{id}/{version}/{main}` and resolved
	// relative to the manifest URL, so `main` may not leave that directory.
	main: z
		.string()
		.regex(/^(?:[\w-][\w.-]*\/)*[\w-][\w.-]*$/, 'Must be a relative path inside the addon.'),
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
