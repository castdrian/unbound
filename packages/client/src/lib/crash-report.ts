import { crashReportSchema } from '@unbound-app/contracts/crash-reports';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';

/** The addon a report is about. */
export type CrashReportAddon = NonNullable<CrashReport['addon']>;

/** What an addon manager knows about a failure; the reporter adds the app, loader and device details. */
export type CrashEvent = Pick<
	CrashReport,
	'kind' | 'addon' | 'phase' | 'seconds' | 'message' | 'stack'
>;

/** The app, loader and device details every report carries. */
export type CrashEnvironment = Pick<
	CrashReport,
	'platform' | 'clientVersion' | 'loaderVersion' | 'discordVersion' | 'osVersion' | 'deviceModel'
>;

/**
 * @description Builds the report for an event, trimming text to the limits the API accepts.
 * @param event The failure the manager saw.
 * @param environment The app, loader and device details.
 * @returns The validated report, or `undefined` when the details don't validate.
 */
export function buildCrashReport(
	event: CrashEvent,
	environment: CrashEnvironment,
): CrashReport | undefined {
	const parsed = crashReportSchema.safeParse({
		...event,
		...environment,
		...(event.message === undefined ? {} : { message: event.message.slice(0, 2_000) }),
		...(event.stack === undefined ? {} : { stack: event.stack.slice(0, 16_000) }),
		loaderVersion: environment.loaderVersion.slice(0, 64),
		discordVersion: environment.discordVersion.slice(0, 64),
		osVersion: environment.osVersion.slice(0, 64),
		deviceModel: environment.deviceModel.slice(0, 64),
	});

	return parsed.success ? parsed.data : undefined;
}
