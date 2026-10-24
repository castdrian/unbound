import type { ThemedToken } from 'shiki';
import { describe, expect, test } from 'bun:test';

import { androidColor, codeRanges, sourceBlock, tokenRuns } from './code-ranges';

function token(content: string, color?: string, fontStyle = 0): ThemedToken {
	return { content, color, fontStyle, offset: 0 };
}

describe('android code blocks', () => {
	const text = 'fresh shiki fixture\nconst answer = 42;\nconsole.log(answer); \n​';

	test("drops the padding Discord appends to a block's range", () => {
		expect(codeRanges(text, [{ start: 20, end: 61 }])).toEqual([
			{ start: 20, end: 59, code: 'const answer = 42;\nconsole.log(answer);' },
		]);
	});

	test('ignores empty and out-of-range blocks', () => {
		expect(
			codeRanges(text, [
				{ start: 59, end: 61 },
				{ start: 10, end: 400 },
			]),
		).toEqual([]);
	});

	test('converts hex colors to signed ARGB integers', () => {
		expect(androidColor('#ff0000')).toBe(0xffff0000 | 0);
		expect(androidColor('#f00')).toBe(0xffff0000 | 0);
		expect(androidColor('#00ff0080')).toBe(0x8000ff00 | 0);
		expect(androidColor('red')).toBeUndefined();
		expect(androidColor(undefined)).toBeUndefined();
	});

	test('lays token runs over the code, skipping uncolored tokens', () => {
		const [range] = codeRanges(text, [{ start: 20, end: 61 }]);
		const runs = tokenRuns(
			[
				[
					token('const', '#ff0000', 2),
					token(' answer = '),
					token('42', '#00ff00'),
					token(';'),
				],
				[token('console', '#0000ff'), token('.log(answer);')],
			],
			range,
		);

		expect(runs).toEqual([
			{ start: 20, end: 25, color: 0xffff0000 | 0, fontStyle: 2 },
			{ start: 35, end: 37, color: 0xff00ff00 | 0, fontStyle: 0 },
			{ start: 39, end: 46, color: 0xff0000ff | 0, fontStyle: 0 },
		]);
		expect(text.slice(39, 46)).toBe('console');
	});

	test('refuses tokens that do not spell out the rendered code', () => {
		const [range] = codeRanges(text, [{ start: 20, end: 61 }]);

		expect(tokenRuns([[token('something else', '#ff0000')]], range)).toBeNull();
	});

	test('finds the fenced block a rendered block came from', () => {
		const blocks = [
			{ code: 'print(1)', language: 'python' },
			{ code: 'const answer = 42;\nconsole.log(answer);', language: 'javascript' },
		];

		expect(sourceBlock('const answer = 42;\nconsole.log(answer);', blocks)?.language).toBe(
			'javascript',
		);
		expect(sourceBlock('nothing', blocks)).toBeUndefined();
	});
});
