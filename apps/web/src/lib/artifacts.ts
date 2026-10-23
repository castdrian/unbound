import { formatChangelogText } from '@unbound-app/contracts/changelog';
import type { AddonVersion } from '@unbound-app/contracts/addons';
import type { SourcePin } from '@unbound-app/contracts/source';

import type { addonVersion, submissionSource } from '~/db/schema';
import type { Env } from '~/lib/env';

export type AddonVersionRow = typeof addonVersion.$inferSelect;

export type SubmissionSourceRow = typeof submissionSource.$inferSelect;

/** What a version reads from the submission it was approved from, as {@link VERSION_SOURCE} loads it. */
export type VersionSubmission = {
	repository: string | null;
	source: SubmissionSourceRow | null;
};

/** The relational `with` that loads a version's {@link VersionSubmission}. */
export const VERSION_SOURCE = {
	submission: { columns: { repository: true }, with: { source: true } },
} as const;

type ChangelogFields = Pick<AddonVersion, 'changelog' | 'changes'>;

export type ArtifactKeys = {
	manifest: string;
	bundle: string;
};

/**
 * @description Builds the public bucket keys an approved version is published under. The bundle sits
 * at `main` relative to the manifest, which is how the client resolves it.
 * @param addonId The addon id.
 * @param version The approved version.
 * @param main The manifest's `main`.
 * @returns The manifest and bundle keys.
 */
export function getArtifactKeys(addonId: string, version: string, main: string): ArtifactKeys {
	const directory = `addons/${addonId}/${version}`;

	return { manifest: `${directory}/manifest.json`, bundle: `${directory}/${main}` };
}

/**
 * @description Builds the CDN URL of a public bucket key.
 * @param env The validated environment.
 * @param key The public bucket key.
 * @returns The URL below `CDN_URL`.
 */
export function getCdnUrl(env: Env, key: string): string {
	return new URL(key, env.CDN_URL.endsWith('/') ? env.CDN_URL : `${env.CDN_URL}/`).href;
}

/**
 * @description Picks a version's changelog fields: a sourced version's parsed sections and their text,
 * otherwise the legacy free text.
 * @param text The version row's legacy changelog text.
 * @param source The version's source row, or `null` for a legacy upload.
 * @returns `changelog` as plain text and `changes` as the parsed entry, each `null` when absent.
 */
export function toVersionChangelog(
	text: string | null,
	source: Pick<SubmissionSourceRow, 'changelog'> | null,
): ChangelogFields {
	if (!source) {
		return { changelog: text, changes: null };
	}

	const changes = source.changelog;

	return { changelog: changes ? formatChangelogText(changes) : null, changes };
}

function toSourcePin(submission: VersionSubmission | null): SourcePin | null {
	const { repository, source } = submission ?? {};

	if (!repository || !source) return null;

	return {
		repository,
		repositoryId: source.repositoryId,
		path: source.path,
		ref: source.ref,
		commitSha: source.commitSha,
		bundlePath: source.bundlePath,
		bundleBlobSha: source.bundleBlobSha,
	};
}

/**
 * @description Renders an approved version row as the wire contract, with its CDN URLs.
 * @param env The validated environment.
 * @param row The version row.
 * @param submission The repository and source row of the submission the version was approved from.
 * @returns The version as API responses carry it.
 */
export function toAddonVersion(
	env: Env,
	row: AddonVersionRow,
	submission: VersionSubmission | null,
): AddonVersion {
	const keys = getArtifactKeys(row.addonId, row.version, row.manifest.main);

	return {
		version: row.version,
		manifest: row.manifest,
		...toVersionChangelog(row.changelog, submission?.source ?? null),
		source: toSourcePin(submission),
		bundleSize: row.bundleSize,
		sha256: row.sha256,
		publishedAt: row.publishedAt.toISOString(),
		manifestUrl: getCdnUrl(env, keys.manifest),
		bundleUrl: getCdnUrl(env, keys.bundle),
	};
}

export default { VERSION_SOURCE, getArtifactKeys, getCdnUrl, toVersionChangelog, toAddonVersion };
