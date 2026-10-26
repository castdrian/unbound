import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { isEditToolResult, isWriteToolResult } from '@earendil-works/pi-coding-agent';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Pi port of the Claude Code hook `.claude/hooks/format-lint.mjs`:
 *
 *   - After a successful edit or write, oxfmt formats the touched apps/ + packages/ file.
 *   - When a run completes, every apps/ + packages/ file git reports as changed vs HEAD and
 *     modified since the session started is ast-grep auto-fixed (touched lines only),
 *     oxfmt-formatted and oxlint --fix-dangerously'd, then oxlint errors and ast-grep's no-fix
 *     rules on touched lines are sent back to the agent, which continues to fix them.
 *
 * Session start is the timestamp in the Pi session header. Format and lint are best-effort: a
 * failure never wedges the agent.
 */

const SCOPE = /^(?:apps|packages)\//;
const FMT_EXT = /\.(?:[cm]?[jt]sx?|jsonc?)$/;
const LINT_EXT = /\.[cm]?[jt]sx?$/;
const HUNK = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;
const MAX_REPORT = 12_000;
// Each continuation is another model request; a problem the agent cannot fix must not loop forever.
const MAX_CONTINUATIONS = 3;

type Exec = ExtensionAPI['exec'];

interface Finding {
	file: string;
	ruleId: string;
	message: string;
	range: { start: { line: number; column: number } };
	replacement?: string;
	replacementOffsets?: { start: number; end: number };
}

async function repoRoot(exec: Exec, cwd: string) {
	const top = await exec('git', ['rev-parse', '--show-toplevel'], { cwd });

	return top.code === 0 && top.stdout.trim() ? top.stdout.trim() : cwd;
}

function bin(root: string, name: string) {
	return join(root, 'node_modules', '.bin', name);
}

// Pi tools accept `@path` and `~/path` as well as paths relative to the working directory.
function toolPath(cwd: string, path: string) {
	const bare = path.startsWith('@') ? path.slice(1) : path;
	const expanded = bare === '~' || bare.startsWith('~/') ? join(homedir(), bare.slice(1)) : bare;

	return resolve(cwd, expanded);
}

function sessionStart(ctx: ExtensionContext) {
	const startedAt = Date.parse(ctx.sessionManager.getHeader()?.timestamp ?? '');

	return Number.isNaN(startedAt) ? null : startedAt;
}

async function formatFiles(exec: Exec, root: string, files: string[]) {
	const oxfmt = bin(root, 'oxfmt');

	if (files.length === 0 || !existsSync(oxfmt)) {
		return;
	}

	await exec(oxfmt, ['--config', '.oxfmtrc.json', '--no-error-on-unmatched-pattern', ...files], {
		cwd: root,
	});
}

async function changedFiles(exec: Exec, root: string, sinceMs: number) {
	const tracked = await exec('git', ['diff', '--name-only', '--diff-filter=d', 'HEAD'], {
		cwd: root,
	});
	const untracked = await exec('git', ['ls-files', '--others', '--exclude-standard'], {
		cwd: root,
	});
	const files = new Set<string>();

	for (const line of `${tracked.stdout}\n${untracked.stdout}`.split('\n')) {
		const file = line.trim();

		if (!file || !SCOPE.test(file)) {
			continue;
		}

		if ((statSync(join(root, file), { throwIfNoEntry: false })?.mtimeMs ?? 0) >= sinceMs) {
			files.add(file);
		}
	}

	return [...files];
}

/**
 * 1-based line numbers added/changed in `file` vs HEAD. `null` means the file is new (untracked)
 * so every line counts. `--no-ext-diff` forces plain unified output past the repo's configured
 * external diff driver (difftastic).
 */
async function changedLines(exec: Exec, root: string, file: string) {
	const diff = await exec('git', ['diff', '--no-ext-diff', '--unified=0', 'HEAD', '--', file], {
		cwd: root,
	});

	if (!diff.stdout.trim()) {
		return null;
	}

	const lines = new Set<number>();

	for (const row of diff.stdout.split('\n')) {
		const match = HUNK.exec(row);

		if (!match) {
			continue;
		}

		const start = Number(match[1]);
		const count = match[2] === undefined ? 1 : Number(match[2]);

		for (let i = 0; i < count; i++) {
			lines.add(start + i);
		}
	}

	return lines;
}

async function scanFindings(exec: Exec, root: string, sg: string, files: string[]) {
	const scan = await exec(sg, ['scan', '-c', 'sgconfig.yml', '--json=compact', ...files], {
		cwd: root,
	});

	try {
		const parsed: unknown = JSON.parse(scan.stdout || '[]');

		return Array.isArray(parsed) ? (parsed as Finding[]) : [];
	} catch {
		return [];
	}
}

function toRel(root: string, file: string) {
	return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
}

/**
 * Returns a lookup of the lines each file's change touched, diffing each file once.
 */
function touchedLines(exec: Exec, root: string) {
	const cache = new Map<string, Promise<Set<number> | null>>();

	return (rel: string) => {
		const cached = cache.get(rel) ?? changedLines(exec, root, rel);

		cache.set(rel, cached);

		return cached;
	};
}

/**
 * Apply ast-grep fixes, but only for findings sitting on lines this change touched - splicing
 * each `replacement` into the file by byte offset. Legacy matches on untouched lines are left
 * alone.
 */
async function applyAstFixes(exec: Exec, root: string, sg: string, files: string[]) {
	const findings = await scanFindings(exec, root, sg, files);
	const touched = touchedLines(exec, root);
	const byFile = new Map<string, { start: number; end: number; text: string }[]>();

	for (const finding of findings) {
		if (finding.replacement === undefined || finding.replacementOffsets === undefined) {
			continue;
		}

		const rel = toRel(root, finding.file);
		const lines = await touched(rel);

		if (lines && !lines.has(finding.range.start.line + 1)) {
			continue;
		}

		const fixes = byFile.get(rel) ?? [];

		fixes.push({
			start: finding.replacementOffsets.start,
			end: finding.replacementOffsets.end,
			text: finding.replacement,
		});
		byFile.set(rel, fixes);
	}

	for (const [rel, fixes] of byFile) {
		fixes.sort((a, b) => b.start - a.start);

		let buffer = readFileSync(join(root, rel));
		let guard = buffer.length;

		for (const fix of fixes) {
			if (fix.end > guard) {
				continue;
			}

			buffer = Buffer.concat([
				buffer.subarray(0, fix.start),
				Buffer.from(fix.text),
				buffer.subarray(fix.end),
			]);
			guard = fix.start;
		}

		writeFileSync(join(root, rel), buffer);
	}
}

/**
 * ast-grep findings with no automatic fix, located on lines this change introduced - formatted
 * `path:line:col  rule  message`.
 */
async function astViolations(exec: Exec, root: string, sg: string, files: string[]) {
	const findings = await scanFindings(exec, root, sg, files);
	const touched = touchedLines(exec, root);
	const report: string[] = [];

	for (const finding of findings) {
		if (finding.replacement !== undefined) {
			continue;
		}

		const rel = toRel(root, finding.file);
		const lines = await touched(rel);
		const line = finding.range.start.line + 1;

		if (lines === null || lines.has(line)) {
			const col = finding.range.start.column + 1;

			report.push(`${rel}:${line}:${col}  ${finding.ruleId}  ${finding.message}`);
		}
	}

	return report;
}

async function formatEdited(exec: Exec, cwd: string, path: string) {
	const root = await repoRoot(exec, cwd);
	const rel = relative(root, toolPath(cwd, path));

	if (isAbsolute(rel) || !SCOPE.test(rel) || !FMT_EXT.test(rel) || !existsSync(join(root, rel))) {
		return;
	}

	await formatFiles(exec, root, [rel]);
}

// Resolves to the problems left on this session's changes, or an empty string when there are none.
async function settleReport(exec: Exec, cwd: string, sinceMs: number) {
	const root = await repoRoot(exec, cwd);
	const files = await changedFiles(exec, root, sinceMs);

	if (files.length === 0) {
		return '';
	}

	const fmtFiles = files.filter((file) => FMT_EXT.test(file));
	const lintFiles = files.filter((file) => LINT_EXT.test(file));
	const sg = bin(root, 'ast-grep');
	const hasAstGrep = existsSync(sg);

	if (lintFiles.length > 0 && hasAstGrep) {
		await applyAstFixes(exec, root, sg, lintFiles);
	}

	await formatFiles(exec, root, fmtFiles);

	if (lintFiles.length === 0) {
		return '';
	}

	const problems: string[] = [];
	const oxlint = bin(root, 'oxlint');

	if (existsSync(oxlint)) {
		const lint = await exec(
			oxlint,
			['--config', '.oxlintrc.json', '--fix-dangerously', ...lintFiles],
			{ cwd: root },
		);
		const output = `${lint.stdout}\n${lint.stderr}`.trim();

		if (lint.code !== 0 && output) {
			problems.push(output);
		}
	}

	if (hasAstGrep) {
		const violations = await astViolations(exec, root, sg, lintFiles);

		if (violations.length > 0) {
			problems.push(`AGENTS.md structural rules (ast-grep):\n${violations.join('\n')}`);
		}
	}

	return problems.join('\n\n').trim().slice(0, MAX_REPORT);
}

export default function formatLint(pi: ExtensionAPI) {
	let continuations = 0;

	pi.on('before_agent_start', () => {
		continuations = 0;
	});

	pi.on('tool_result', async (event, ctx) => {
		if (event.isError || !(isEditToolResult(event) || isWriteToolResult(event))) {
			return;
		}

		const { path } = event.input;

		if (typeof path !== 'string' || !path) {
			return;
		}

		try {
			await formatEdited(pi.exec, ctx.cwd, path);
		} catch {
			// Format-on-save is best-effort.
		}
	});

	// Like Claude's Stop hook, this runs only when a run finishes on its own, not after an abort.
	pi.on('agent_before_settle', async (event, ctx) => {
		const sinceMs = sessionStart(ctx);

		// Without a known session boundary our changes cannot be told from a pre-existing dirty
		// tree, so skip rather than block on work that is not ours.
		if (event.outcome !== 'completed' || sinceMs === null) {
			return;
		}

		let report: string;

		try {
			report = await settleReport(pi.exec, ctx.cwd, sinceMs);
		} catch {
			return;
		}

		if (!report) {
			return;
		}

		const message = `Formatter, linter, and ast-grep ran on your changed files. Fix these before finishing:\n\n${report}`;

		if (continuations >= MAX_CONTINUATIONS) {
			if (ctx.hasUI) {
				ctx.ui.notify(
					`format-lint: problems remain after ${MAX_CONTINUATIONS} attempts to fix them.\n\n${message}`,
					'error',
				);
			}

			return;
		}

		continuations += 1;

		return {
			entries: [
				...event.entries,
				{
					type: 'custom_message',
					customType: 'format-lint',
					content: message,
					display: true,
				},
			],
			continue: true,
		};
	});
}
