import { z } from 'zod';

const positiveInt = z.coerce.number().int().positive();

export const envSchema = z.object({
	PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
	PUBLIC_URL: z.url(),
	CDN_URL: z.url(),
	DATABASE_PATH: z.string().min(1),

	BETTER_AUTH_SECRET: z.string().min(32),
	DISCORD_CLIENT_ID: z.string().min(1),
	DISCORD_CLIENT_SECRET: z.string().min(1),
	GITHUB_CLIENT_ID: z.string().min(1),
	GITHUB_CLIENT_SECRET: z.string().min(1),

	/** The request header carrying the client IP, e.g. `cf-connecting-ip` behind Cloudflare. */
	IP_ADDRESS_HEADER: z.string().min(1).default('x-forwarded-for'),
	AUTH_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(60),
	AUTH_RATE_LIMIT_MAX: positiveInt.default(100),
	API_KEY_RATE_LIMIT_WINDOW_SECONDS: positiveInt.default(86_400),
	API_KEY_RATE_LIMIT_MAX: positiveInt.default(1000),

	S3_ENDPOINT: z.url(),
	S3_REGION: z.string().min(1),
	S3_ACCESS_KEY_ID: z.string().min(1),
	S3_SECRET_ACCESS_KEY: z.string().min(1),
	S3_STAGING_BUCKET: z.string().min(1),
	S3_PUBLIC_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;
export type EnvSource = Record<string, string | undefined>;

/**
 * @description Parses and validates the process environment, failing loudly on anything missing or
 * malformed so the server never boots half-configured.
 * @param source The raw environment, `process.env` by default.
 * @returns The validated environment.
 */
export function parseEnv(source: EnvSource = process.env): Env {
	const result = envSchema.safeParse(source);

	if (!result.success) {
		throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
	}

	return result.data;
}

export default { envSchema, parseEnv };
