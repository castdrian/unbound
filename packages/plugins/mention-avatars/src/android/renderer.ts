import type {
	NativeJavaBridge,
	NativeJavaHooksBridge,
	NativeJavaReference,
	NativeJavaValue,
} from '@unbound-app/api/native';
import {
	circularBitmap,
	decodeBitmap,
	inlineDrawable,
} from '@unbound-plugins/shared/native/android/images';
import {
	javaInt,
	javaNumber,
	javaReference,
	javaString,
	javaText,
} from '@unbound-plugins/shared/native/android/java-values';

import { planPlacements, type Placement, type SpanRange } from '~/android/placements';
import type { MentionIndex } from '~/mention-index';
import type { Mention } from '~/mentions';

const TEXT_VIEW = 'com.facebook.drawee.span.SimpleDraweeSpanTextView';
const TEXT_BUILDER = 'com.facebook.drawee.span.DraweeSpanStringBuilder';
const TAPPABLE_SPAN = 'com.discord.span.utilities.spannable.ClickableSpan';
const BACKGROUND_SPAN = 'com.discord.span.utilities.spannable.BackgroundSpan';
const IMAGE_SIZE = 16;
const ALIGN_CENTER = 2;
const SPAN_EXCLUSIVE_EXCLUSIVE = 33;
const MAX_IMAGE_BYTES = 12_000;
const MAX_TRACKED_VIEWS = 64;

type Native = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
};

type ImageEntry = {
	bitmap: NativeJavaReference | null;
	pending: boolean;
};

export type AndroidRenderer = ReturnType<typeof createAndroidRenderer>;

function viewKey(view: NativeJavaValue): string | undefined {
	return view.type === 'handle' ? view.value : undefined;
}

/**
 * @description Creates the renderer that draws mention images into Discord's Android message text.
 * @param native The plugin's Java and hook bridges.
 * @param index The mention index the renderer reads.
 * @param showAtSymbol Reads whether a user mention keeps its `@` beside the image.
 * @returns The renderer, whose `dispose` removes its hook.
 */
export function createAndroidRenderer(
	{ java, hooks }: Native,
	index: MentionIndex,
	showAtSymbol: () => boolean,
) {
	const ArrayReflection = java.getClass('java.lang.reflect.Array');
	const images = new Map<string, ImageEntry>();
	const views = new Map<string, NativeJavaReference>();
	const pending = new Set<string>();
	let imageSize = 0;
	let disposed = false;

	function spansOf(text: NativeJavaReference, length: number, className: string) {
		const spans = javaReference(
			java.invoke(text, 'getSpans', [javaInt(0), javaInt(length), java.getClass(className)]),
		);
		const count = spans
			? (javaNumber(java.invoke(ArrayReflection, 'getLength', [spans])) ?? 0)
			: 0;
		const result: NativeJavaReference[] = [];

		for (let position = 0; spans && position < count; position++) {
			const span = javaReference(
				java.invoke(ArrayReflection, 'get', [spans, javaInt(position)]),
			);

			if (span) result.push(span);
		}

		return result;
	}

	function rangeOf(text: NativeJavaReference, span: NativeJavaReference): SpanRange {
		return {
			start: javaNumber(java.invoke(text, 'getSpanStart', [span])) ?? -1,
			end: javaNumber(java.invoke(text, 'getSpanEnd', [span])) ?? -1,
		};
	}

	function sizeFor(view: NativeJavaReference, resources: NativeJavaReference): number {
		if (imageSize > 0) return imageSize;

		const metrics = javaReference(java.invoke(resources, 'getDisplayMetrics'));
		const density = metrics ? (javaNumber(java.getField(metrics, 'density')) ?? 1) : 1;

		imageSize = Math.round(IMAGE_SIZE * density);

		return imageSize;
	}

	async function load(url: string) {
		images.set(url, { bitmap: null, pending: true });

		let bitmap: NativeJavaReference | null = null;

		try {
			const response = await fetch(url);
			const bytes = response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
			const source =
				bytes && bytes.length <= MAX_IMAGE_BYTES ? decodeBitmap(java, bytes) : null;

			bitmap = source && imageSize > 0 ? circularBitmap(java, source, imageSize) : null;
		} catch {
			bitmap = null;
		}

		if (disposed) return;

		images.set(url, { bitmap, pending: false });

		if (bitmap) {
			for (const view of views.values()) schedule(view);
		}
	}

	function bitmapFor(mention: Mention): NativeJavaReference | null {
		const url = mention.avatarURL;

		if (!url?.startsWith('https://')) return null;

		const entry = images.get(url);

		if (!entry) void load(url);

		return entry?.bitmap ?? null;
	}

	function mentionSpans(builder: NativeJavaReference, range: SpanRange) {
		const length = javaNumber(java.invoke(builder, 'length')) ?? 0;

		return [BACKGROUND_SPAN, TAPPABLE_SPAN].flatMap((className) =>
			spansOf(builder, length, className)
				.filter((span) => {
					const current = rangeOf(builder, span);

					return current.start <= range.start && current.end >= range.end;
				})
				.map((span) => ({
					span,
					flags: javaNumber(java.invoke(builder, 'getSpanFlags', [span])) ?? 0,
				})),
		);
	}

	function apply(
		builder: NativeJavaReference,
		resources: NativeJavaReference,
		placement: Placement,
		bitmap: NativeJavaReference,
	) {
		const { range, replaceStart, replaceEnd, insertion, imageOffset } = placement;
		const spans = mentionSpans(builder, range);
		const grown = insertion.length - (replaceEnd - replaceStart);

		java.invoke(builder, 'replace', [
			javaInt(replaceStart),
			javaInt(replaceEnd),
			javaString(insertion),
		]);

		const image = replaceStart + imageOffset;
		const span = java.construct('android.text.style.ImageSpan', [
			inlineDrawable(java, resources, bitmap, imageSize),
			javaInt(ALIGN_CENTER),
		]);

		java.invoke(builder, 'setSpan', [
			span,
			javaInt(image),
			javaInt(image + 1),
			javaInt(SPAN_EXCLUSIVE_EXCLUSIVE),
		]);

		for (const { span: mentionSpan, flags } of spans) {
			java.invoke(builder, 'removeSpan', [mentionSpan]);
			java.invoke(builder, 'setSpan', [
				mentionSpan,
				javaInt(range.start),
				javaInt(range.end + grown),
				javaInt(flags),
			]);
		}
	}

	function render(view: NativeJavaReference) {
		const text = javaReference(java.invoke(view, 'getText'));
		const string = text ? javaText(java.invoke(text, 'toString')) : undefined;

		if (!text || !string?.includes('@')) return;

		index.hydrateChannel();

		const mentions = index.all();

		if (!mentions.length) return;

		const tappable = spansOf(text, string.length, TAPPABLE_SPAN).map((span) =>
			rangeOf(text, span),
		);
		const placements = planPlacements(string, tappable, mentions, showAtSymbol());

		if (!placements.length) return;

		const resources = javaReference(java.invoke(view, 'getResources'));

		if (!resources) return;

		sizeFor(view, resources);

		const ready = placements
			.map((placement) => ({ placement, bitmap: bitmapFor(placement.mention) }))
			.filter((entry): entry is { placement: Placement; bitmap: NativeJavaReference } =>
				Boolean(entry.bitmap),
			);

		if (!ready.length) return;

		const builder = java.construct('android.text.SpannableStringBuilder', [text]);

		for (const { placement, bitmap } of ready) apply(builder, resources, placement, bitmap);

		void java.invokeAsync(view, 'setText', [builder]).catch(() => undefined);
	}

	function track(key: string, view: NativeJavaReference) {
		views.delete(key);
		views.set(key, view);

		if (views.size > MAX_TRACKED_VIEWS) views.delete(views.keys().next().value!);
	}

	function schedule(view: NativeJavaReference) {
		const key = viewKey(view as NativeJavaValue);

		if (disposed || !key || pending.has(key)) return;

		pending.add(key);
		track(key, view);
		setTimeout(() => {
			pending.delete(key);

			if (disposed) return;

			try {
				render(view);
			} catch {
				views.delete(key);
			}
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

	return {
		dispose() {
			disposed = true;
			hooks.remove(token);
			views.clear();
			images.clear();
		},
	};
}

export default { createAndroidRenderer };
