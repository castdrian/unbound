import { afterEach, describe, expect, mock, test } from 'bun:test';
import type { AddonManifest } from '@unbound-app/types';

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

const removed: string[] = [];
const cleared: unknown[] = [];
const unmounted: unknown[] = [];
const capabilities = [
	'native.objc.classes',
	'native.objc.invoke',
	'native.objc.ivars',
	'native.objc.associations',
	'native.objc.hooks',
	'native.ffi.symbols',
	'native.ffi.call',
	'native.fabric.mount',
	'native.worker.run',
] as const;

const workerRuns: string[] = [];
const workerRemoved: string[] = [];
let workerFailure = false;
let workerPending: Promise<unknown> | undefined;
let workerPingPending: Promise<unknown> | undefined;

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
	fabric: {
		mount: () => ({ surface: true }),
		update: () => undefined,
		setSize: () => undefined,
		setFrame: () => undefined,
		measure: () => ({ x: 0, y: 0, width: 0, height: 0 }),
		unmount: (surface: unknown) => unmounted.push(surface),
	},
	worker: {
		available: true,
		ping: async () => workerPingPending ?? { version: 1, process: 'NativeWorker' },
		install: async (plugin: string) => {
			workerRuns.push(`install:${plugin}`);
			return true;
		},
		run: async (plugin: string, task: string, input: unknown) => {
			workerRuns.push(`${plugin}:${task}`);
			if (workerFailure) throw new Error('Worker failed');
			if (workerPending) return workerPending;
			return input;
		},
		remove: (plugin: string) => workerRemoved.push(plugin),
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

(globalThis as any).NativePlugin = bridge;

const { NativePluginCapabilityError, NativePluginDisposedError, NativePluginVersionError } =
	await import('~/api/native');
const { createPluginContext, validateNativePluginRequirements } =
	await import('~/api/native-runtime');

afterEach(() => {
	removed.length = 0;
	cleared.length = 0;
	unmounted.length = 0;
	workerRuns.length = 0;
	workerRemoved.length = 0;
	workerFailure = false;
	workerPending = undefined;
	workerPingPending = undefined;
});

async function waitForWorker(context: ReturnType<typeof createPluginContext>): Promise<void> {
	for (let attempt = 0; attempt < 10; attempt++) {
		if (context.native.worker.available) return;
		await Promise.resolve();
	}
	throw new Error('Worker did not become available');
}

describe('native plugin capability scopes', () => {
	test('hides the raw bridge after capturing it for scoped access', async () => {
		const nativeApi = await import('~/api/native');

		expect((globalThis as any).NativePlugin).toBeUndefined();
		expect(nativeApi).not.toHaveProperty('NativePlugin');
		expect(nativeApi).not.toHaveProperty('createPluginContext');
		expect(nativeApi).not.toHaveProperty('validateNativePluginRequirements');
	});

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

	test('disposes Fabric surfaces owned by a plugin context', () => {
		const context = createPluginContext({ ...manifest, capabilities: ['native.fabric.mount'] });
		const surface = context.native.fabric.mount({}, 'TestSurface');

		context.dispose();

		expect(unmounted).toEqual([surface]);
	});

	test('runs a declared worker task and removes its scope', async () => {
		const context = createPluginContext(
			{ ...manifest, worker: 'worker.js', capabilities: ['native.worker.run'] },
			'({ echo(input) { return input; } })',
		);
		await waitForWorker(context);
		const result = await context.native.worker.run(
			'echo',
			{ value: 42 },
			() => ({ value: 0 }),
			(output): output is { value: number } =>
				typeof output === 'object' && output !== null && 'value' in output,
		);

		expect(result).toEqual({ value: 42 });
		expect(workerRuns).toEqual(['install:test:1', 'test:1:echo']);
		context.dispose();
		expect(workerRemoved).toEqual(['test:1']);
	});

	test('does not delay the fallback while the worker handshake is pending', async () => {
		let complete!: (value: unknown) => void;
		workerPingPending = new Promise((resolve) => {
			complete = resolve;
		});
		const context = createPluginContext(
			{
				...manifest,
				id: 'warming',
				worker: 'worker.js',
				capabilities: ['native.worker.run'],
			},
			'({ echo(input) { return input; } })',
		);
		const result = await context.native.worker.run(
			'echo',
			21,
			(input) => input * 2,
			(output): output is number => typeof output === 'number',
		);

		expect(result).toBe(42);
		expect(context.native.worker.available).toBe(false);
		expect(workerRuns).toEqual([]);
		complete({ version: 1, process: 'NativeWorker' });
		await waitForWorker(context);
		context.dispose();
	});

	test('falls back when the worker fails', async () => {
		workerFailure = true;
		const context = createPluginContext(
			{ ...manifest, worker: 'worker.js', capabilities: ['native.worker.run'] },
			'({ echo(input) { return input; } })',
		);
		await waitForWorker(context);

		expect(
			await context.native.worker.run(
				'echo',
				21,
				(input) => input * 2,
				(output): output is number => typeof output === 'number',
			),
		).toBe(42);
		context.dispose();
	});

	test('discards a worker result after its plugin scope stops', async () => {
		let complete!: (value: unknown) => void;
		workerPending = new Promise((resolve) => {
			complete = resolve;
		});
		const context = createPluginContext(
			{
				...manifest,
				id: 'cancelled',
				worker: 'worker.js',
				capabilities: ['native.worker.run'],
			},
			'({ echo(input) { return input; } })',
		);
		await waitForWorker(context);
		const result = context.native.worker.run(
			'echo',
			21,
			(input) => input * 2,
			(output): output is number => typeof output === 'number',
		);
		await Promise.resolve();
		context.dispose();
		complete(21);

		await expect(result).rejects.toBeInstanceOf(NativePluginDisposedError);
	});

	test('disables only a failing plugin worker after repeated failures', async () => {
		workerFailure = true;
		const context = createPluginContext(
			{
				...manifest,
				id: 'unstable',
				worker: 'worker.js',
				capabilities: ['native.worker.run'],
			},
			'({ echo(input) { return input; } })',
		);
		await waitForWorker(context);
		for (let index = 0; index < 4; index++) {
			const result = await context.native.worker.run(
				'echo',
				21,
				(input) => input * 2,
				(output): output is number => typeof output === 'number',
			);
			expect(result).toBe(42);
		}
		expect(context.native.worker.available).toBe(false);
		expect(workerRuns.filter((entry) => entry.endsWith(':echo'))).toHaveLength(3);
		context.dispose();
	});

	test('denies an undeclared worker capability', async () => {
		const context = createPluginContext({ ...manifest });

		await expect(
			context.native.worker.run(
				'echo',
				1,
				(input) => input,
				(output): output is number => typeof output === 'number',
			),
		).rejects.toBeInstanceOf(NativePluginCapabilityError);
		context.dispose();
	});
});

describe('native plugin negotiation', () => {
	test('keeps the pure fallback available on a loader without worker support', async () => {
		bridge.worker.available = false;
		Object.defineProperty(bridge, 'capabilities', {
			value: capabilities.filter((capability) => capability !== 'native.worker.run'),
			configurable: true,
		});
		try {
			expect(() =>
				validateNativePluginRequirements(['native.worker.run'], '1.0.0'),
			).not.toThrow();
			const context = createPluginContext(
				{
					...manifest,
					id: 'legacy-loader',
					worker: 'worker.js',
					capabilities: ['native.worker.run'],
				},
				'({ echo(input) { return input; } })',
			);
			expect(context.native.worker.available).toBe(false);
			expect(
				await context.native.worker.run(
					'echo',
					21,
					(input) => input * 2,
					(output): output is number => typeof output === 'number',
				),
			).toBe(42);
			context.dispose();
		} finally {
			bridge.worker.available = true;
			Object.defineProperty(bridge, 'capabilities', {
				value: capabilities,
				configurable: true,
			});
		}
	});

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
		let failure: unknown;
		try {
			validateNativePluginRequirements([], '2.0.0');
		} catch (error) {
			failure = error;
		}

		expect(failure).toBeInstanceOf(NativePluginVersionError);
		expect(failure).toMatchObject({
			code: 'NATIVE_PLUGIN_API_VERSION_UNSUPPORTED',
			installedApi: '1.0.0',
			requiredApi: '2.0.0',
		});
	});
});
