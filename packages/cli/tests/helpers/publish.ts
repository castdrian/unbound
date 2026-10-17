import {
	authRequest,
	createSubmissionEndpoint,
	finalizeSubmissionEndpoint,
	serveEndpoints,
} from '@unbound-app/web/testing';
import type { AppContext } from '@unbound-app/web/testing';
import { z } from 'zod';

const createdApiKeySchema = z.object({ key: z.string() });

/**
 * @description Serves the submission endpoints `ubd publish` calls, plus Better Auth.
 * @param ctx The application context.
 * @returns The running server.
 */
export function servePublishApi(ctx: AppContext) {
	return serveEndpoints(ctx, {
		'POST /api/v1/submissions': createSubmissionEndpoint,
		'POST /api/v1/submissions/$id/finalize': finalizeSubmissionEndpoint,
	});
}

/**
 * @description Creates an API key for a signed-in user, as the account page does.
 * @param ctx The application context.
 * @param headers The user's session headers.
 * @returns The API key.
 */
export async function createApiKey(ctx: AppContext, headers: Headers): Promise<string> {
	const response = await authRequest(ctx, '/api-key/create', {
		method: 'POST',
		headers,
		body: JSON.stringify({ name: 'ci' }),
	});

	const { key } = createdApiKeySchema.parse(await response.json());

	return key;
}

/**
 * @description Builds the files of an addon directory.
 * @param id The addon id.
 * @param files The other files, by path; a `package.json` with a `build` script makes it non-static.
 * @param main The manifest's `main`.
 * @returns The files, including `manifest.json`.
 */
export function addonFiles(
	id: string,
	files: Record<string, string>,
	main: string = 'index.js',
): Record<string, string> {
	const manifest = {
		id,
		name: 'Hello',
		description: 'Says hello.',
		authors: [{ name: 'Mario', id: '1234567890' }],
		version: '1.0.0',
		main,
	};

	return { 'manifest.json': JSON.stringify(manifest), ...files };
}
