import type { Addon } from '@unbound-app/types';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { Screens } from '~/lib/constants';
import { Icons } from '~/api/assets';

type AddonSettingsProps = {
	addon: Addon;
	disabled?: boolean;
};

/**
 * @description Opens a plugin-provided settings panel inside Unbound's native custom settings route.
 * The cog remains visible when a panel is unavailable so card actions keep a stable layout.
 */
function AddonSettings({ addon, disabled }: AddonSettingsProps) {
	const navigation = Discord.useNavigation();
	const { instance } = addon;

	function handlePress() {
		if (!instance?.getSettingsPanel) return;

		navigation.push(Screens.Custom, {
			title: addon.data.name,
			render: () => instance.getSettingsPanel?.(),
		});
	}

	return (
		<Discord.IconButton
			icon={Icons['SettingsIcon'] ?? 0}
			variant='tertiary'
			size='sm'
			disabled={disabled || !instance?.getSettingsPanel}
			accessibilityLabel={`${addon.data.name} settings`}
			onPress={handlePress}
		/>
	);
}

export default memo(AddonSettings);
