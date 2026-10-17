import { describe, expect, test } from 'bun:test';

import { readArtifactManifest } from '~/lib/addon-artifact';

import { manifest } from './helpers/addons';

const SOURCE = JSON.stringify({
	...manifest('hello.world'),
	main: 'src/index.tsx',
	settings: { theme: 'dark' },
});

describe('reading a picked manifest', () => {
	test('publishes the picked bundle as main and keeps unknown keys', () => {
		expect(readArtifactManifest(SOURCE, 'index.js')).toEqual({
			success: true,
			manifest: { ...manifest('hello.world'), settings: { theme: 'dark' } },
		});
	});

	test('refuses a file that is not JSON', () => {
		const read = readArtifactManifest('{ "id": ', 'index.js');

		expect(read.success).toBe(false);
		expect(read.success ? '' : read.error).toStartWith('manifest.json is not valid JSON');
	});

	test('refuses a manifest the server would refuse, naming the field', () => {
		const read = readArtifactManifest(
			JSON.stringify({ ...manifest('hello.world'), version: 'v1' }),
			'index.js',
		);

		expect(read.success ? '' : read.error).toContain('version');
	});

	test('refuses a bundle name that cannot be a published path', () => {
		const read = readArtifactManifest(SOURCE, 'index (1).js');

		expect(read.success ? '' : read.error).toContain(
			'Must be a relative path inside the addon.',
		);
	});

	test('when republishing, refuses the manifest of another addon', () => {
		expect(readArtifactManifest(SOURCE, 'index.js', 'other.addon')).toEqual({
			success: false,
			error: 'This manifest is for hello.world, not other.addon.',
		});
		expect(readArtifactManifest(SOURCE, 'index.js', 'hello.world').success).toBe(true);
	});
});
