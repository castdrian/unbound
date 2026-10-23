import { diffLines } from 'diff';

/** A line of either copy. Line numbers are 1-based; a side the line is not on is `null`. */
type NumberedLine = {
	type: 'context' | 'added' | 'removed';
	text: string;
	before: number | null;
	after: number | null;
};

/** One row of the unified view: a line, or a run of unchanged lines collapsed into a count. */
export type AddonMdLine = NumberedLine | { type: 'skipped'; count: number };

/** How a submission's ADDON.md compares with the newest approved version's copy. */
export type AddonMdDiff =
	| { state: 'none' }
	| { state: 'new' }
	| { state: 'unchanged' }
	| { state: 'removed'; lines: AddonMdLine[] }
	| { state: 'changed'; lines: AddonMdLine[] };

const CONTEXT_LINES = 3;

function normalizeLineEndings(text: string): string {
	const lf = text.replaceAll('\r\n', '\n');

	return lf.endsWith('\n') ? lf : `${lf}\n`;
}

function splitLines(value: string): string[] {
	return value.slice(0, -1).split('\n');
}

function numberLines(previous: string, next: string): NumberedLine[] {
	const lines: NumberedLine[] = [];
	let before = 1;
	let after = 1;

	for (const change of diffLines(previous, next)) {
		const type = change.added ? 'added' : change.removed ? 'removed' : 'context';

		for (const text of splitLines(change.value)) {
			lines.push({
				type,
				text,
				before: type === 'added' ? null : before++,
				after: type === 'removed' ? null : after++,
			});
		}
	}

	return lines;
}

function collapse(lines: NumberedLine[]): AddonMdLine[] {
	const near = new Set<number>();

	for (const [i, line] of lines.entries()) {
		if (line.type === 'context') {
			continue;
		}

		for (let j = Math.max(0, i - CONTEXT_LINES); j <= i + CONTEXT_LINES; j++) {
			near.add(j);
		}
	}

	const rows: AddonMdLine[] = [];

	for (const [index, line] of lines.entries()) {
		if (near.has(index)) {
			rows.push(line);
			continue;
		}

		const last = rows.at(-1);

		if (last?.type === 'skipped') {
			last.count++;
		} else {
			rows.push({ type: 'skipped', count: 1 });
		}
	}

	return rows;
}

/**
 * @description Compares a submission's ADDON.md with the copy in the addon's newest approved version.
 * @param previous The approved version's ADDON.md, or `null` for a new listing or a version without one.
 * @param next The submitted ADDON.md, or `null` when the submission has none.
 * @returns The comparison, with a unified line diff when lines were changed or removed.
 */
export function diffAddonMd(previous: string | null, next: string | null): AddonMdDiff {
	if (previous === null) {
		return { state: next === null ? 'none' : 'new' };
	}

	const before = normalizeLineEndings(previous);

	if (next === null) {
		return { state: 'removed', lines: collapse(numberLines(before, '')) };
	}

	const after = normalizeLineEndings(next);

	if (before === after) {
		return { state: 'unchanged' };
	}

	return { state: 'changed', lines: collapse(numberLines(before, after)) };
}

export default { diffAddonMd };
