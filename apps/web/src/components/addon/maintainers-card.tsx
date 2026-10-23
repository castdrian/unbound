import type { MarketplaceMaintainer } from '~/lib/marketplace';
import { SidebarCard } from '~/components/addon/sidebar-card';
import UserAvatar from '~/components/user-avatar';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';

type MaintainersCardProps = {
	maintainers: MarketplaceMaintainer[];
};

/** The Unbound accounts that may publish the addon, owners first. */
function MaintainersCard({ maintainers }: MaintainersCardProps) {
	return (
		<SidebarCard title='Maintainers'>
			{maintainers.map((maintainer) => (
				<div key={maintainer.id} className='flex items-center gap-3'>
					<UserAvatar
						size='sm'
						className='rounded-lg object-cover'
						src={maintainer.image}
						name={maintainer.name}
					/>
					<Text variant='text-sm' className='flex-1 truncate'>
						{maintainer.name}
					</Text>
					{maintainer.badge ? <UserBadge badge={maintainer.badge} /> : null}
					<Text variant='text-xs' color='muted' className='capitalize'>
						{maintainer.role}
					</Text>
				</div>
			))}
		</SidebarCard>
	);
}

export default MaintainersCard;
