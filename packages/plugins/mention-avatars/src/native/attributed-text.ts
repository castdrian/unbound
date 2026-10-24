import {
	imageAttachment,
	isAttachmentRun,
	isTappableRun,
	textAttachmentBridge,
	type TextEngine,
} from '@unbound-plugins/shared/native/text-attachments';

import type { Bridge, Handle, TextAttributes } from '~/native/bridge';
import type { Mention, MentionType } from '~/mentions';
import { MENTION_PLACEHOLDER } from '~/constants';
import { selectMentionLabel } from '~/mentions';

type MentionMatch = {
	attributes: TextAttributes;
	// Where the mention starts once leading highlighted placeholders are included.
	begin: number;
	index: number;
	label: string;
};

function isHighlighted(bridge: Bridge, text: Handle, from: number, to: number): boolean {
	for (let index = from; index < to; index++) {
		if (!isTappableRun(bridge.attributes(text, index))) {
			return false;
		}
	}

	return true;
}

// Finds the next `@label` that Discord rendered as a tappable mention, from `start` on.
function nextMention(
	bridge: Bridge,
	text: Handle,
	string: string,
	start: number,
	labels: string[],
): MentionMatch | null {
	for (
		let index = string.indexOf('@', start);
		index !== -1;
		index = string.indexOf('@', index + 1)
	) {
		const label = selectMentionLabel(string.slice(index), labels);
		const attributes = label ? bridge.attributes(text, index) : null;

		if (!label || !isTappableRun(attributes)) {
			continue;
		}

		if (!isHighlighted(bridge, text, index + 1, index + label.length + 1)) {
			continue;
		}

		let begin = index;

		while (
			begin > start &&
			string[begin - 1] === MENTION_PLACEHOLDER &&
			isTappableRun(bridge.attributes(text, begin - 1))
		) {
			begin--;
		}

		return { attributes, begin, index, label };
	}

	return null;
}

function attributedMention(
	bridge: Bridge,
	engine: TextEngine,
	text: string,
	type: MentionType,
	attributes: TextAttributes,
	image: Handle,
): Handle {
	const leading = type === 'role' ? 4 : 2;
	const trailing = type === 'role' ? 2 : 4;
	const mention = bridge.objc.alloc('NSMutableAttributedString');

	bridge.call(mention, 'initWithString:attributes:', text, attributes);

	if (engine === 'textkit' && type === 'role' && text.length > 0) {
		bridge.call(
			mention,
			'addAttribute:value:range:',
			'NSKern',
			leading,
			bridge.range(text.length - 1, 1),
		);
	}

	const avatar = imageAttachment(textAttachmentBridge(bridge.objc), engine, {
		attributes,
		image,
		leading,
		size: 16,
		trailing: type === 'role' && engine === 'textkit' ? 0 : trailing,
	});

	if (!avatar) return mention;

	const replacement = bridge.objc.alloc('NSMutableAttributedString');

	bridge.call(replacement, 'init');

	for (const part of type === 'role' ? [mention, avatar] : [avatar, mention]) {
		bridge.call(replacement, 'appendAttributedString:', part);
	}

	return replacement;
}

/**
 * @description Copies attributed message text with an image beside each mention whose image is ready.
 * @param bridge The plugin's native bridge.
 * @param text The original attributed text.
 * @param mentions The message's mentions, in order.
 * @param imageFor Returns a mention's image, or `null` while it is not ready.
 * @param showAtSymbol Whether a mention keeps its `@` beside the image.
 * @returns The new attributed text, or `text` when it cannot be copied.
 */
export function insertMentionImages(
	bridge: Bridge,
	engine: TextEngine,
	text: Handle,
	mentions: Mention[],
	imageFor: (mention: Mention) => Handle | null,
	showAtSymbol: boolean,
): Handle {
	const result = bridge.handle(text, 'mutableCopy');

	if (!result) return text;

	let searchIndex = 0;

	for (const mention of mentions) {
		const string = bridge.string(result, 'string');

		if (string === undefined || searchIndex >= string.length) break;

		const match = nextMention(bridge, result, string, searchIndex, mention.labels);

		if (!match) break;

		const { attributes, begin, index, label } = match;
		const end = index + label.length + 1;
		const image = imageFor(mention);

		if (!image) {
			searchIndex = end;
			continue;
		}

		// Widen the range over images a previous pass inserted, so they are replaced, not doubled.
		let from = index;
		let to = end;

		while (
			from > begin &&
			string[from - 1] === MENTION_PLACEHOLDER &&
			isAttachmentRun(bridge.attributes(result, from - 1))
		) {
			from--;
		}

		while (
			string[to] === MENTION_PLACEHOLDER &&
			isAttachmentRun(bridge.attributes(result, to))
		) {
			to++;
		}

		const replacement = attributedMention(
			bridge,
			engine,
			showAtSymbol ? `@${label}` : label,
			mention.type,
			attributes,
			image,
		);

		bridge.call(
			result,
			'replaceCharactersInRange:withAttributedString:',
			bridge.range(from, to - from),
			replacement,
		);
		searchIndex = from + bridge.number(replacement, 'length');
	}

	return result;
}

export default insertMentionImages;
