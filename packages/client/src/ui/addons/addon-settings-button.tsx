import type { Addon } from '@unbound-app/types';
import { Pressable } from 'react-native';
import { memo, useMemo } from 'react';

import { Discord } from '~/api/metro/components';
import SettingsStore from '~/stores/settings';
import { TintedIcon } from '~/ui/components';
import { Icons } from '~/api/assets';

type AddonSettingsButtonProps = {
	addon: Addon;
};

/**
 * @description The settings shortcut for a plugin card: shown only when the plugin has registered a
 * settings entry for itself (matched by `entry.addonId`), regardless of whether that entry also opted
 * into being pinned in the main Settings menu. Navigates straight to the entry's registered screen.
 */
function AddonSettingsButton({ addon }: AddonSettingsButtonProps) {
	const navigation = Discord.useNavigation();
	const sections = SettingsStore((state) => state.sections);

	const entry = useMemo(
		() => Object.values(sections).find((section) => section.addonId === addon.id),
		[sections, addon.id],
	);

	if (!entry) return null;

	return (
		<Pressable hitSlop={8} onPress={() => navigation.push(entry.screen.route)}>
			<TintedIcon source={Icons['SettingsIcon'] ?? 0} size={20} />
		</Pressable>
	);
}

export default memo(AddonSettingsButton);
