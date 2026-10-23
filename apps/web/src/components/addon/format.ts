import type { SourcePin } from '@unbound-app/contracts/source';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });
const COUNT_FORMAT = new Intl.NumberFormat('en-US', { notation: 'compact' });

/**
 * @description Formats an ISO timestamp as a UTC calendar date.
 * @param iso The timestamp.
 * @returns The date, such as `May 4, 2026`.
 */
export function formatDate(iso: string): string {
	return DATE_FORMAT.format(new Date(iso));
}

/**
 * @description Formats a count compactly.
 * @param count The count.
 * @returns The count, such as `1.2K`.
 */
export function formatCount(count: number): string {
	return COUNT_FORMAT.format(count);
}

/**
 * @description Shortens a commit SHA the way GitHub shows it.
 * @param sha The full commit SHA.
 * @returns Its first seven characters.
 */
export function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

/**
 * @description Links the pinned commit on GitHub.
 * @param pin The version's source pin.
 * @returns The commit's GitHub URL.
 */
export function commitUrl(pin: SourcePin): string {
	return `https://github.com/${pin.repository}/commit/${pin.commitSha}`;
}

/**
 * @description Links the addon directory at the pinned commit on GitHub.
 * @param pin The version's source pin.
 * @returns The directory's GitHub URL.
 */
export function directoryUrl(pin: SourcePin): string {
	const path = pin.path ? `/${pin.path}` : '';

	return `https://github.com/${pin.repository}/tree/${pin.commitSha}${path}`;
}

export default { formatDate, formatCount, shortSha, commitUrl, directoryUrl };
