import type { Env } from '~/lib/env';

export type Storage = {
	/** Private bucket for submitted artifacts awaiting review; reviewers read it through presigned URLs. */
	staging: Bun.S3Client;
	/** Public bucket behind `CDN_URL` holding approved, immutable artifacts. */
	public: Bun.S3Client;
};

/**
 * @description Builds the object storage clients for both buckets from the environment.
 * @param env The validated environment.
 * @returns The staging and public bucket clients.
 */
export function createStorage(env: Env): Storage {
	const credentials = {
		endpoint: env.S3_ENDPOINT,
		region: env.S3_REGION,
		accessKeyId: env.S3_ACCESS_KEY_ID,
		secretAccessKey: env.S3_SECRET_ACCESS_KEY,
	};

	return {
		staging: new Bun.S3Client({ ...credentials, bucket: env.S3_STAGING_BUCKET }),
		public: new Bun.S3Client({ ...credentials, bucket: env.S3_PUBLIC_BUCKET }),
	};
}

export default { createStorage };
