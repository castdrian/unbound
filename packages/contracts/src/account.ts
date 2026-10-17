import { z } from 'zod';

export const callerSchema = z.object({
	id: z.string().min(1),
	name: z.string(),
	image: z.string().nullable(),
	role: z.string(),
});

/** The authenticated caller, resolved from a session cookie, a bearer token or an API key. */
export const meResponseSchema = z.object({
	user: callerSchema,
});

export type Caller = z.infer<typeof callerSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;

export default { callerSchema, meResponseSchema };
