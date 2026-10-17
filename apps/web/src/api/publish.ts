import {
	createSubmissionResponseSchema,
	finalizeSubmissionResponseSchema,
} from '@unbound-app/contracts/publish';
import type { PublishedManifest } from '@unbound-app/contracts/manifest';
import type { Submission } from '@unbound-app/contracts/publish';

import type { createApiClient } from '~/api/client';
import type { Api } from '~/api';

/** The typed `request(route, options)` function `createApiClient<Api>()` returns. */
export type ApiRequest = ReturnType<typeof createApiClient<Api>>;

export type Artifact = {
	/** The validated manifest; its `main` names the bundle. */
	manifest: PublishedManifest;
	bundle: Blob;
	/** The GitHub `owner/name` the addon is built from, verified against the linked GitHub account. */
	repository?: string;
	changelog?: string;
};

/**
 * @description Publishes a built addon for review: opens a submission (the server refuses it, before
 * anything is uploaded, when the bundle is over its size limit or a spam gate applies), uploads the
 * bundle to the presigned URL and finalizes the submission.
 * @param request The typed API client, authenticated as the publisher.
 * @param artifact The manifest, bundle and submission details.
 * @returns The submission, pending review.
 */
export async function publishArtifact(
	request: ApiRequest,
	{ manifest, bundle, repository, changelog }: Artifact,
): Promise<Submission> {
	const { submission, upload } = await request('POST /api/v1/submissions', {
		body: { manifest, bundleSize: bundle.size, repository, changelog },
		response: createSubmissionResponseSchema,
	});

	const uploaded = await fetch(upload.url, {
		method: upload.method,
		headers: upload.headers,
		body: bundle,
	});

	if (!uploaded.ok) {
		throw new Error(
			`Uploading the bundle of submission ${submission.id} failed with ${uploaded.status}: ${await uploaded.text()}`,
		);
	}

	const finalized = await request('POST /api/v1/submissions/$id/finalize', {
		params: { id: submission.id },
		response: finalizeSubmissionResponseSchema,
	});

	return finalized.submission;
}

export default { publishArtifact };
