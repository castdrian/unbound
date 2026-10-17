import { z } from 'zod';

/** The origin of the Unbound web API, reduced from any http(s) URL; production when unset. */
export const apiUrlSchema = z
	.url({ protocol: /^https?$/ })
	.transform((url) => new URL(url).origin)
	.default('https://unbound.rip');

export default { apiUrlSchema };
