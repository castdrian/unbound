import { getRequestHeaders } from '@tanstack/react-start/server';
import type { Caller } from '@unbound-app/contracts/account';
import { createServerFn } from '@tanstack/react-start';

import { DEFAULT_ROLE } from '~/lib/auth/access';
import app from '~/lib/app';

/** The signed-in user as pages see them: the API's caller shape plus the email shown on `/account`. */
export type SessionUser = Caller & {
	email: string;
};

export type PageSession = {
	user: SessionUser;
};

/**
 * @description Resolves the browser session from the request cookies, on the server, for route
 * `beforeLoad`s. Client navigations call it as a server function.
 * @returns The signed-in user, or null.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
	async (): Promise<PageSession | null> => {
		const session = await app.auth.api.getSession({ headers: getRequestHeaders() });

		if (!session) return null;

		const { id, name, email, image, role } = session.user;

		return { user: { id, name, email, image: image ?? null, role: role ?? DEFAULT_ROLE } };
	},
);

export default { getSession };
