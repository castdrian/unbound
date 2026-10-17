import { createAuthClient } from 'better-auth/react';

/** The browser-side Better Auth client; it targets `/api/auth` on the page's own origin. */
const authClient = createAuthClient();

export default authClient;
