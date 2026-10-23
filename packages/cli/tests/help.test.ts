import { spawnSync } from 'node:child_process';
import { expect, test } from 'bun:test';
import { join } from 'node:path';

test('renders top-level help for every CLI command', () => {
	const result = spawnSync(
		process.execPath,
		[join(import.meta.dir, '../src/index.ts'), '--help'],
		{
			encoding: 'utf8',
		},
	);

	expect(result.status).toBe(0);
	expect(result.stdout).toContain('mcp');
	expect(result.stdout).toContain('eval');
});
