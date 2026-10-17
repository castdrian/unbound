import { createFileRoute } from '@tanstack/react-router';
import type { FormEvent } from 'react';
import { useState } from 'react';
import { z } from 'zod';

import authClient from '~/lib/auth/client';

type Step = 'enter' | 'confirm' | 'approved' | 'denied';

type AuthClientError = {
	message?: string;
	statusText: string;
};

const deviceSearchSchema = z.object({
	user_code: z.string().optional(),
});

function describe(error: AuthClientError): string {
	return error.message || error.statusText;
}

function DevicePage() {
	const search = Route.useSearch();
	const { data: session, isPending } = authClient.useSession();
	const [code, setCode] = useState(search.user_code ?? '');
	const [step, setStep] = useState<Step>('enter');
	const [error, setError] = useState<string | null>(null);

	if (isPending) return null;

	if (!session) {
		const callbackURL = `/device?user_code=${encodeURIComponent(code)}`;

		return (
			<main>
				<h1>Authorize a device</h1>
				<p>Sign in to approve the device asking for access to your account.</p>
				<button
					type='button'
					onClick={() => authClient.signIn.social({ provider: 'discord', callbackURL })}
				>
					Sign in with Discord
				</button>
			</main>
		);
	}

	// Looking the code up while signed in claims it for this account, which approval requires.
	async function verify(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const result = await authClient.device({ query: { user_code: code } });

		if (result.error) {
			setError(describe(result.error));

			return;
		}

		setError(null);
		setStep('confirm');
	}

	async function decide(approve: boolean) {
		const result = approve
			? await authClient.device.approve({ userCode: code })
			: await authClient.device.deny({ userCode: code });

		if (result.error) {
			setError(describe(result.error));

			return;
		}

		setError(null);
		setStep(approve ? 'approved' : 'denied');
	}

	return (
		<main>
			<h1>Authorize a device</h1>
			{step === 'enter' ? (
				<form onSubmit={verify}>
					<label>
						Code shown in your terminal
						<input
							value={code}
							onChange={(event) => setCode(event.target.value)}
							autoComplete='off'
							required
						/>
					</label>
					<button type='submit'>Continue</button>
				</form>
			) : null}
			{step === 'confirm' ? (
				<>
					<p>
						Allow the device using code {code} to act as {session.user.name}?
					</p>
					<button type='button' onClick={() => decide(true)}>
						Approve
					</button>
					<button type='button' onClick={() => decide(false)}>
						Deny
					</button>
				</>
			) : null}
			{step === 'approved' ? <p>Device approved. You can return to your terminal.</p> : null}
			{step === 'denied' ? <p>Device denied.</p> : null}
			{error ? <p role='alert'>{error}</p> : null}
		</main>
	);
}

export const Route = createFileRoute('/device')({
	validateSearch: deviceSearchSchema,
	component: DevicePage,
});
