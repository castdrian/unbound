import type { ComponentType } from 'react';

/** The screen descriptor a settings route entry renders. */
export interface SettingsScreen {
	route: string;
	getComponent: () => ComponentType<any>;
}

/** A registered Unbound settings entry, mirroring Discord's `SETTING_RENDERER_CONFIG` route shape. */
export interface SettingsEntry {
	type: 'route';
	key: string;
	useTitle: () => string;
	parent: string | null;
	section?: string;
	excludeFromDisplay?: boolean;
	/** The manifest id of the addon this entry belongs to, so its card can surface a settings button. */
	addonId?: string;
	/** Also show this entry as a row in the main Settings menu. Defaults to false. */
	pinned?: boolean;
	IconComponent?: ComponentType<any>;
	screen: SettingsScreen;
}
