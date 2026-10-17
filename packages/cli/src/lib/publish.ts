import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import type { Submission } from '@unbound-app/contracts/publish';
import { publishArtifact } from '@unbound-app/web/publish';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import type { DiscoveredAddon } from '~/lib/discovery';
import { getBundleName } from '~/lib/bundle-name';
import { createClient } from '~/lib/api-client';
import type { Env } from '~/lib/env';

export type PublishOptions = {
	env: Env;
	addon: DiscoveredAddon;
	/** The GitHub `owner/name` the addon is built from, verified against the linked GitHub account. */
	repository?: string;
	changelog?: string;
};

type Artifact = {
	manifest: PublishedManifest;
	bundle: Bun.BunFile;
};

// The bundle is served next to the manifest, so the published `main` names the built bundle.
function readArtifact(addon: DiscoveredAddon): Artifact {
	const path = join(addon.dir, 'manifest.json');
	const source = JSON.parse(readFileSync(path, 'utf8'));
	const main = getBundleName(addon, source.main);
	const parsed = addonManifestSchema.safeParse({ ...source, main });

	if (!parsed.success) {
		throw new Error(`Invalid ${path}:\n${z.prettifyError(parsed.error)}`);
	}

	return { manifest: parsed.data, bundle: Bun.file(join(addon.output, main)) };
}

/**
 * @description Publishes a built addon for review: opens a submission (the server refuses it, before
 * anything is uploaded, when the bundle is over its size limit or a spam gate applies), uploads the
 * bundle to the presigned URL and finalizes the submission.
 * @param options The environment, the addon and the submission details.
 * @returns The submission, pending review.
 */
export async function publish({
	env,
	addon,
	repository,
	changelog,
}: PublishOptions): Promise<Submission> {
	const { manifest, bundle } = readArtifact(addon);

	if (!(await bundle.exists())) {
		throw new Error(`Built bundle not found at ${bundle.name}. Build ${addon.id} first.`);
	}

	return publishArtifact(createClient(env), { manifest, bundle, repository, changelog });
}

export default publish;
