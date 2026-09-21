import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

const removed: string[] = [];
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
		setAssociatedObject: () => undefined,
		setIvar: () => undefined,
		struct: () => ({ struct: true }),
	},
	ffi: {
		call: () => undefined,
		symbol: () => null,
	},
};

(globalThis as any).UnboundNative = bridge;

const { NativePluginCapabilityError, createPluginContext, validateNativePluginRequirements } =
	await import('~/api/native');

afterEach(() => {
	removed.length = 0;
});

describe('native plugin capability scopes', () => {
	test('denies operations that are outside the declared scope', () => {
		const context = createPluginContext('test', ['native.objc.classes']);

		expect(() => context.native.objc.invoke({}, 'description', [])).toThrow(
			NativePluginCapabilityError,
		);
	});

	test('disposes hooks owned by a plugin context', () => {
		const context = createPluginContext('test', ['native.objc.hooks']);
		const token = context.native.objc.hook('NSObject', 'description', {
			after: () => undefined,
		});

		expect(token.active).toBe(true);
		context.dispose();
		expect(removed).toEqual(['hook']);
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
