import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { AddonManifest } from '@unbound-app/types';

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

const removed: string[] = [];
const cleared: unknown[] = [];
const capabilities = [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
	'native.ffi.symbols',
	'native.ffi.call',
] as const;

const bridge = {
	abiVersion: '1.0.0',
	apiVersion: '1.0.0',
	capabilities,
	objc: {
		alloc: () => ({ handle: true }),
		array: () => [],
		call: () => undefined,
		callSuper: () => undefined,
		className: () => 'NSObject',
		createAssociationKey: () => ({ key: true }),
		data: () => ({ data: true }),
		getAssociatedObject: () => null,
		getClass: () => ({ class: true }),
		getIvar: () => null,
		invoke: () => undefined,
		invokeSuper: () => undefined,
		hook: (...args: string[]) => {
			void args;
			return {
				active: true,
				remove: () => removed.push('hook'),
			};
		},
		respondsTo: () => false,
		setAssociatedObject: (...args: unknown[]) => cleared.push(args),
		setIvar: () => undefined,
		struct: () => ({ struct: true }),
	},
	ffi: {
		call: () => undefined,
		symbol: () => null,
	},
};

const manifest: AddonManifest = {
	authors: [{ id: '1', name: 'test' }],
	description: 'test',
	folder: '',
	icon: '',
	id: 'test',
	main: 'index.js',
	name: 'test',
	path: '',
	updates: '',
	url: '',
	version: '1.0.0',
};

(globalThis as any).UnboundNative = bridge;

const {
	NativePluginCapabilityError,
	NativePluginDisposedError,
	createPluginContext,
	validateNativePluginRequirements,
} = await import('~/api/native');

afterEach(() => {
	removed.length = 0;
	cleared.length = 0;
});

describe('native plugin capability scopes', () => {
	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.classes'] });

		expect(context.manifest.id).toBe('test');
		expect(() => context.native.objc.invoke({}, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('disposes hooks owned by a plugin context', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.objc.hooks'] });
		const token = context.native.objc.hook('NSObject', 'description', {
			after: () => undefined,
		});

		expect(token.active).toBe(true);
		context.dispose();
		expect(removed).toEqual(['hook']);
	});

	test('clears associations and denies calls after disposal', () => {
		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.associations'],
		});
		const handle = {};
		const key = context.native.objc.createAssociationKey();

		context.native.objc.setAssociatedObject(handle, key, { value: true });
		cleared.length = 0;
		context.dispose();

		expect(cleared).toHaveLength(1);
		expect(cleared[0]).toEqual([handle, key, null, 'assign']);
		expect(() => context.native.objc.getAssociatedObject(handle, key)).toThrow(
			NativePluginDisposedError,
		);
		context.dispose();
	});
});

describe('native plugin negotiation', () => {
	test('rejects capabilities that the bridge does not advertise', () => {
		expect(() =>
			validateNativePluginRequirements(['native.objc.hooks', 'native.ffi.call'], '1.0.0'),
		).not.toThrow();
		expect(() =>
			validateNativePluginRequirements([
				'native.objc.hooks',
				'native.ffi.call',
				'native.unknown' as never,
			]),
		).toThrow(NativePluginCapabilityError);
	});

	test('rejects a plugin that requires a newer bridge API', () => {
		expect(() => validateNativePluginRequirements([], '1.1.0')).toThrow(
			'Native plugin API 1.1.0 is required',
		);
	});
});
