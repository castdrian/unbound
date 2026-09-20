import type { NativePluginBridge } from './typings/native';
import type { Fn, ColorString } from './typings/utils';
import type { AddonManifest } from './typings/addons';

declare global {
	/** A feature name published by the native module's capability table. */
	type UnboundNativeFeature =
		| 'device.info'
		| 'device.entitlements'
		| 'app.source'
		| 'notifications'
		| 'pip.video'
		| 'chat.avatar'
		| 'chat.messageBubbles'
		| 'toolbox.menu'
		| 'native.evaluateBytecode'
		| 'native.pluginApi';

	/**
	 * The lifecycle status of a native feature on the running build. `unknown` and `unavailable`
	 * both mean "do not call"; only `supported` and `deprecated` are safe.
	 */
	type UnboundNativeFeatureStatus =
		| 'unknown'
		| 'removed'
		| 'deprecated'
		| 'supported'
		| 'unavailable';

	/**
	 * The full metadata record for a native feature. Everything but `name` and `known` is absent
	 * when the feature is not in this build's table.
	 */
	type UnboundNativeFeatureInfo = {
		name: string;
		known: boolean;
		status: UnboundNativeFeatureStatus;
		supported?: boolean;
		introducedIn?: string;
		deprecatedIn?: string;
		removedIn?: string;
		replacement?: UnboundNativeFeature;
	};

	/** Hardware, OS, and install-integrity details for the device Unbound is running on. */
	type UnboundNativeDevice = {
		getModel(): string;
		getiOSVersionString(): string;
		isJailbroken(): boolean;
		isSystemApp(): boolean;
		isVerifiedBuild(): boolean;
		getEntitlements(): Record<string, any>;
		getEntitlementsAsPlist(): string;
	};

	/** How this copy of the app was installed. */
	type UnboundNativeApp = {
		getSource(): string;
	};

	/** Local notification scheduling. */
	type UnboundNativeNotifications = {
		show(
			title?: string,
			body?: string,
			timeDelay?: number,
			soundEnabled?: boolean,
			identifier?: string,
		): string;
	};

	/** Picture-in-picture video playback. */
	type UnboundNativePiP = {
		playVideo(url: string): string | null;
	};

	/**
	 * Native chat appearance controls. The getters read synchronously; every setter hops to the
	 * main queue and returns immediately, so a value read back on the next line may still be stale.
	 */
	type UnboundNativeChat = {
		getAvatarCornerRadius(): number;
		setAvatarCornerRadius(radius?: number): void;
		resetAvatarCornerRadius(): void;
		getMessageBubblesEnabled(): boolean;
		getMessageBubbleLightColor(): ColorString;
		getMessageBubbleDarkColor(): ColorString;
		getMessageBubbleCornerRadius(): number;
		setMessageBubblesEnabled(
			enabled: boolean,
			lightColor?: ColorString,
			darkColor?: ColorString,
		): void;
		setMessageBubbleColors(lightColor?: ColorString, darkColor?: ColorString): void;
		setMessageBubbleCornerRadius(radius?: number): void;
		resetMessageBubbles(): void;
	};

	/** The native toolbox menu, drawn natively so it survives a broken JS bundle. */
	type UnboundNativeToolbox = {
		showMenu(): void;
	};

	/** The raw `UnboundNative` JSI bridge the tweak installs directly on the JS global. */
	type UnboundNativeModule = {
		getNativeModuleVersion(): string;
		supportsFeature(name: UnboundNativeFeature): boolean;
		getFeatureInfo(name: UnboundNativeFeature): UnboundNativeFeatureInfo;
		isFeatureDeprecated(name: UnboundNativeFeature): boolean;
		isFeatureRemoved(name: UnboundNativeFeature): boolean;
		getSupportedFeatures(): UnboundNativeFeature[];
		getDeprecatedFeatures(): UnboundNativeFeature[];
		getRemovedFeatures(): UnboundNativeFeature[];

		/**
		 * Runs Hermes bytecode in the app's JS runtime and returns whatever it evaluates to.
		 * Throws when the buffer is not an `ArrayBuffer`, is empty, or is not Hermes bytecode;
		 * anything the bytecode itself throws propagates too.
		 */
		evaluateBytecode(bytecode: ArrayBuffer, tag?: string): any;

		device: UnboundNativeDevice;
		app: UnboundNativeApp;
		notifications: UnboundNativeNotifications;
		pip: UnboundNativePiP;
		chat: UnboundNativeChat;
		toolbox: UnboundNativeToolbox;
		nativePlugin: NativePluginBridge;
	};

	type UnboundNativePluginModule = NativePluginBridge;

	/**
	 * The Metro `require` function: runs (and returns the exports of) a module by id.
	 * @internal
	 */
	type MetroRequire = {
		importAll: Fn;
	} & ((id: number | string) => void);

	/**
	 * The Metro `define` function, registering a module factory by id.
	 * @internal
	 */
	type MetroDefine = (...args: any[]) => void;

	/**
	 * React Native's old-architecture bridge, used to dispatch native → JS calls.
	 * @internal
	 */
	type FbBatchedBridge = {
		flushedQueue(): unknown;
		getCallableModule(name: string): unknown;
		callFunctionReturnFlushedQueue(...args: any[]): unknown;
		__callFunction(...args: any[]): unknown;
	};

	/**
	 * React Native's New Architecture app registry, used to run the root application.
	 * @internal
	 */
	type RNAppRegistry = {
		runApplication(...args: any[]): unknown;
	};

	/**
	 * Build-time token, replaced with a boolean literal by the build's `transform.define`. Folds at
	 * the module-graph level so `if ($$DEV$$)` branches (and any imports inside them) are dead-code
	 * eliminated from production bundles entirely. Use it (not a runtime check) to gate dev-only code.
	 */
	var $$DEV$$: boolean;

	/** The raw `UnboundNative` JSI bridge, installed on the global by the platform loader. */
	var UnboundNative: UnboundNativeModule | undefined;
	var UnboundNativePlugin: UnboundNativePluginModule | undefined;

	/**
	 * Hermes engine internals, exposing runtime metadata (bytecode version, GC, build).
	 * @internal
	 */
	interface HermesInternalObject {
		getRuntimeProperties(): Record<string, any>;
	}

	/** @internal */
	var nativeLoggingHook: (message: string, level: any) => void;
	var React: typeof import('react');
	var ReactNative: typeof import('react-native');
	/** @internal */
	var __r: MetroRequire;
	/** @internal */
	var __d: MetroDefine;

	interface Window {
		/** @internal */
		modules: Map<number, any>;

		/**
		 * Hermes engine internals; access via `window.HermesInternal` so our typing wins over RN's `null | {}`.
		 * @internal
		 */
		HermesInternal: HermesInternalObject | null;

		/** @internal */
		__r?: MetroRequire;
		/** @internal */
		__d?: MetroDefine;
		/** @internal */
		__c?: () => Map<number, any>;
		/** @internal */
		__fbBatchedBridge?: FbBatchedBridge;
		/** @internal */
		RN$AppRegistry?: RNAppRegistry;

		/** @internal */
		UNBOUND_LOADER: {
			origin: string;
			version: string;
		};

		/** @internal */
		UNBOUND_SETTINGS: {
			contents: string;
			path: string;
		}[];

		/** @internal */
		UNBOUND_PLUGINS: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		/** @internal */
		UNBOUND_THEMES: {
			manifest: AddonManifest;
			bundle: string;
		}[];

		/** @internal */
		UNBOUND_FONTS: {
			name: string;
			file: string;
			path: string;
		}[];

		/** @internal */
		UNBOUND_AVAILABLE_FONTS: string[];

		/** @internal */
		UNBOUND_ICONS: {
			manifest: AddonManifest;
			bundle: string;
		}[];
	}
}
