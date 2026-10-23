import { addonIdSchema, addonManifestSchema, semverSchema } from '@unbound-app/contracts/manifest';
import { addonTypeSchema, sha256Schema } from '@unbound-app/contracts/addons';
import { z } from '@unbound-app/contracts/zod';

// The catalog and update schemas as shipped clients parse them, copied from origin/main before
// GitHub sources added `changes` and `source`. A server response must keep parsing with these.

const addonVersionSchema = z.object({
	version: semverSchema,
	manifest: addonManifestSchema,
	changelog: z.nullable(z.string()),
	bundleSize: z.int().check(z.positive()),
	sha256: sha256Schema,
	publishedAt: z.iso.datetime(),
	manifestUrl: z.url(),
	bundleUrl: z.url(),
});

const listedAddonSchema = z.object({
	id: addonIdSchema,
	type: addonTypeSchema,
	latestVersion: addonVersionSchema,
});

export const shippedCatalogResponseSchema = z.object({
	revision: z.string().check(z.minLength(1)),
	addons: z.array(listedAddonSchema),
});

const addonReleaseSchema = z.extend(
	z.pick(addonVersionSchema, {
		version: true,
		manifestUrl: true,
		bundleUrl: true,
		sha256: true,
		changelog: true,
	}),
	{ id: addonIdSchema },
);

const versionChangelogSchema = z.pick(addonVersionSchema, {
	version: true,
	changelog: true,
	publishedAt: true,
});

const addonUpdateSchema = z.extend(addonReleaseSchema, {
	changelogs: z._default(z.array(versionChangelogSchema).check(z.maxLength(20)), []),
});

export const shippedUpdatesResponseSchema = z.object({
	updates: z.array(addonUpdateSchema),
});
