import { metro } from '@unbound-app/api';

import { firstImage, isLinkEmbed, linkEmbed, type LinkEmbed } from '~/android/link-embed';
import { createLinkedMessages } from '~/linked-messages';
import { linkedTargets, targetKey, type LinkTarget } from '~/link-targets';
import { MessageRowData, Patcher, type Message } from '~/modules';
import { linkedChannelName } from '~/channels';

type Author = {
	username?: unknown;
	globalName?: unknown;
	getAvatarURL?: (guildId: string | undefined, size: number, animated: boolean) => unknown;
};

type MessageRecord = Message & {
	author?: Author;
	embeds?: unknown[];
	attachments?: unknown;
	set?: (key: string, value: unknown) => MessageRecord;
};

type RowInput = {
	message?: MessageRecord;
};

function embedFor(target: LinkTarget, linked: MessageRecord): LinkEmbed | undefined {
	const channelName = linkedChannelName(target, linked);

	if (!channelName) return undefined;

	const author = linked.author;
	const name = author?.globalName ?? author?.username;
	const avatar = author?.getAvatarURL?.(undefined, 64, false);

	return linkEmbed({
		messageId: target.messageId,
		authorName: typeof name === 'string' ? name : 'Unknown',
		avatarURL: typeof avatar === 'string' ? avatar : undefined,
		content: typeof linked.content === 'string' ? linked.content : '',
		timestamp: linked.timestamp,
		channelName,
		image: firstImage(linked.attachments),
	});
}

function withEmbed(message: MessageRecord, embed: LinkEmbed): MessageRecord {
	const embeds = [...(message.embeds ?? []).filter((existing) => !isLinkEmbed(existing)), embed];

	return message.set ? message.set('embeds', embeds) : { ...message, embeds };
}

/**
 * @description Shows the first message each Android message links to as a native rich embed under it.
 * @returns A function that removes the patch and forgets the linked messages.
 */
export function patchRowEmbeds(): () => void {
	const controller = new AbortController();
	const waiting = new Map<string, MessageRecord>();
	const linked = createLinkedMessages(controller.signal, (key) => {
		const source = waiting.get(key);

		waiting.delete(key);

		if (source) {
			metro.common.Dispatcher.dispatch({
				type: 'MESSAGE_UPDATE',
				message: { ...source },
				log_edit: false,
			});
		}
	});

	const unpatch = Patcher.before(MessageRowData, 'generateMessageRowData', ({ args }) => {
		const input: RowInput | undefined = args[0];
		const message = input?.message;

		if (
			!message ||
			typeof message.content !== 'string' ||
			!message.content.includes('/channels/')
		)
			return;

		const [target] = linkedTargets(message);

		if (!target) return;

		const linkedMessage = linked.get(target) as MessageRecord | undefined;

		if (!linkedMessage) {
			waiting.set(targetKey(target), message);
			linked.fetch(target);

			return;
		}

		const embed = embedFor(target, linkedMessage);

		if (embed) input.message = withEmbed(message, embed);
	});

	return () => {
		controller.abort();
		unpatch();
		waiting.clear();
		linked.clear();
	};
}

export default { patchRowEmbeds };
