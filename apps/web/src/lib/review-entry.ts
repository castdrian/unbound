import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { ReviewQueueItem } from '@unbound-app/contracts/review';

export type FieldDiff = {
	field: string;
	/** Null when the field is unset, or when there is no previous version. */
	previous: string | null;
	next: string | null;
	changed: boolean;
};

/** A queue item as the review page shows it: manifests flattened into a field diff a server function can serialize. */
export type ReviewEntry = Omit<ReviewQueueItem, 'manifest' | 'previousVersion'> & {
	name: string;
	/** The newest approved version, for updates. */
	previousVersion: string | null;
	/** The manifest fields, then the bundle size and SHA-256, against the previous version. */
	fields: FieldDiff[];
};

// UNKNOWN: manifests pass unknown keys through, so a field can hold any JSON value.
function formatValue(value: unknown): string | null {
	if (value === undefined) return null;

	return typeof value === 'string' ? value : JSON.stringify(value);
}

// The bundle size and hash are always set, so a null `previous` means there is no previous version.
function compareArtifact(field: string, next: string, previous: string | null): FieldDiff {
	return { field, previous, next, changed: previous !== null && previous !== next };
}

function formatBytes(bytes: number): string {
	return `${bytes.toLocaleString('en-US')} bytes`;
}

/**
 * @description Compares a submitted manifest field by field with the previous approved one.
 * @param next The submitted manifest.
 * @param previous The newest approved manifest, or null for a new listing.
 * @returns One row per field set in either manifest, in the submitted manifest's order.
 */
export function diffManifests(
	next: PublishedManifest,
	previous: PublishedManifest | null,
): FieldDiff[] {
	const fields = new Set([...Object.keys(next), ...Object.keys(previous ?? {})]);

	return [...fields].map((field) => {
		const after = formatValue(next[field]);
		const before = previous ? formatValue(previous[field]) : null;

		return {
			field,
			previous: before,
			next: after,
			changed: previous !== null && before !== after,
		};
	});
}

/**
 * @description Flattens a review queue item for the review page.
 * @param item The queue item.
 * @returns The entry, with the manifest, bundle size and SHA-256 diffed against the previous version.
 */
export function toReviewEntry(item: ReviewQueueItem): ReviewEntry {
	const { manifest, previousVersion: previous, ...rest } = item;

	return {
		...rest,
		name: manifest.name,
		previousVersion: previous?.version ?? null,
		fields: [
			...diffManifests(manifest, previous?.manifest ?? null),
			compareArtifact(
				'bundle size',
				formatBytes(item.bundleSize),
				previous ? formatBytes(previous.bundleSize) : null,
			),
			compareArtifact('sha256', item.sha256, previous?.sha256 ?? null),
		],
	};
}

export default { diffManifests, toReviewEntry };
