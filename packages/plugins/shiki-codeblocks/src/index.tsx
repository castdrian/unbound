import ensureCapabilities from '@unbound-plugins/shared/native/ensure-capabilities';
import applyFeatures from '@unbound-plugins/shared/lifecycle/apply-features';
import ensureClasses from '@unbound-plugins/shared/native/ensure-classes';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import type { NativeObjCBridge, PluginContext } from '@unbound-app/api/native';
import { MESSAGE_TEXT_VIEW_CLASSES } from '@unbound-plugins/shared/native/text-attachments';

import SettingsPanel from '~/components/settings-panel';
import { MessageStore, SelectedChannelStore } from '~/modules';
import { startRenderer } from '~/native/renderer';
import { PLUGIN_NAME } from '~/constants';

let dispose = () => {};

function messageTextViewClass(objc: NativeObjCBridge): string {
	return (
		MESSAGE_TEXT_VIEW_CLASSES.find((name) => objc.getClass(name)) ??
		MESSAGE_TEXT_VIEW_CLASSES[0]
	);
}

function start(context: PluginContext) {
	if (
		!ensureCapabilities(PLUGIN_NAME, context.native, context.capabilities) ||
		!ensureModules(PLUGIN_NAME, { MessageStore, SelectedChannelStore }) ||
		!ensureClasses(PLUGIN_NAME, context.native.objc, [
			messageTextViewClass(context.native.objc),
			'DCDMessageTableViewCell',
		])
	) {
		return;
	}

	dispose = applyFeatures(PLUGIN_NAME, [() => startRenderer(context.native.objc)]);
}

function stop() {
	dispose();
	dispose = () => {};
}

export default {
	start,
	stop,
	getSettingsPanel: () => <SettingsPanel />,
};
