import { createPluginConfig } from '@unbound-plugins/rollup-config';

import { lazyBundled } from './rollup/lazy-bundled.mjs';

const config = createPluginConfig(import.meta.url, { settingsPanel: true });

config.plugins.unshift(lazyBundled());

export default config;
