import deferUntilReady, { markReady } from '~/lib/loader';

deferUntilReady(async () => {
	await import('./preinitialize');
	await import('.');
	markReady();
});
