import type { SourcePin } from '@unbound-app/contracts/source';

/** A directory of a repository at one commit. */
export type TreeLocation = Pick<SourcePin, 'repository' | 'commitSha' | 'path'>;

/**
 * @description Shortens a commit SHA the way GitHub prints it.
 * @param sha The full commit SHA.
 * @returns The first seven characters.
 */
export function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

/**
 * @description Links a directory as it was at a commit.
 * @param location The repository, commit and directory; `''` is the root.
 * @returns The GitHub tree URL.
 */
export function getTreeUrl(location: TreeLocation): string {
	const path = location.path === '' ? '' : `/${location.path}`;

	return `https://github.com/${location.repository}/tree/${location.commitSha}${path}`;
}

/**
 * @description Links the shipped bundle file as it was at the pinned commit.
 * @param pin The source pin.
 * @returns The GitHub blob URL.
 */
export function getBundleUrl(pin: SourcePin): string {
	return `https://github.com/${pin.repository}/blob/${pin.commitSha}/${pin.bundlePath}`;
}

export default { shortSha, getTreeUrl, getBundleUrl };
