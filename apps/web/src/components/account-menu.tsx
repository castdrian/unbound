import { IconChevronDown, IconLogin, IconLogout, IconShield, IconUser } from '@tabler/icons-react';
import { Link, useRouteContext, useRouter } from '@tanstack/react-router';

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { getStaffAreas } from '~/lib/auth/staff-areas';
import { Button } from '~/components/ui/button';
import Avatar from '~/components/ui/avatar';
import authClient from '~/lib/auth/client';

function AccountMenu() {
	const router = useRouter();
	const session = useRouteContext({ from: '__root__', select: (context) => context.session });

	if (!session) {
		return (
			<Button asChild variant='default' className='rounded-md'>
				<Link to='/login'>
					<IconLogin />
					Login
				</Link>
			</Button>
		);
	}

	const { user } = session;

	async function signOut() {
		await authClient.signOut();
		await router.invalidate();
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant='ghost' className='group/account border-none rounded-md h-10'>
					<Avatar
						src={user.image}
						fallback={user.name.at(0)?.toUpperCase() ?? '?'}
						size='xs'
					/>
					{user.name}
					<IconChevronDown className='group-data-[state=open]/account:rotate-180! transition-transform' />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuItem asChild>
					<Link to='/account'>
						<IconUser />
						Account
					</Link>
				</DropdownMenuItem>
				{getStaffAreas(user.role).map((area) => (
					<DropdownMenuItem key={area.id} asChild>
						<a href={area.href}>
							<IconShield />
							{area.label}
						</a>
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem onSelect={signOut} variant='destructive'>
					<IconLogout />
					Log Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export default AccountMenu;
