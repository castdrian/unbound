// A length prefix makes numbers compare numerically as strings; semver forbids leading zeros.
function encodeNumber(digits: string): string {
	return `${String(digits.length).padStart(2, '0')}${digits}`;
}

function encodeIdentifier(identifier: string): string {
	return /^\d+$/.test(identifier) ? `0${encodeNumber(identifier)}` : `1${identifier}`;
}

/**
 * @description Encodes a semver version so that comparing keys as strings (as SQLite does) follows
 * semver precedence: a release sorts after its prereleases, numeric prerelease identifiers before
 * alphanumeric ones, and build metadata is ignored.
 * @param version A version accepted by `semverSchema`.
 * @returns The sortable key.
 */
export function toVersionKey(version: string): string {
	const [release = version] = version.split('+');
	const dash = release.indexOf('-');
	const core = (dash === -1 ? release : release.slice(0, dash)).split('.').map(encodeNumber);

	if (dash === -1) {
		return `${core.join('.')}~`;
	}

	// `!` sorts below every identifier character, so a shorter identifier list sorts first.
	const prerelease = release
		.slice(dash + 1)
		.split('.')
		.map(encodeIdentifier);

	return `${core.join('.')}-${prerelease.join('!')}`;
}

export default toVersionKey;
