import {
	CONFIG_FILENAME,
	findWorkspaceRoot,
	getBundleName,
	isWorkspaceAddon,
	matchAddonDirs,
	readAddon,
	workspaceConfigSchema,
} from '@unbound-app/contracts/workspace';
import type {
	ListRepositoryAddonsQuery,
	ListRepositoryAddonsResponse,
	RepositoryAddon,
	RepositoryDetails,
	SourcePin,
} from '@unbound-app/contracts/source';
import { formatChangelogIssues, parseChangelog } from '@unbound-app/contracts/changelog';
import type { WorkspaceAddon, WorkspaceConfig } from '@unbound-app/contracts/workspace';
import type { SubmitFromRepositoryRequest } from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import { addonManifestSchema } from '@unbound-app/contracts/manifest';
import type { Changelog } from '@unbound-app/contracts/changelog';
import { z } from 'zod';

import type { GitHubClient, GitHubRepository, GitTree, RepositoryExtras } from '~/lib/github';
import type { AppContext } from '~/lib/context';
import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

/** Everything a submission needs from one addon at one commit, each file verified against git. */
export type AddonSource = {
	pin: SourcePin;
	/** The manifest at the commit, `main` rewritten to the published bundle's name. */
	manifest: PublishedManifest;
	bundle: Uint8Array;
	bundleSize: number;
	sha256: string;
	addonMd: string | null;
	/** The entry for `manifest.version`, or `null` when the addon has no CHANGELOG.md. */
	changelog: Changelog | null;
	details: RepositoryDetails;
};

type OpenedCommit = {
	repo: GitHubRepository;
	ref: string;
	commitSha: string;
};

type Texts = Map<string, string>;

/** Where a directory stands in its repository: registered under a workspace config, or why not. */
type Location = { config: WorkspaceConfig } | { reason: string };

type CheckedAddon = {
	manifest: PublishedManifest | undefined;
	/** Every reason the addon cannot be submitted, most fundamental first. */
	errors: ApiError[];
};

const ADDON_MD = 'ADDON.md';
const CHANGELOG_MD = 'CHANGELOG.md';
const MAX_LISTED_ADDONS = 50;
const README = /^readme(?:\.\w+)?$/i;
const DEFAULT_CONFIG = workspaceConfigSchema.parse({});

function childPath(dir: string, name: string): string {
	return dir === '' ? name : `${dir}/${name}`;
}

function parentDir(path: string): string {
	const index = path.lastIndexOf('/');

	return index === -1 ? '' : path.slice(0, index);
}

function relativeTo(dir: string, root: string): string {
	if (root === '' || dir === root) {
		return root === '' ? dir : '';
	}

	return dir.slice(root.length + 1);
}

function shortSha(sha: string): string {
	return sha.slice(0, 7);
}

function describeDir(path: string): string {
	return path === '' ? 'the repository root' : path;
}

async function openCommit(
	github: GitHubClient,
	repository: string,
	ref: string | undefined,
): Promise<OpenedCommit> {
	const repo = await github.getRepository(repository);

	if (!repo.canPush) {
		throw new ApiError(
			'github_no_push_access',
			`Your linked GitHub account cannot push to ${repo.repository}.`,
		);
	}

	const named = ref ?? repo.defaultBranch;
	const commitSha = await github.resolveRef(repo.repository, named, repo.defaultBranch);

	return { repo, ref: named, commitSha };
}

async function readTexts(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	paths: string[],
): Promise<Texts> {
	const decoder = new TextDecoder();
	const entries = await Promise.all(
		[...new Set(paths)].map(async (path) => {
			const entry = tree.get(path);

			if (!entry) return;

			const bytes = await github.readBlob(repository, entry.sha);

			return [path, decoder.decode(bytes)] as const;
		}),
	);

	return new Map(entries.filter((entry) => entry !== undefined));
}

function parseConfig(root: string, text: string | undefined): WorkspaceConfig | string {
	const file = childPath(root, CONFIG_FILENAME);

	let json: unknown;

	try {
		json = JSON.parse(text ?? '');
	} catch {
		return `${file} is not valid JSON`;
	}

	const parsed = workspaceConfigSchema.safeParse(json);

	return parsed.success ? parsed.data : `${file} is invalid: ${z.prettifyError(parsed.error)}`;
}

function workspaceRootOf(tree: GitTree, dir: string): string | undefined {
	return findWorkspaceRoot(dir, (candidate) => tree.has(childPath(candidate, CONFIG_FILENAME)));
}

// The nearest config decides, as `ubd` decides when run from the directory; no config is a bare addon.
function locate(
	dir: string,
	root: string | undefined,
	configs: Map<string, WorkspaceConfig | string>,
): Location {
	if (root === undefined) {
		return { config: DEFAULT_CONFIG };
	}

	const config = configs.get(root);

	if (config === undefined || typeof config === 'string') {
		return { reason: config ?? `${childPath(root, CONFIG_FILENAME)} could not be read` };
	}

	if (matchAddonDirs(config, false, [relativeTo(dir, root)]).length === 0) {
		return { reason: `${childPath(root, CONFIG_FILENAME)} does not list it in "addons"` };
	}

	return { config };
}

async function readConfigs(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	roots: (string | undefined)[],
): Promise<Map<string, WorkspaceConfig | string>> {
	const known = [...new Set(roots)].filter((root) => root !== undefined);
	const texts = await readTexts(
		github,
		repository,
		tree,
		known.map((root) => childPath(root, CONFIG_FILENAME)),
	);

	return new Map(
		known.map((root) => [root, parseConfig(root, texts.get(childPath(root, CONFIG_FILENAME)))]),
	);
}

function readAddonFiles(
	github: GitHubClient,
	repository: string,
	tree: GitTree,
	dirs: string[],
): Promise<Texts> {
	const paths = dirs.flatMap((dir) => [
		childPath(dir, 'manifest.json'),
		childPath(dir, 'package.json'),
	]);

	return readTexts(github, repository, tree, paths);
}

function checkTextSize(env: Env, tree: GitTree, path: string): ApiError | undefined {
	const size = tree.get(path)?.size ?? 0;

	if (size <= env.ADDON_TEXT_MAX_BYTES) return;

	return new ApiError(
		'artifact_too_large',
		`${path} is ${size} bytes; it may be at most ${env.ADDON_TEXT_MAX_BYTES} bytes.`,
	);
}

// The rules both the listing and a submission apply, from the tree alone plus the manifest text.
function checkAddon(
	env: Env,
	tree: GitTree,
	addon: WorkspaceAddon,
	manifestText: string,
	commitSha: string,
): CheckedAddon {
	const errors: ApiError[] = [];
	const manifestPath = childPath(addon.path, 'manifest.json');
	const parsed = addonManifestSchema.safeParse(JSON.parse(manifestText));

	if (!parsed.success) {
		errors.push(
			new ApiError(
				'invalid_manifest',
				`${manifestPath} is not a valid manifest:\n${z.prettifyError(parsed.error)}`,
			),
		);
	}

	const bundle = tree.get(addon.bundle);

	if (!bundle) {
		errors.push(
			new ApiError(
				'artifact_missing',
				`${addon.bundle} is not committed at ${shortSha(commitSha)}. Commit the build output, or push it to a release branch, and submit that commit.`,
			),
		);
	} else if (bundle.size === 0) {
		errors.push(
			new ApiError('artifact_missing', `${addon.bundle} is empty at ${shortSha(commitSha)}.`),
		);
	} else if (bundle.size > env.ADDON_MAX_BYTES) {
		errors.push(
			new ApiError(
				'artifact_too_large',
				`${addon.bundle} is ${bundle.size} bytes; bundles may be at most ${env.ADDON_MAX_BYTES} bytes.`,
			),
		);
	}

	for (const name of [ADDON_MD, CHANGELOG_MD]) {
		const error = checkTextSize(env, tree, childPath(addon.path, name));

		if (error) {
			errors.push(error);
		}
	}

	if (!parsed.success) {
		return { manifest: undefined, errors };
	}

	const main = getBundleName(addon.static, parsed.data.main);

	return { manifest: { ...parsed.data, main }, errors };
}

function readChangelog(path: string, text: string | undefined, version: string): Changelog | null {
	if (text === undefined) {
		return null;
	}

	const parsed = parseChangelog(text);

	if (parsed.issues.length > 0) {
		throw new ApiError('invalid_changelog', formatChangelogIssues(parsed.issues, path));
	}

	const release = parsed.releases.get(version);

	if (!release) {
		throw new ApiError('invalid_changelog', `${path} has no entry for ${version}.`);
	}

	return release;
}

function toDetails(
	repo: GitHubRepository,
	extras: RepositoryExtras,
	tree: GitTree,
	overrides: SubmitFromRepositoryRequest['details'] = {},
): RepositoryDetails {
	const hasReadme = [...tree.keys()].some((path) => !path.includes('/') && README.test(path));

	return {
		description: repo.description,
		homepage: overrides.homepage === undefined ? repo.homepage : overrides.homepage,
		tags: overrides.tags ?? repo.topics,
		license: repo.license,
		stars: repo.stars,
		defaultBranch: repo.defaultBranch,
		htmlUrl: repo.htmlUrl,
		readmeUrl: hasReadme ? `${repo.htmlUrl}#readme` : null,
		contributors: extras.contributors,
		latestRelease: extras.latestRelease,
	};
}

function toRepositoryAddon(
	env: Env,
	tree: GitTree,
	addon: WorkspaceAddon,
	manifestText: string,
	commitSha: string,
): RepositoryAddon {
	const { manifest, errors } = checkAddon(env, tree, addon, manifestText, commitSha);

	return {
		id: addon.id,
		name: manifest?.name ?? null,
		version: manifest?.version ?? null,
		kind: addon.kind,
		path: addon.path,
		static: addon.static,
		bundle: addon.bundle,
		hasAddonMd: tree.has(childPath(addon.path, ADDON_MD)),
		hasChangelog: tree.has(childPath(addon.path, CHANGELOG_MD)),
		issues: errors.map((error) => error.message),
	};
}

/**
 * @description Lists the addons a repository registers at a ref, by the CLI's workspace rules: each
 * directory with a manifest belongs to its nearest `unbound.config.json`, and with no config only the
 * root is a (bare) addon. Requires push access.
 * @param ctx The application context.
 * @param github The caller's GitHub client.
 * @param query The repository and the ref, the default branch when omitted.
 * @returns The resolved commit, the repository details, the addons with their issues and the skipped directories.
 */
export async function listRepositoryAddons(
	ctx: AppContext,
	github: GitHubClient,
	query: ListRepositoryAddonsQuery,
): Promise<ListRepositoryAddonsResponse> {
	const { repo, ref, commitSha } = await openCommit(github, query.repository, query.ref);
	const { repository } = repo;
	const [tree, extras] = await Promise.all([
		github.getTree(repository, commitSha),
		github.getExtras(repository),
	]);

	const candidates = [...tree.keys()]
		.filter((path) => path === 'manifest.json' || path.endsWith('/manifest.json'))
		.map(parentDir)
		.map((dir) => ({ dir, root: workspaceRootOf(tree, dir) }))
		.filter(({ dir, root }) => root !== undefined || dir === '');

	const configs = await readConfigs(
		github,
		repository,
		tree,
		candidates.map(({ root }) => root),
	);

	const skipped: ListRepositoryAddonsResponse['skipped'] = [];
	const located: { dir: string; config: WorkspaceConfig }[] = [];

	for (const { dir, root } of candidates) {
		const location = locate(dir, root, configs);

		if ('reason' in location) {
			skipped.push({ path: dir, reason: location.reason });
		} else {
			located.push({ dir, config: location.config });
		}
	}

	located.sort((a, b) => a.dir.localeCompare(b.dir));

	for (const { dir } of located.slice(MAX_LISTED_ADDONS)) {
		skipped.push({
			path: dir,
			reason: `only the first ${MAX_LISTED_ADDONS} addons are listed`,
		});
	}

	const listed = located.slice(0, MAX_LISTED_ADDONS);
	const texts = await readAddonFiles(
		github,
		repository,
		tree,
		listed.map(({ dir }) => dir),
	);

	const files = { read: (path: string) => texts.get(path) };
	const addons: RepositoryAddon[] = [];

	for (const { dir, config } of listed) {
		const result = readAddon(dir, files, config);

		if (!isWorkspaceAddon(result)) {
			skipped.push(result);
			continue;
		}

		const manifestText = texts.get(childPath(dir, 'manifest.json')) ?? '';

		addons.push(toRepositoryAddon(ctx.env, tree, result, manifestText, commitSha));
	}

	return {
		repository,
		ref,
		commitSha,
		details: toDetails(repo, extras, tree),
		addons,
		skipped,
	};
}

/**
 * @description Reads one addon at the commit the author previewed. Refuses, in order: no push access,
 * a ref that moved (`source_changed`), a path that is not a registered addon (`addon_not_found`), an
 * invalid manifest, a missing or oversize bundle, oversize texts and an invalid changelog.
 * @param ctx The application context.
 * @param github The caller's GitHub client.
 * @param request The repository, addon path, ref, commit and detail overrides.
 * @returns The source, its bytes verified against git's blob ids.
 */
export async function readAddonSource(
	ctx: AppContext,
	github: GitHubClient,
	request: SubmitFromRepositoryRequest,
): Promise<AddonSource> {
	const { repo, commitSha } = await openCommit(github, request.repository, request.ref);
	const { repository } = repo;
	const { path } = request;

	if (commitSha !== request.commitSha) {
		throw new ApiError(
			'source_changed',
			`${request.ref} on ${repository} is now ${shortSha(commitSha)}, not ${shortSha(request.commitSha)}. Review the new commit and submit again.`,
		);
	}

	const [tree, extras] = await Promise.all([
		github.getTree(repository, commitSha),
		github.getExtras(repository),
	]);

	const root = workspaceRootOf(tree, path);
	const configs = await readConfigs(github, repository, tree, [root]);
	const location = locate(path, root, configs);
	const notFound = (reason: string) =>
		new ApiError(
			'addon_not_found',
			`${repository}@${shortSha(commitSha)} has no addon at ${describeDir(path)}: ${reason}.`,
		);

	if ('reason' in location) {
		throw notFound(location.reason);
	}

	const texts = await readAddonFiles(github, repository, tree, [path]);
	const addon = readAddon(path, { read: (file) => texts.get(file) }, location.config);

	if (!isWorkspaceAddon(addon)) {
		throw notFound(addon.reason);
	}

	const manifestText = texts.get(childPath(path, 'manifest.json')) ?? '';
	const { manifest, errors } = checkAddon(ctx.env, tree, addon, manifestText, commitSha);
	const bundleEntry = tree.get(addon.bundle);

	if (errors[0] || !manifest || !bundleEntry) {
		throw errors[0] ?? notFound('its bundle could not be read');
	}

	const changelogPath = childPath(path, CHANGELOG_MD);
	const addonMdPath = childPath(path, ADDON_MD);
	const [bundle, extraTexts] = await Promise.all([
		github.readBlob(repository, bundleEntry.sha),
		readTexts(github, repository, tree, [addonMdPath, changelogPath]),
	]);

	return {
		pin: {
			repository,
			repositoryId: repo.id,
			path,
			ref: request.ref,
			commitSha,
			bundlePath: addon.bundle,
			bundleBlobSha: bundleEntry.sha,
		},
		manifest,
		bundle,
		bundleSize: bundle.length,
		sha256: new Bun.CryptoHasher('sha256').update(bundle).digest('hex'),
		addonMd: extraTexts.get(addonMdPath) ?? null,
		changelog: readChangelog(changelogPath, extraTexts.get(changelogPath), manifest.version),
		details: toDetails(repo, extras, tree, request.details),
	};
}

export default { listRepositoryAddons, readAddonSource };
