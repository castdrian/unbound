import type { SpanRange } from '@unbound-plugins/shared/native/android/spans';
import type { ThemedToken } from 'shiki';

import type { CodeBlock } from '~/fences';

export type CodeRange = SpanRange & {
	code: string;
};

export type TokenRun = SpanRange & {
	color: number;
	fontStyle: number;
};

const TRAILING_PADDING = /[ ​\s]+$/;

/**
 * @description Turns the block background spans Discord draws code blocks with into the code each one holds.
 * @param text The message text.
 * @param blocks The ranges of the text's block background spans.
 * @returns Each block's code and its range, without the hair space and newlines Discord pads it with.
 */
export function codeRanges(text: string, blocks: SpanRange[]): CodeRange[] {
	return blocks
		.filter(({ start, end }) => start >= 0 && end > start && end <= text.length)
		.map(({ start, end }) => {
			const code = text.slice(start, end).replace(TRAILING_PADDING, '');

			return { start, end: start + code.length, code };
		})
		.filter(({ code }) => code.length > 0);
}

/**
 * @description Converts a CSS hex color to the signed ARGB integer Android colors use.
 * @param hex `#RGB`, `#RRGGBB` or `#RRGGBBAA`.
 * @returns The color, or `undefined` for anything else.
 */
export function androidColor(hex: string | undefined): number | undefined {
	const value = hex?.replace('#', '') ?? '';
	const expanded = value.length === 3 ? [...value].map((digit) => digit + digit).join('') : value;

	if (!/^([\da-f]{6}|[\da-f]{8})$/i.test(expanded)) return undefined;

	const rgb = Number.parseInt(expanded.slice(0, 6), 16);
	const alpha = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) : 0xff;

	return (alpha << 24) | rgb | 0;
}

/**
 * @description Lays highlighted tokens over a code range, one run per colored token.
 * @param tokens The tokens of each line.
 * @param range Where the code sits in the message text.
 * @returns The runs, or `null` when the tokens do not spell out exactly the range's code.
 */
export function tokenRuns(tokens: ThemedToken[][], range: CodeRange): TokenRun[] | null {
	if (
		tokens.map((line) => line.map((token) => token.content).join('')).join('\n') !== range.code
	) {
		return null;
	}

	const runs: TokenRun[] = [];
	let offset = range.start;

	for (const [index, line] of tokens.entries()) {
		if (index > 0) offset += 1;

		for (const token of line) {
			const color = androidColor(token.color);
			const end = offset + token.content.length;

			if (color !== undefined && end > offset) {
				runs.push({ start: offset, end, color, fontStyle: token.fontStyle ?? 0 });
			}

			offset = end;
		}
	}

	return runs;
}

/**
 * @description Finds the fenced block a rendered code block came from, to learn its language.
 * @param code The rendered code.
 * @param blocks The fenced blocks of the messages that may contain it.
 * @returns The matching block, or `undefined` when none matches.
 */
export function sourceBlock(code: string, blocks: CodeBlock[]): CodeBlock | undefined {
	return (
		blocks.find((block) => block.code === code) ??
		blocks.find((block) => block.code.trim() === code.trim())
	);
}

export default { androidColor, codeRanges, sourceBlock, tokenRuns };
