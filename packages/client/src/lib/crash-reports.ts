import { crashReportResponseSchema } from '@unbound-app/contracts/crash-reports';
import { createApiClient } from '@unbound-app/web/client';
import { createLogger } from '@unbound-app/logger';
import type { Api } from '@unbound-app/web/api';

import type { CrashEnvironment, CrashEvent } from '~/lib/crash-report';
import { buildCrashReport } from '~/lib/crash-report';
import { BundleInfo } from '~/api/native';
import storage from '~/api/storage';

export type { CrashEvent, CrashReportAddon } from '~/lib/crash-report';

const logger = createLogger('Crash Reports');

export const CRASH_REPORTS_SETTING = 'crash-reports';

/**
 * @description Reads whether the user turned crash reporting on. It is off until they do.
 * @returns Whether reports may be sent.
 */
export function crashReportsEnabled(): boolean {
	return storage.get('unbound', CRASH_REPORTS_SETTING, false);
}

function currentEnvironment(clientVersion: string): CrashEnvironment | undefined {
	const platform = globalThis.NativePlatform;

	if (!platform || (platform.platform !== 'ios' && platform.platform !== 'android')) {
		return undefined;
	}

	return {
		platform: platform.platform,
		clientVersion,
		loaderVersion: String(globalThis.UNBOUND_LOADER?.version ?? 'unknown'),
		discordVersion: String(BundleInfo?.Version ?? 'unknown'),
		osVersion: platform.device.getOSVersionString(),
		deviceModel: platform.device.getDeviceModel(),
	};
}

/**
 * @description Sends a crash report when the user turned reporting on. Failures are logged and never thrown.
 * @param event The failure the manager saw.
 */
export async function reportCrash(event: CrashEvent): Promise<void> {
	if (!crashReportsEnabled()) {
		return;
	}

	try {
		const { API_URL, CLIENT_VERSION } = await import('~/lib/constants');
		const environment = currentEnvironment(CLIENT_VERSION);
		const report = environment && buildCrashReport(event, environment);

		if (!report) {
			return;
		}

		const request = createApiClient<Api>({ baseUrl: API_URL });

		await request('POST /api/v1/crash-reports', {
			body: report,
			response: crashReportResponseSchema,
		});
	} catch (error) {
		logger.warn('Could not send a crash report:', error);
	}
}
