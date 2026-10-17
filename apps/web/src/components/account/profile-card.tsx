import { useNavigate, useRouter } from '@tanstack/react-router';
import { IconLogout } from '@tabler/icons-react';
import { useTransition } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import type { SessionUser } from '~/lib/auth/session';
import { Button } from '~/components/ui/button';
import Avatar from '~/components/ui/avatar';
import authClient from '~/lib/auth/client';
import Text from '~/components/ui/text';

type ProfileCardProps = {
	user: SessionUser;
};

function ProfileCard({ user }: ProfileCardProps) {
	const router = useRouter();
	const navigate = useNavigate();
	const [isPending, startTransition] = useTransition();

	function signOut() {
		startTransition(async () => {
			await authClient.signOut();
			await navigate({ to: '/' });
			await router.invalidate();
		});
	}

	return (
		<Card className='gap-4'>
			<CardHeader>
				<CardTitle>Profile Information</CardTitle>
			</CardHeader>
			<CardContent className='flex flex-col gap-4'>
				<div className='flex items-center gap-4'>
					<Avatar
						size='lg'
						src={user.image}
						fallback={user.name.at(0)?.toUpperCase() ?? '?'}
					/>
					<div className='flex flex-col gap-1'>
						<Text variant='text-md' className='font-semibold'>
							{user.name}
						</Text>
						<Text variant='text-sm' color='muted'>
							{user.email}
						</Text>
					</div>
					<Button
						className='ml-auto'
						variant='destructive'
						disabled={isPending}
						onClick={signOut}
					>
						<IconLogout size={14} />
						Log Out
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export default ProfileCard;
