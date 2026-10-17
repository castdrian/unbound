/** The error half of a Better Auth client call's `{ data, error }` result. */
export type AuthClientError = {
	message?: string;
	statusText: string;
};

/**
 * @description Picks the text to show for a failed Better Auth client call.
 * @param error The call's error.
 * @returns The server's message, or the HTTP status text when it sent none.
 */
function getAuthErrorMessage(error: AuthClientError): string {
	return error.message || error.statusText;
}

export default getAuthErrorMessage;
