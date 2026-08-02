/**
 * @description The function patcher, re-exported from `possess`. Exposes `createPatcher` for
 * scoped patchers along with the standalone `before`/`after`/`instead` hooks and unpatch helpers.
 * This is the public surface behind `unbound.patcher` and `@unbound-app/api/patcher`.
 */
export * from 'possess';

import { createPatcher } from 'possess';

const a = createPatcher('t');

const test = { hi: () => {} };
a.after(test, 'hi', ({ args }) => {
	args[0].variant = 'primary';
});
