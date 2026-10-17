import type { ImageSourcePropType } from 'react-native';
import type { ComponentType } from 'react';

/** A button rendered inside a toast. */
export type ToastButton = {
	variant?: 'primary' | 'secondary' | 'tertiary';
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	iconPosition?: 'start' | 'end';
	content: string;
	icon?: number;
	onPress: () => void;
};

/** Options accepted when showing a toast. */
export type ToastOptions = {
	title?: string | ComponentType;
	content?: string;
	duration?: number;
	onTimeout?: () => void;
	icon?: string | number | ImageSourcePropType;
	id?: string;
	buttons?: ToastButton[];
	tintedIcon?: boolean;
};

/** {@link ToastOptions} enriched with the fields the store tracks internally. */
export type InternalToastOptions = {
	id: string;
	closing?: boolean;
	date?: number;
} & ToastOptions;

/** A handle returned when showing a toast, used to update or close it. */
export type ToastHandle = {
	update: (options: Partial<ToastOptions>) => void;
	close: () => void;
};

/** State and actions of the toast store. */
export type ToastStoreState = {
	toasts: Record<string, InternalToastOptions>;
	addToast: (options: InternalToastOptions) => ToastHandle;
	updateToastWithOptions: (id: string, options: Partial<InternalToastOptions>) => void;
};
