import type { RepositoryContributor } from '@unbound-app/contracts/source';

import { ExternalLink, SidebarCard } from '~/components/addon/sidebar-card';
import { formatCount } from '~/components/addon/format';
import Text from '~/components/ui/text';

type ContributorsCardProps = {
	contributors: RepositoryContributor[];
};

/** The repository's top contributors when the newest version was submitted. */
function ContributorsCard({ contributors }: ContributorsCardProps) {
	return (
		<SidebarCard title='Contributors'>
			<ul className='flex flex-col gap-2'>
				{contributors.map((contributor) => (
					<li
						key={contributor.login}
						className='flex justify-between items-baseline gap-4'
					>
						<ExternalLink
							href={`https://github.com/${encodeURIComponent(contributor.login)}`}
						>
							<Text as='span' variant='text-sm' className='truncate'>
								{contributor.login}
							</Text>
						</ExternalLink>
						<Text variant='text-xs' color='muted' className='tabular-nums shrink-0'>
							{formatCount(contributor.contributions)}{' '}
							{contributor.contributions === 1 ? 'commit' : 'commits'}
						</Text>
					</li>
				))}
			</ul>
		</SidebarCard>
	);
}

export default ContributorsCard;
