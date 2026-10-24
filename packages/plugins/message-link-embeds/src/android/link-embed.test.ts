import { describe, expect, test } from 'bun:test';

import { firstImage, isLinkEmbed, linkEmbed } from './link-embed';

describe('android message link embeds', () => {
	const summary = {
		messageId: '1',
		authorName: 'adrián',
		avatarURL: 'https://cdn/a.webp',
		content: 'AndroidImageSmokeResponse',
		timestamp: '2026-10-23T19:59:00Z',
		channelName: 'development',
	};

	test('builds a rich embed with the author, content, channel and time', () => {
		expect(linkEmbed(summary)).toEqual({
			id: 'unbound_link_1',
			type: 'rich',
			rawDescription: 'AndroidImageSmokeResponse',
			author: {
				name: 'adrián',
				iconURL: 'https://cdn/a.webp',
				iconProxyURL: 'https://cdn/a.webp',
			},
			timestamp: '2026-10-23T19:59:00Z',
			footer: { text: '#development' },
			fields: [],
		});
	});

	test('truncates long content and omits empty content', () => {
		expect(linkEmbed({ ...summary, content: 'x'.repeat(1200) }).rawDescription).toHaveLength(
			1001,
		);
		expect(linkEmbed({ ...summary, content: '   ' })).not.toHaveProperty('rawDescription');
	});

	test('carries the first sized image attachment', () => {
		const image = firstImage([
			{ url: 'a.txt', content_type: 'text/plain' },
			{
				url: 'https://cdn/b.png',
				proxy_url: 'https://media/b.png',
				width: 160,
				height: 138,
				content_type: 'image/png',
			},
		]);

		expect(image).toEqual({
			url: 'https://cdn/b.png',
			proxyURL: 'https://media/b.png',
			width: 160,
			height: 138,
			srcIsAnimated: false,
			flags: 0,
			contentType: 'image/png',
		});
		expect(linkEmbed({ ...summary, image }).image).toEqual(image);
		expect(firstImage(undefined)).toBeUndefined();
	});

	test('recognises its own embeds', () => {
		expect(isLinkEmbed(linkEmbed(summary))).toBe(true);
		expect(isLinkEmbed({ id: 'embed_24' })).toBe(false);
		expect(isLinkEmbed(null)).toBe(false);
	});
});
