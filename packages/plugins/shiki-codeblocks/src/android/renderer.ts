import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import { readViewText, spansOf } from '@unbound-plugins/shared/native/android/spans';
import {
	currentDecorView,
	findViewsOfClass,
	STARTUP_SCAN_DELAYS,
} from '@unbound-plugins/shared/native/android/views';
import { javaInt, javaReference } from '@unbound-plugins/shared/native/android/java-values';

import {
	androidColor,
	codeRanges,
	sourceBlock,
	tokenRuns,
	type TokenRun,
} from '~/android/code-ranges';
import { parseFencedCodeBlocks, type CodeBlock } from '~/fences';
import { MessageStore, SelectedChannelStore, settings } from '~/modules';
import { CARD_SETTINGS, PLUGIN_NAME } from '~/constants';
import { createHighlighter } from '~/highlighter';
import { readPreferences } from '~/preferences';

const TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
const TEXT_BUILDER = 'com.facebook.drawee.span.DraweeSpanStringBuilder';
const BLOCK_BACKGROUND_SPAN = 'com.discord.span.utilities.spannable.BlockBackgroundSpan';
const FOREGROUND_SPAN = 'android.text.style.ForegroundColorSpan';
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const TYPEFACE_BOLD = 1;
const TYPEFACE_ITALIC = 2;
const MAX_TRACKED_VIEWS = 64;

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

type Message = {
	content?: unknown;
};

function channelBlocks(): CodeBlock[] {
	const channelId = SelectedChannelStore.getChannelId();
	const messages: Message[] = MessageStore.getMessages(channelId)?._array ?? [];

	return messages.flatMap((message) =>
		typeof message.content === 'string' && message.content.includes('```')
			? parseFencedCodeBlocks(message.content)
			: [],
	);
}

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Creates the renderer that recolors code blocks in Discord's Android message text with Shiki themes.
 * @param native The plugin's Java and hook bridges.
 * @returns The renderer, whose `dispose` removes its hook and settings listener.
 */
export function createAndroidRenderer({ java, hooks }: Native) {
	const highlighter = createHighlighter();
	const views = new Map<string, NativeJavaReference>();
	const pending = new Set<string>();
	let disposed = false;

	function setSpan(
		builder: NativeJavaReference,
		span: NativeJavaReference,
		start: number,
		end: number,
	) {
		java.invoke(builder, 'setSpan', [
			span,
			javaInt(start),
			javaInt(end),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);
	}

	function paintRun(builder: NativeJavaReference, run: TokenRun) {
		setSpan(builder, java.construct(FOREGROUND_SPAN, [javaInt(run.color)]), run.start, run.end);

		if (run.fontStyle & 1) {
			setSpan(
				builder,
				java.construct('android.text.style.StyleSpan', [javaInt(TYPEFACE_ITALIC)]),
				run.start,
				run.end,
			);
		}

		if (run.fontStyle & 2) {
			setSpan(
				builder,
				java.construct('android.text.style.StyleSpan', [javaInt(TYPEFACE_BOLD)]),
				run.start,
				run.end,
			);
		}

		if (run.fontStyle & 4) {
			setSpan(
				builder,
				java.construct('android.text.style.UnderlineSpan', []),
				run.start,
				run.end,
			);
		}
	}

	async function render(view: NativeJavaReference) {
		const content = readViewText(java, view);

		if (!content) return;

		const ranges = codeRanges(
			content.string,
			spansOf(java, content.text, content.string.length, BLOCK_BACKGROUND_SPAN),
		);

		if (!ranges.length) return;

		const { theme, hljs } = readPreferences();
		const blocks = channelBlocks();
		const painted = await Promise.all(
			ranges.map(async (range) => {
				const block = sourceBlock(range.code, blocks);

				if (!block || block.language === 'plain') return null;

				const tokens = await highlighter.tokenize(
					{ ...block, code: range.code },
					theme,
					hljs,
				);

				return tokens ? { range, runs: tokenRuns(tokens, range) } : null;
			}),
		);
		const ready = painted.filter((entry) => entry?.runs);

		if (disposed || !ready.length) return;

		const current = readViewText(java, view);

		if (current?.string !== content.string) return;

		const builder = java.construct('android.text.SpannableStringBuilder', [current.text]);
		const foreground = androidColor(highlighter.appearance(theme).foreground);

		for (const entry of ready) {
			const { range, runs } = entry!;

			for (const hit of spansOf(java, builder, content.string.length, FOREGROUND_SPAN)) {
				if (hit.start >= range.start && hit.end <= range.end + 2)
					java.invoke(builder, 'removeSpan', [hit.span]);
			}

			if (foreground !== undefined) {
				setSpan(
					builder,
					java.construct(FOREGROUND_SPAN, [javaInt(foreground)]),
					range.start,
					range.end,
				);
			}

			for (const run of runs!) paintRun(builder, run);
		}

		await java.invokeAsync(view, 'setText', [builder]);
	}

	function schedule(view: NativeJavaReference) {
		const key = viewKey(view as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		views.delete(key);
		views.set(key, view);

		if (views.size > MAX_TRACKED_VIEWS) views.delete(views.keys().next().value!);

		setTimeout(() => {
			pending.delete(key);

			if (disposed) return;

			render(view).catch((error) => {
				views.delete(key);
				console.error(`[${PLUGIN_NAME}] Failed to highlight an Android code block:`, error);
			});
		}, 0);
	}

	const token = hooks.hook(
		TEXT_VIEW,
		'setDraweeSpanStringBuilder',
		[TEXT_BUILDER],
		{ notify: true },
		({ self }) => {
			const view = javaReference(self);

			if (view) schedule(view);
		},
	);

	const unsubscribe = settings.addListener(
		({ key }) => CARD_SETTINGS.includes(key ?? ''),
		() => {
			for (const view of views.values()) schedule(view);
		},
	);

	function scanVisible() {
		const decor = currentDecorView(java);

		if (!decor || disposed) return;

		for (const view of findViewsOfClass(java, decor, TEXT_VIEW)) schedule(view);
	}

	const scans = STARTUP_SCAN_DELAYS.map((delay) => setTimeout(scanVisible, delay));

	return {
		dispose() {
			for (const scan of scans) clearTimeout(scan);

			disposed = true;
			hooks.remove(token);
			unsubscribe();
			views.clear();
		},
	};
}

export default { createAndroidRenderer };
