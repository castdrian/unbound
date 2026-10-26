import type { Theme, ThemeSemanticColor } from '@unbound-app/types';
import { createLogger } from '@unbound-app/logger';

import { createPatcher } from '~/api/patcher';
import { findByProps } from '~/api/metro';
import ThemeStore from '~/stores/themes';

const Patcher = createPatcher('unbound::themes');
const Logger = createLogger('Themes');

type ColorResolver = {
	getSemanticColorName(color: unknown): string | undefined;
	resolveSemanticColor(theme: string, color: unknown, ...rest: unknown[]): string;
};

export function start() {
	const resolver: ColorResolver | undefined = findByProps('SemanticColor')?.default?.internal;
	if (!resolver?.resolveSemanticColor) {
		return Logger.error('Failed to find the semantic color resolver.');
	}

	Patcher.instead(resolver, 'resolveSemanticColor', ({ args, original, this: self }) => {
		const name = resolver.getSemanticColorName(args[1]);
		const color = name ? resolveThemeColor(name) : undefined;

		return color ?? original.apply(self, args);
	});
}

export function stop() {
	Patcher.unpatchAll();
}

function resolveThemeColor(name: string): string | undefined {
	const theme: Theme | null = ThemeStore.getState().data;
	const entry: ThemeSemanticColor | undefined = theme?.semantic?.[name];
	if (!entry) return;

	const value = entry.type === 'raw' ? theme?.raw?.[entry.value] : entry.value;
	if (!value) return;

	return entry.opacity === undefined ? value : withOpacity(value, entry.opacity);
}

function withOpacity(color: string, opacity: number): string {
	const alpha = Math.round(Math.min(Math.max(opacity, 0), 1) * 255)
		.toString(16)
		.padStart(2, '0');

	if (/^#[0-9a-f]{6}$/i.test(color)) return color + alpha;
	if (/^#[0-9a-f]{8}$/i.test(color)) return color.slice(0, 7) + alpha;

	return color;
}

export default { start, stop };
