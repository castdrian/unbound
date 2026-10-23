import { z } from './zod';

/** A GitHub repository as `owner/name`. */
export const repositorySchema = z
	.string()
	.check(
		z.regex(
			/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\/[A-Za-z0-9._-]+$/,
			'Must be a GitHub owner/name.',
		),
	);

/** A full, lowercase git object id. */
export const commitShaSchema = z
	.string()
	.check(z.regex(/^[0-9a-f]{40}$/, 'Must be a full commit SHA.'));

/** A branch, tag or full commit SHA. */
export const gitRefSchema = z
	.string()
	.check(
		z.minLength(1),
		z.maxLength(255),
		z.regex(/^[^\s~^:?*[\\]+$/, 'Must be a branch, tag or commit SHA.'),
	);

/** An addon directory relative to the repository root, `/`-separated; `''` is the root. */
export const addonPathSchema = z.string().check(
	z.maxLength(255),
	z.regex(/^(?:[\w.-]+(?:\/[\w.-]+)*)?$/, 'Must be a directory inside the repository.'),
	z.refine((path) => !path.split('/').includes('..'), 'Must stay inside the repository.'),
);

/** Where a submitted version was read from: everything a reviewer needs to find the exact bytes. */
export const sourcePinSchema = z.object({
	repository: repositorySchema,
	/** GitHub's numeric id, which survives renames and transfers. */
	repositoryId: z.int().check(z.positive()),
	path: addonPathSchema,
	/** The branch, tag or SHA the author named; `commitSha` is what it resolved to. */
	ref: gitRefSchema,
	commitSha: commitShaSchema,
	/** The shipped file, relative to the repository root. */
	bundlePath: z.string().check(z.minLength(1)),
	/** The git blob id of `bundlePath` at `commitSha`. */
	bundleBlobSha: commitShaSchema,
});

export const repositoryContributorSchema = z.object({
	login: z.string().check(z.minLength(1)),
	contributions: z.int().check(z.nonnegative()),
});

export const repositoryReleaseSchema = z.object({
	tag: z.string().check(z.minLength(1)),
	name: z.nullable(z.string()),
	publishedAt: z.nullable(z.iso.datetime()),
	url: z.url(),
});

/** What GitHub said about the repository when the version was submitted; never refreshed live. */
export const repositoryDetailsSchema = z.object({
	description: z.nullable(z.string()),
	homepage: z.nullable(z.url()),
	tags: z.array(z.string().check(z.minLength(1), z.maxLength(50))).check(z.maxLength(20)),
	/** An SPDX id such as `MIT`, or `null` when GitHub detected none. */
	license: z.nullable(z.string()),
	stars: z.int().check(z.nonnegative()),
	defaultBranch: z.string().check(z.minLength(1)),
	htmlUrl: z.url(),
	readmeUrl: z.nullable(z.url()),
	contributors: z.array(repositoryContributorSchema).check(z.maxLength(10)),
	latestRelease: z.nullable(repositoryReleaseSchema),
});

export type SourcePin = z.infer<typeof sourcePinSchema>;
export type RepositoryContributor = z.infer<typeof repositoryContributorSchema>;
export type RepositoryRelease = z.infer<typeof repositoryReleaseSchema>;
export type RepositoryDetails = z.infer<typeof repositoryDetailsSchema>;

export default {
	repositorySchema,
	commitShaSchema,
	gitRefSchema,
	addonPathSchema,
	sourcePinSchema,
	repositoryContributorSchema,
	repositoryReleaseSchema,
	repositoryDetailsSchema,
};
