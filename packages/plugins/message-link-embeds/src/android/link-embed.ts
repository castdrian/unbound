export const LINK_EMBED_PREFIX = 'unbound_link_';

const MAX_DESCRIPTION = 1000;

export type LinkedSummary = {
	messageId: string;
	authorName: string;
	avatarURL?: string;
	content: string;
	timestamp?: unknown;
	channelName: string;
	image?: EmbedImage;
};

export type EmbedImage = {
	url: string;
	proxyURL: string;
	width: number;
	height: number;
	srcIsAnimated: boolean;
	flags: number;
	contentType: string;
	placeholder?: string;
	placeholderVersion?: number;
};

export type LinkEmbed = {
	id: string;
	type: 'rich';
	rawDescription?: string;
	author: { name: string; iconURL?: string; iconProxyURL?: string };
	timestamp?: unknown;
	footer: { text: string };
	image?: EmbedImage;
	fields: never[];
};

type Attachment = {
	placeholder?: unknown;
	placeholder_version?: unknown;
	placeholderVersion?: unknown;
	flags?: unknown;
	url?: unknown;
	proxy_url?: unknown;
	proxyURL?: unknown;
	width?: unknown;
	height?: unknown;
	content_type?: unknown;
	contentType?: unknown;
};

/**
 * @description Builds the rich embed, in Discord's message record format, that shows a linked message on Android.
 * @param summary The linked message's author, content, timestamp, channel and first image.
 * @returns The embed, which Discord's row generator turns into a native embed.
 */
export function linkEmbed(summary: LinkedSummary): LinkEmbed {
	const content = summary.content.trim();

	return {
		id: `${LINK_EMBED_PREFIX}${summary.messageId}`,
		type: 'rich',
		...(content
			? {
					rawDescription:
						content.length > MAX_DESCRIPTION
							? `${content.slice(0, MAX_DESCRIPTION)}…`
							: content,
				}
			: {}),
		author: {
			name: summary.authorName,
			...(summary.avatarURL
				? { iconURL: summary.avatarURL, iconProxyURL: summary.avatarURL }
				: {}),
		},
		...(summary.timestamp ? { timestamp: summary.timestamp } : {}),
		footer: { text: `#${summary.channelName}` },
		...(summary.image ? { image: summary.image } : {}),
		fields: [],
	};
}

/**
 * @description Picks the first image attachment of a message, in the shape an embed image takes.
 * @param attachments The message's attachments.
 * @returns The image, or `undefined` when the message has no sized image attachment.
 */
export function firstImage(attachments: unknown): EmbedImage | undefined {
	if (!Array.isArray(attachments)) return undefined;

	for (const attachment of attachments as Attachment[]) {
		const type = String(attachment.content_type ?? attachment.contentType ?? '');
		const url = attachment.url;
		const proxyURL = attachment.proxy_url ?? attachment.proxyURL ?? url;
		const width = Number(attachment.width);
		const height = Number(attachment.height);

		if (
			type.startsWith('image/') &&
			typeof url === 'string' &&
			typeof proxyURL === 'string' &&
			width > 0 &&
			height > 0
		) {
			const placeholder = attachment.placeholder;
			const placeholderVersion = Number(
				attachment.placeholder_version ?? attachment.placeholderVersion,
			);

			return {
				url,
				proxyURL,
				width,
				height,
				srcIsAnimated: type === 'image/gif',
				flags: Number(attachment.flags) || 0,
				contentType: type,
				...(typeof placeholder === 'string' ? { placeholder } : {}),
				...(Number.isFinite(placeholderVersion) ? { placeholderVersion } : {}),
			};
		}
	}

	return undefined;
}

/**
 * @description Tells whether an embed is one this plugin added, so it is replaced rather than doubled.
 * @param embed A message embed.
 * @returns `true` for a link embed.
 */
export function isLinkEmbed(embed: unknown): boolean {
	return (
		typeof embed === 'object' &&
		embed !== null &&
		String((embed as { id?: unknown }).id ?? '').startsWith(LINK_EMBED_PREFIX)
	);
}

export default { firstImage, isLinkEmbed, linkEmbed };
