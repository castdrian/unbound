import { createFileRoute, redirect } from '@tanstack/react-router';

import LinkedAccountsCard from '~/components/account/linked-accounts-card';
import ApiKeysCard from '~/components/account/api-keys-card';
import ProfileCard from '~/components/account/profile-card';
import { getAccountOverview } from '~/lib/auth/account';
import Text from '~/components/ui/text';

function AccountPage() {
	const { user } = Route.useRouteContext();
	const { accounts, apiKeys } = Route.useLoaderData();

	return (
		<div className='flex flex-col gap-6 md:mx-auto mb-12 px-2 container'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Account Settings</Text>
				<Text variant='text-md' color='muted'>
					Manage your account information, linked accounts and API keys.
				</Text>
			</div>

			<ProfileCard user={user} />
			<LinkedAccountsCard accounts={accounts} />
			<ApiKeysCard apiKeys={apiKeys} />
		</div>
	);
}

export const Route = createFileRoute('/_site/account')({
	head: () => ({ meta: [{ title: 'Unbound | Account' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}

		return { user: context.session.user };
	},
	loader: () => getAccountOverview(),
	component: AccountPage,
});
