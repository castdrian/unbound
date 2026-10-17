import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import { z } from 'zod';

export type ArtifactManifest =
	| { success: true; manifest: PublishedManifest }
	| { success: false; error: string };

/**
 * @description Reads a picked `manifest.json` for publishing next to the picked bundle, as `ubd publish` does.
 * @param source The text of the picked `manifest.json`.
 * @param bundleName The picked bundle's file name, which becomes the published `main`.
 * @param addonId The addon id the manifest must declare, when republishing a known addon.
 * @returns The validated manifest, or why it was refused.
 */
export function readArtifactManifest(
	source: string,
	bundleName: string,
	addonId?: string,
): ArtifactManifest {
	let json;

	try {
		json = JSON.parse(source);
	} catch (error) {
		return { success: false, error: `manifest.json is not valid JSON: ${String(error)}` };
	}

	// The bundle is served next to the manifest, so the published `main` names the built bundle.
	const parsed = addonManifestSchema.safeParse({ ...json, main: bundleName });

	if (!parsed.success) {
		return { success: false, error: z.prettifyError(parsed.error) };
	}

	if (addonId && parsed.data.id !== addonId) {
		return {
			success: false,
			error: `This manifest is for ${parsed.data.id}, not ${addonId}.`,
		};
	}

	return { success: true, manifest: parsed.data };
}

export default readArtifactManifest;
