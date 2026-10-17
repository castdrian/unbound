import { createFileRoute } from '@tanstack/react-router';

import authClient from '~/lib/auth/client';

function signIn() {
	return authClient.signIn.social({ provider: 'discord', callbackURL: '/' });
}

function signOut() {
	return authClient.signOut();
}

function Home() {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) return null;

	return (
		<main>
			<h1>Unbound</h1>
			{session ? (
				<>
					<p>Signed in as {session.user.name}.</p>
					<button type='button' onClick={signOut}>
						Sign out
					</button>
				</>
			) : (
				<button type='button' onClick={signIn}>
					Sign in with Discord
				</button>
			)}
		</main>
	);
}

export const Route = createFileRoute('/')({
	component: Home,
});
