import { z } from 'zod';

import { ApiError } from '~/lib/api/errors';
import type { Env } from '~/lib/env';

const repositoryResponseSchema = z.object({
	permissions: z.object({ push: z.boolean() }).optional(),
});

/**
 * @description Asks GitHub whether the token's user can push to a repository.
 * @param env The validated environment.
 * @param token The user's GitHub OAuth access token.
 * @param repository The repository as `owner/name`.
 * @returns Whether the user has push access. A repository the token cannot see counts as no access.
 */
export async function hasPushAccess(env: Env, token: string, repository: string): Promise<boolean> {
	const response = await fetch(new URL(`/repos/${repository}`, env.GITHUB_API_URL), {
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${token}`,
			'x-github-api-version': '2022-11-28',
		},
	});

	if (response.status === 401) {
		throw new ApiError('github_not_linked', 'Your GitHub link has expired. Link GitHub again.');
	}

	if (response.status === 404) {
		return false;
	}

	if (!response.ok) {
		throw new Error(`GitHub answered ${response.status} for repository ${repository}.`);
	}

	const { permissions } = repositoryResponseSchema.parse(await response.json());

	return permissions?.push ?? false;
}

export default { hasPushAccess };
