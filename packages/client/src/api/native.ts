import type {
	Fn,
	NativeFFIBridge,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	PluginContext,
	PromiseFn,
} from '@unbound-app/types';
import { NativeModules, TurboModuleRegistry } from 'react-native';

export type {
	NativeAssociationKey,
	NativeCallOptions,
	NativeClassHandle,
	NativeFFIBridge,
	NativeFFISignature,
	NativeFFIType,
	NativeFFITypeName,
	NativeHandle,
	NativeHookContext,
	NativeHookHandlers,
	NativeHookOptions,
	NativeHookToken,
	NativeObjCBridge,
	NativeObjectHandle,
	NativePlatformBridge,
	NativePluginBridge,
	NativePluginCapability,
	NativePluginError,
	NativePointer,
	NativeStruct,
	NativeThreadPolicy,
	PluginContext,
} from '@unbound-app/types/native';

/** The text encodings accepted by the native `DCDFileManager` read/write operations. */
export type DCDFileManagerEncoding = 'utf-8' | 'utf8' | 'base64';

/** The constant directory paths exposed by the native `DCDFileManager`. */
export interface DCDFileManagerConstants {
	CacheDirPath: string;
	DocumentsDirPath: string;
}

/** The native `DCDFileManager` module surface for reading, writing, and inspecting files. */
export interface DCDFileManagerType extends DCDFileManagerConstants {
	readFile(path: string, encoding: DCDFileManagerEncoding): Promise<string>;
	writeFile(
		type: 'documents' | 'cache',
		path: string,
		data: string,
		encoding: DCDFileManagerEncoding,
	): Promise<string>;
	removeFile(type: 'documents' | 'cache', path: string): Promise<any>;
	readAsset(): Promise<unknown>;
	getSize(): Promise<unknown>;
	getVideoDimensions(): Promise<unknown>;
	fileExists(path: string): Promise<boolean>;
	saveFileToGallery(): Promise<unknown>;
	getConstants(): DCDFileManagerConstants;
}

/** Build and release metadata reported by the native client info module. */
export interface BundleInfoType {
	Version: string;
	ReleaseChannel: string;
	Manifest: string;
	Build: string;
	SentryDsn: string;
	DeviceVendorID: string;
	OTABuild: string;
	SentryStaffDsn: string;
	Identifier: string;
	SentryAlphaBetaDsn: string;
}

/** Hardware and OS details reported by the native device module. */
export interface DeviceInfoType {
	isTaskBarEnabled: boolean;
	maxCpuFreq: string;
	socName: string;
	deviceModel: string;
	isTablet: boolean;
	isGestureNavigationEnabled: boolean;
	deviceProduct: string;
	systemVersion: string;
	deviceManufacturer: string;
	deviceBrand: string;
	ramSize: string;
	device: string;
}

/** The native `BundleUpdaterManager` module surface for OTA updates and reloading the bundle. */
export interface DCDBundleManagerType {
	getInitialBundleDownloaded: PromiseFn;
	getInitialOtaUpdateChecked: PromiseFn;
	checkForUpdateAndReload: Fn;
	reload: Fn;
	getOtaRootPath: PromiseFn;
	getBuildOverrideCookieContents: PromiseFn;
	setBuildOverrideCookieHeader: PromiseFn;
	getManifestInfo: PromiseFn;
	addListener: Fn;
	removeListeners: Fn;
}

/**
 * @description Resolves the first available native module matching any of the given names, checking both `NativeModules` and the `TurboModuleRegistry`.
 * @template T The type of the resolved native module.
 * @param names The candidate native module names to look up, in priority order.
 * @returns The first matching native module.
 */
export function getNativeModule<T = any>(...names: string[]): T {
	return [
		...names.map((n) => NativeModules[n]),
		...names.map((n) => TurboModuleRegistry.get?.(n)),
	].find((x) => x) as T;
}

/** The resolved native client info module, exposing build and release metadata. */
export const BundleInfo: BundleInfoType = getNativeModule(
	'NativeClientInfoModule',
	'InfoDictionaryManager',
	'RTNClientInfoManager',
);
/** The resolved native bundle updater module, used to check for updates and reload the bundle. */
export const BundleManager: DCDBundleManagerType = getNativeModule('BundleUpdaterManager');
/** The resolved native device module, exposing hardware and OS details. */
export const DeviceInfo: DeviceInfoType = getNativeModule('NativeDeviceModule', 'DCDDeviceManager');

/**
 * @description Persists pending settings to storage, then reloads the native bundle.
 */
export async function reload() {
	const { persist } = await import('~/api/storage');
	await persist();

	BundleManager.reload();
}

/**
 * @description Reads Hermes' runtime metadata, such as the bytecode version, GC, and build channel.
 * React Native types the global `HermesInternal` as `null | {}`, so this reads it via
 * `window.HermesInternal` where our own typing wins.
 * @returns The runtime property map, or an empty object when Hermes internals are unavailable.
 */
export function getRuntimeProperties(): Record<string, any> {
	return window.HermesInternal?.getRuntimeProperties() ?? {};
}

type NativeMethod = (...args: any[]) => any;

const nativePlugin = globalThis.UnboundNative;

export const NativePlugin: NativePluginBridge | undefined = nativePlugin;
export const NativePlatform: NativePlatformBridge | undefined = globalThis.UnboundPlatform;

const capabilityRequirements: Record<string, NativePluginCapability> = {
	getClass: 'native.objc.classes',
	alloc: 'native.objc.classes',
	className: 'native.objc.classes',
	respondsTo: 'native.objc.classes',
	call: 'native.objc.invoke',
	callSuper: 'native.objc.invoke',
	invoke: 'native.objc.invoke',
	invokeSuper: 'native.objc.invoke',
	getIvar: 'native.objc.ivars',
	setIvar: 'native.objc.ivars',
	createAssociationKey: 'native.objc.associations',
	getAssociatedObject: 'native.objc.associations',
	setAssociatedObject: 'native.objc.associations',
	struct: 'native.objc.classes',
	array: 'native.objc.classes',
	data: 'native.objc.classes',
	hook: 'native.objc.hooks',
};

export class NativePluginUnavailableError extends Error {
	readonly code = 'NATIVE_PLUGIN_UNAVAILABLE';
}

export class NativePluginCapabilityError extends Error {
	readonly code = 'NATIVE_PLUGIN_CAPABILITY_DENIED';
	readonly capability: NativePluginCapability;

	constructor(capability: NativePluginCapability) {
		super(`Native plugin capability is not declared: ${capability}`);
		this.capability = capability;
	}
}

function requireNativePlugin(): NativePluginBridge {
	if (!NativePlugin)
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	return NativePlugin;
}

function hasCapability(
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): boolean {
	return capabilities.includes(capability);
}

function requireCapability(
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): void {
	if (!hasCapability(capabilities, capability)) {
		throw new NativePluginCapabilityError(capability);
	}
}

function scopedMethod(
	method: NativeMethod,
	capabilities: readonly NativePluginCapability[],
	capability: NativePluginCapability,
): NativeMethod {
	return (...args: any[]) => {
		requireCapability(capabilities, capability);
		return method(...args);
	};
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.split('.').map(Number);
	const rightParts = right.split('.').map(Number);
	const length = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < length; index++) {
		const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (difference !== 0) return difference;
	}

	return 0;
}

function unavailableNativePlugin(): NativePluginBridge {
	const unavailableMethod = () => {
		throw new NativePluginUnavailableError('The native plugin bridge is unavailable.');
	};
	const unavailableObjC = new Proxy({}, { get: () => unavailableMethod }) as NativeObjCBridge;
	const unavailableFFI = new Proxy({}, { get: () => unavailableMethod }) as NativeFFIBridge;

	return {
		apiVersion: '0.0.0',
		abiVersion: '0.0.0',
		capabilities: [],
		objc: unavailableObjC,
		ffi: unavailableFFI,
	};
}

function createScopedNativePlugin(capabilities: readonly NativePluginCapability[]): {
	bridge: NativePluginBridge;
	dispose: () => void;
} {
	const bridge = NativePlugin ?? unavailableNativePlugin();
	const tokens = new Set<NativeHookToken>();

	const objc: NativeObjCBridge = {
		getClass: scopedMethod(
			bridge.objc.getClass.bind(bridge.objc),
			capabilities,
			capabilityRequirements.getClass,
		) as NativeObjCBridge['getClass'],
		alloc: scopedMethod(
			bridge.objc.alloc.bind(bridge.objc),
			capabilities,
			capabilityRequirements.alloc,
		) as NativeObjCBridge['alloc'],
		className: scopedMethod(
			bridge.objc.className.bind(bridge.objc),
			capabilities,
			capabilityRequirements.className,
		) as NativeObjCBridge['className'],
		respondsTo: scopedMethod(
			bridge.objc.respondsTo.bind(bridge.objc),
			capabilities,
			capabilityRequirements.respondsTo,
		) as NativeObjCBridge['respondsTo'],
		call: scopedMethod(
			bridge.objc.call.bind(bridge.objc),
			capabilities,
			capabilityRequirements.call,
		) as NativeObjCBridge['call'],
		callSuper: scopedMethod(
			bridge.objc.callSuper.bind(bridge.objc),
			capabilities,
			capabilityRequirements.callSuper,
		) as NativeObjCBridge['callSuper'],
		invoke: scopedMethod(
			bridge.objc.invoke.bind(bridge.objc),
			capabilities,
			capabilityRequirements.invoke,
		) as NativeObjCBridge['invoke'],
		invokeSuper: scopedMethod(
			bridge.objc.invokeSuper.bind(bridge.objc),
			capabilities,
			capabilityRequirements.invokeSuper,
		) as NativeObjCBridge['invokeSuper'],
		getIvar: scopedMethod(
			bridge.objc.getIvar.bind(bridge.objc),
			capabilities,
			capabilityRequirements.getIvar,
		) as NativeObjCBridge['getIvar'],
		setIvar: scopedMethod(
			bridge.objc.setIvar.bind(bridge.objc),
			capabilities,
			capabilityRequirements.setIvar,
		) as NativeObjCBridge['setIvar'],
		createAssociationKey: scopedMethod(
			bridge.objc.createAssociationKey.bind(bridge.objc),
			capabilities,
			capabilityRequirements.createAssociationKey,
		) as NativeObjCBridge['createAssociationKey'],
		getAssociatedObject: scopedMethod(
			bridge.objc.getAssociatedObject.bind(bridge.objc),
			capabilities,
			capabilityRequirements.getAssociatedObject,
		) as NativeObjCBridge['getAssociatedObject'],
		setAssociatedObject: scopedMethod(
			bridge.objc.setAssociatedObject.bind(bridge.objc),
			capabilities,
			capabilityRequirements.setAssociatedObject,
		) as NativeObjCBridge['setAssociatedObject'],
		struct: scopedMethod(
			bridge.objc.struct.bind(bridge.objc),
			capabilities,
			capabilityRequirements.struct,
		) as NativeObjCBridge['struct'],
		array: scopedMethod(
			bridge.objc.array.bind(bridge.objc),
			capabilities,
			capabilityRequirements.array,
		) as NativeObjCBridge['array'],
		data: scopedMethod(
			bridge.objc.data.bind(bridge.objc),
			capabilities,
			capabilityRequirements.data,
		) as NativeObjCBridge['data'],
		hook: ((
			className: string,
			selector: string,
			handlers: NativeHookHandlers,
			options?: NativeHookOptions,
		) => {
			requireCapability(capabilities, capabilityRequirements.hook);
			const token = bridge.objc.hook(className, selector, handlers, options);
			tokens.add(token);
			return {
				get active() {
					return token.active;
				},
				remove() {
					token.remove();
					tokens.delete(token);
				},
			};
		}) as NativeObjCBridge['hook'],
	};

	const ffi: NativeFFIBridge = {
		symbol: scopedMethod(
			bridge.ffi.symbol.bind(bridge.ffi),
			capabilities,
			'native.ffi.symbols',
		) as NativeFFIBridge['symbol'],
		call: scopedMethod(
			bridge.ffi.call.bind(bridge.ffi),
			capabilities,
			'native.ffi.call',
		) as NativeFFIBridge['call'],
	};

	return {
		bridge: {
			apiVersion: bridge.apiVersion,
			abiVersion: bridge.abiVersion,
			capabilities: bridge.capabilities,
			objc,
			ffi,
		},
		dispose: () => {
			for (const token of tokens) token.remove();
			tokens.clear();
		},
	};
}

export function validateNativePluginRequirements(
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): void {
	const unknown = capabilities.find(
		(capability) => !(NativePlugin?.capabilities ?? []).includes(capability),
	);
	if (unknown) throw new NativePluginCapabilityError(unknown);
	if (minimumApi && NativePlugin && compareVersions(NativePlugin.apiVersion, minimumApi) < 0) {
		throw new Error(
			`Native plugin API ${minimumApi} is required, but ${NativePlugin.apiVersion} is installed.`,
		);
	}
	if ((capabilities.length > 0 || minimumApi) && !NativePlugin) requireNativePlugin();
}

export function createPluginContext(
	id: string,
	capabilities: readonly NativePluginCapability[] = [],
	minimumApi?: string,
): PluginContext {
	validateNativePluginRequirements(capabilities, minimumApi);
	const scoped = createScopedNativePlugin(capabilities);
	return {
		id,
		capabilities,
		native: scoped.bridge,
		dispose: scoped.dispose,
	};
}
