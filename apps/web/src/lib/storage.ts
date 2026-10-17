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

export type StagingUploadOptions = {
	key: string;
	/** The exact byte length the upload must have. */
	size: number;
	signedAt: Date;
	expiresIn: number;
};

export type PresignedUpload = {
	url: string;
	/** Headers the uploader must send verbatim; they are part of the signature. */
	headers: Record<string, string>;
};

function hmac(key: string | Buffer, data: string): Buffer {
	return new Bun.CryptoHasher('sha256', key).update(data).digest();
}

// SigV4 wants RFC 3986 encoding; `encodeURIComponent` leaves `!'()*` alone.
function encodeRfc3986(value: string): string {
	return encodeURIComponent(value).replaceAll(
		/[!'()*]/g,
		(char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
	);
}

/**
 * @description Presigns a PUT of exactly `size` bytes to the staging bucket (AWS SigV4 query
 * signing). `Bun.S3Client.presign` signs only the host, so it cannot pin the length: here
 * `content-length` is signed and the store rejects any other length. The URL stays reusable until it
 * expires (B2 rejects `if-none-match` on PUT), so review re-checks the bundle against the SHA-256
 * recorded on finalize.
 * @param env The validated environment.
 * @param options The object key, exact size, signing time and lifetime in seconds.
 * @returns The URL and the headers the upload must carry.
 */
export function presignStagingUpload(env: Env, options: StagingUploadOptions): PresignedUpload {
	const { key, size, signedAt, expiresIn } = options;
	const endpoint = new URL(env.S3_ENDPOINT);
	const timestamp = signedAt.toISOString().replaceAll(/[-:]|\.\d{3}/g, '');
	const scope = `${timestamp.slice(0, 8)}/${env.S3_REGION}/s3/aws4_request`;
	const segments = [env.S3_STAGING_BUCKET, ...key.split('/')].map(encodeRfc3986);
	const path = `${endpoint.pathname.replace(/\/$/, '')}/${segments.join('/')}`;
	const headers = { 'content-length': String(size) };
	const signed = Object.entries({ ...headers, host: endpoint.host }).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const signedNames = signed.map(([name]) => name);

	// Already in the sorted order the canonical query string needs.
	const query = Object.entries({
		'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
		'X-Amz-Credential': `${env.S3_ACCESS_KEY_ID}/${scope}`,
		'X-Amz-Date': timestamp,
		'X-Amz-Expires': String(expiresIn),
		'X-Amz-SignedHeaders': signedNames.join(';'),
	})
		.map(([name, value]) => `${name}=${encodeRfc3986(value)}`)
		.join('&');

	const canonicalRequest = [
		'PUT',
		path,
		query,
		...signed.map(([name, value]) => `${name}:${value}`),
		'',
		signedNames.join(';'),
		'UNSIGNED-PAYLOAD',
	].join('\n');

	const stringToSign = [
		'AWS4-HMAC-SHA256',
		timestamp,
		scope,
		new Bun.CryptoHasher('sha256').update(canonicalRequest).digest('hex'),
	].join('\n');

	const signingKey = scope
		.split('/')
		.reduce<string | Buffer>(
			(derived, part) => hmac(derived, part),
			`AWS4${env.S3_SECRET_ACCESS_KEY}`,
		);
	const signature = hmac(signingKey, stringToSign).toString('hex');

	return { url: `${endpoint.origin}${path}?${query}&X-Amz-Signature=${signature}`, headers };
}

export default { createStorage, presignStagingUpload };
