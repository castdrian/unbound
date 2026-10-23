import { DetailRow, SidebarCard } from '~/components/addon/sidebar-card';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import { formatDate } from '~/components/addon/format';

type DetailsCardProps = {
	addon: MarketplaceAddonDetails;
};

const TYPE_LABELS: Record<MarketplaceAddonDetails['type'], string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon Pack',
	font: 'Font',
};

/** What the addon is and what the newest version needs. */
function DetailsCard({ addon }: DetailsCardProps) {
	return (
		<SidebarCard title='Details'>
			<DetailRow label='Type'>{TYPE_LABELS[addon.type]}</DetailRow>
			<DetailRow label='ID'>
				<span className='font-mono text-xs break-all'>{addon.id}</span>
			</DetailRow>
			<DetailRow label='Version'>{addon.version}</DetailRow>
			<DetailRow label='Listed'>{formatDate(addon.createdAt)}</DetailRow>
			{addon.minClientVersion ? (
				<DetailRow label='Requires Unbound'>{addon.minClientVersion} or newer</DetailRow>
			) : null}
			{addon.capabilities.length > 0 ? (
				<DetailRow label='Native capabilities'>{addon.capabilities.join(', ')}</DetailRow>
			) : null}
		</SidebarCard>
	);
}

export default DetailsCard;
