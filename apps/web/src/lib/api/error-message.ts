import { ApiRequestError } from '~/api/client';

/**
 * @description Picks the text to show for a failed API call from the browser.
 * @param error The thrown error.
 * @returns The contract error code and the server's message, or the error's own message.
 */
// UNKNOWN: it is whatever a rejected promise was rejected with.
function getApiErrorMessage(error: unknown): string {
	if (error instanceof ApiRequestError) {
		return `${error.message} (${error.code})`;
	}

	return error instanceof Error ? error.message : String(error);
}

export default getApiErrorMessage;
