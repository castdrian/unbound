import type { NativeObjectHandle } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import {
	ATTACHMENT_CHARACTER,
	imageAttachment,
	isAttachmentRun,
	isTappableRun,
	isTextBoundary,
	textEngine,
	type TextAttachmentBridge,
} from './text-attachments';

type Call = { target: unknown; selector: string; args: unknown[] };

type BridgeOptions = { textView?: boolean; classes?: string[] };

type Named = { name?: string };

const FONT_METRICS: Record<string, number> = { capHeight: 10, ascender: 12, descender: -4 };

function handle(name: string): NativeObjectHandle {
	return Object.assign(Object.create(null), { name });
}

function isNamed(value: unknown): value is Named {
	return typeof value === 'object' && value !== null && 'name' in value;
}

function nameOf(value: NativeObjectHandle | null | undefined): string | undefined {
	return isNamed(value) ? value.name : undefined;
}

function createBridge(options: BridgeOptions = {}) {
	const calls: Call[] = [];
	const available = new Set(
		options.classes ?? ['NSTextAttachment', 'YYTextAttachment', 'YYTextRunDelegate'],
	);
	const textViewClass = handle('UITextView');
	const bridge: TextAttachmentBridge = {
		call(target, selector, ...args) {
			calls.push({ target, selector, args });

			if (selector === 'isKindOfClass:') {
				return options.textView === true && args[0] === textViewClass;
			}

			if (selector in FONT_METRICS) {
				return FONT_METRICS[selector];
			}

			if (selector === 'CTRunDelegate') {
				return handle('CTRunDelegateRef');
			}

			return undefined;
		},
		getClass(name) {
			if (name === 'UITextView') {
				return textViewClass;
			}

			return available.has(name) ? handle(name) : null;
		},
		alloc(classOrName) {
			const name = typeof classOrName === 'string' ? classOrName : nameOf(classOrName);

			return handle(`instance:${name}`);
		},
		struct(name, value) {
			return Object.assign(Object.create(null), { struct: name, value });
		},
	};

	return { bridge, calls };
}

function selectorsOn(calls: Call[], name: string): string[] {
	return calls.filter((call) => nameOf(call.target) === name).map((call) => call.selector);
}

describe('message text engines', () => {
	test('treats a UITextView subclass as TextKit', () => {
		const { bridge } = createBridge({ textView: true });

		expect(textEngine(bridge, handle('DCDAttributedTextView'))).toBe('textkit');
	});

	test('treats any other text view as YYText', () => {
		const { bridge } = createBridge({ textView: false });

		expect(textEngine(bridge, handle('DCDReusableYYLabel'))).toBe('yytext');
	});

	test('recognises a tappable run from either engine', () => {
		expect(isTappableRun({ YYTextHighlight: handle('h') })).toBe(true);
		expect(isTappableRun({ 'ContentNodeAttribute:TappableHighlight': handle('h') })).toBe(true);
		expect(isTappableRun({ NSFont: handle('f') })).toBe(false);
		expect(isTappableRun(null)).toBe(false);
	});

	test('recognises an attachment run from either engine', () => {
		expect(isAttachmentRun({ YYTextAttachment: handle('a') })).toBe(true);
		expect(isAttachmentRun({ NSAttachment: handle('a') })).toBe(true);
		expect(isAttachmentRun({ NSFont: handle('f') })).toBe(false);
		expect(isAttachmentRun(undefined)).toBe(false);
	});
});

describe('text boundaries', () => {
	test("ends a run at whitespace, the end of the text, or Discord's invisible formatting", () => {
		for (const character of [
			undefined,
			'',
			' ',
			'\n',
			'\u2060',
			'\u2068',
			'\u2069',
			'\u200B',
			'\uFEFF',
		]) {
			expect(isTextBoundary(character)).toBe(true);
		}
	});

	test('does not end a run at a visible character', () => {
		for (const character of ['a', '@', '.', 'á', '1']) {
			expect(isTextBoundary(character)).toBe(false);
		}
	});
});

describe('image attachments', () => {
	const font = handle('font');
	const image = handle('image');

	test('builds a TextKit attachment sized and centred on the cap height', () => {
		const { bridge, calls } = createBridge();
		const result = imageAttachment(bridge, 'textkit', {
			attributes: { NSFont: font },
			image,
			size: 16,
			trailing: 4,
		});

		expect(result).not.toBeNull();
		expect(selectorsOn(calls, 'instance:NSTextAttachment')).toEqual([
			'init',
			'setImage:',
			'setBounds:',
		]);

		const bounds = calls.find((call) => call.selector === 'setBounds:')?.args[0] as {
			value: { origin: { y: number }; size: { width: number; height: number } };
		};

		expect(bounds.value.size).toEqual({ width: 16, height: 16 });
		expect(bounds.value.origin.y).toBe(-3);

		const string = calls.find((call) => call.selector === 'initWithString:attributes:');

		expect(string?.args[0]).toBe(ATTACHMENT_CHARACTER);

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['NSAttachment', 'NSKern']);
	});

	test('omits spacing on TextKit when no trailing gap is asked for', () => {
		const { bridge, calls } = createBridge();

		imageAttachment(bridge, 'textkit', { attributes: { NSFont: font }, image, size: 16 });

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['NSAttachment']);
	});

	test('builds a YYText attachment with a run delegate reserving its width', () => {
		const { bridge, calls } = createBridge();
		const result = imageAttachment(bridge, 'yytext', {
			attributes: { NSFont: font },
			image,
			leading: 2,
			size: 16,
			trailing: 4,
		});

		expect(result).not.toBeNull();

		const values = calls
			.filter((call) => call.selector === 'setValue:forKey:')
			.map((call) => call.args[1]);

		expect(values).toContain('content');
		expect(values).toContain('width');

		const width = calls.find(
			(call) => call.selector === 'setValue:forKey:' && call.args[1] === 'width',
		);

		expect(width?.args[0]).toBe(22);

		const attributes = calls
			.filter((call) => call.selector === 'addAttribute:value:range:')
			.map((call) => call.args[0]);

		expect(attributes).toEqual(['YYTextAttachment', 'CTRunDelegate']);
	});

	test('returns null when the engine has no attachment class', () => {
		const { bridge } = createBridge({ classes: [] });

		expect(imageAttachment(bridge, 'textkit', { attributes: {}, image, size: 16 })).toBeNull();
		expect(imageAttachment(bridge, 'yytext', { attributes: {}, image, size: 16 })).toBeNull();
	});

	test('centres on a zero cap height when the attributes carry no font', () => {
		const { bridge, calls } = createBridge();

		imageAttachment(bridge, 'textkit', { attributes: {}, image, size: 16 });

		const bounds = calls.find((call) => call.selector === 'setBounds:')?.args[0] as {
			value: { origin: { y: number } };
		};

		expect(bounds.value.origin.y).toBe(-8);
	});
});
