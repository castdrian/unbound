import type { ControllerClient } from '@unbound-app/debugger-protocol/controller';
import type { CommandOutput } from '@unbound-app/debugger-protocol/registry';
import type { EvalResult } from '@unbound-app/debugger-protocol';

import { waitForDevice } from '~/lib/context';
import { formatResult } from '~/lib/format';

export type DeviceClient = Pick<ControllerClient, 'isDeviceConnected' | 'evaluate'>;

/** The answer every device command gives when the bridge has no device. */
export const NOT_CONNECTED: CommandOutput = {
	ok: false,
	text: 'No device is connected to the debugger. Launch the app so its debugger dials the bridge, then retry.',
};

/**
 * @description Waits briefly for a device, then evaluates code on it.
 * @param client The bridge controller.
 * @param code The JavaScript to evaluate on the device.
 * @returns The device's result, or `undefined` when no device connected in time.
 */
export async function evaluateOnDevice(
	client: DeviceClient,
	code: string,
): Promise<EvalResult | undefined> {
	await waitForDevice(client);

	if (!client.isDeviceConnected) return;

	return client.evaluate(code);
}

/**
 * @description Evaluates code on the device and renders the result as a command's output.
 * @param client The bridge controller.
 * @param code The JavaScript to evaluate on the device.
 * @returns The formatted transcript with the raw result as data, or {@link NOT_CONNECTED}.
 */
export async function runOnDevice(client: DeviceClient, code: string): Promise<CommandOutput> {
	const result = await evaluateOnDevice(client, code);

	if (!result) {
		return NOT_CONNECTED;
	}

	return { ok: result.ok, text: formatResult(result), data: result };
}

export default { NOT_CONNECTED, evaluateOnDevice, runOnDevice };
