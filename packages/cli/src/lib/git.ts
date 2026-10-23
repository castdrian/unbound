import type { CreateSubmissionRequest } from '@unbound-app/contracts/publish';
import { parseRepository } from '@unbound-app/contracts/source';
import { relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';

/** The GitHub source `ubd publish` submits: what the API's create request names. */
export type GitSource = Pick<CreateSubmissionRequest, 'repository' | 'path' | 'ref' | 'commitSha'>;

export type GitSourceOverrides = {
	/** The GitHub repository, instead of the one `origin` points at. */
	repository?: string;
	/** The branch, tag or SHA to name, instead of HEAD's tag or SHA. */
	ref?: string;
};

function git(dir: string, args: string[]): string {
	const result = Bun.spawnSync({
		cmd: ['git', ...args],
		cwd: dir,
		stdout: 'pipe',
		stderr: 'pipe',
	});

	if (result.exitCode !== 0) {
		const message = result.stderr.toString().trim();

		throw new Error(`git ${args.join(' ')} failed in ${dir}: ${message}`);
	}

	return result.stdout.toString().trim();
}

function readRepository(dir: string, override: string | undefined): string {
	const input = override ?? git(dir, ['remote', 'get-url', 'origin']);
	const parsed = parseRepository(input);

	if (!parsed) {
		throw new Error(
			`${input} is not a GitHub repository. Pass the one to publish from with --repository owner/name.`,
		);
	}

	return parsed.repository;
}

/**
 * @description Reads the GitHub source of an addon directory from its git checkout. Refuses a
 * directory with uncommitted changes.
 * @param dir The addon directory.
 * @param overrides The repository and ref to name instead of what git says.
 * @returns The repository, the directory relative to the repository root, the ref and HEAD's SHA.
 */
export function readGitSource(dir: string, overrides: GitSourceOverrides = {}): GitSource {
	const root = git(dir, ['rev-parse', '--show-toplevel']);
	const path = relative(realpathSync(root), realpathSync(dir)).split(sep).join('/');
	const changes = git(dir, ['status', '--porcelain', '--', '.']);

	if (changes) {
		throw new Error(
			`${path || 'The repository'} has uncommitted changes. Commit and push them first:\n${changes}`,
		);
	}

	const commitSha = git(dir, ['rev-parse', 'HEAD']);
	const [tag] = git(dir, ['tag', '--points-at', 'HEAD', '--sort=-version:refname']).split('\n');

	return {
		repository: readRepository(dir, overrides.repository),
		path,
		ref: overrides.ref ?? (tag || commitSha),
		commitSha,
	};
}

export default readGitSource;
