import type { ChangeType } from '@unbound-app/contracts/changelog';
import { CHANGE_LABELS } from '@unbound-app/contracts/changelog';
import { IconGitCommit } from '@tabler/icons-react';

import { commitUrl, formatDate, shortSha } from '~/components/addon/format';
import { ExternalLink } from '~/components/addon/sidebar-card';
import type { MarketplaceVersion } from '~/lib/marketplace';
import type { Tone } from '~/components/dashboard/status';
import { TONES } from '~/components/dashboard/status';
import Separator from '~/components/ui/separator';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

type VersionHistoryProps = {
	versions: MarketplaceVersion[];
};

type VersionEntryProps = {
	version: MarketplaceVersion;
	latest: boolean;
};

type VersionChangelogProps = Pick<MarketplaceVersion, 'changelog' | 'changes'>;

const CHANGE_TONES: Record<ChangeType, Tone> = {
	added: 'success',
	changed: 'info',
	fixed: 'warning',
	removed: 'danger',
};

function VersionChangelog({ changelog, changes }: VersionChangelogProps) {
	if (changes && changes.sections.length > 0) {
		return (
			<div className='flex flex-col gap-3'>
				{changes.sections.map((section) => (
					<div key={section.type} className='flex flex-col gap-1.5'>
						<div className='flex items-center gap-2'>
							<span
								className={cn(
									'rounded-full size-1.5 shrink-0',
									TONES[CHANGE_TONES[section.type]].dot,
								)}
							/>
							<Text variant='text-xs' className='font-medium uppercase tracking-wide'>
								{CHANGE_LABELS[section.type]}
							</Text>
						</div>
						<Text
							as='ul'
							variant='text-sm'
							color='muted'
							className='flex flex-col gap-1 pl-5 marker:text-muted-foreground/50 list-disc'
						>
							{section.items.map((item, index) => (
								<li key={index}>{item}</li>
							))}
						</Text>
					</div>
				))}
			</div>
		);
	}

	return (
		<Text variant='text-sm' color='muted' className='whitespace-pre-wrap'>
			{changelog ?? 'No changelog.'}
		</Text>
	);
}

function VersionEntry({ version, latest }: VersionEntryProps) {
	return (
		<article className='flex flex-col gap-3'>
			<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
				<Text variant='heading-sm' as='h3'>
					v{version.version}
				</Text>
				{latest ? <Tag variant='primary'>Latest</Tag> : null}
				<div className='flex items-center gap-3 ml-auto'>
					{version.source ? (
						<ExternalLink
							href={commitUrl(version.source)}
							className='inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground text-xs transition-colors'
						>
							<IconGitCommit className='size-3.5' />
							{shortSha(version.source.commitSha)}
						</ExternalLink>
					) : null}
					<Text as='time' variant='text-xs' color='muted' dateTime={version.publishedAt}>
						{formatDate(version.publishedAt)}
					</Text>
				</div>
			</div>
			<VersionChangelog changelog={version.changelog} changes={version.changes} />
		</article>
	);
}

/** Every approved version, newest first, with what changed in each. */
function VersionHistory({ versions }: VersionHistoryProps) {
	return (
		<div className='flex flex-col gap-5'>
			{versions.map((version, index) => (
				<div key={version.version} className='flex flex-col gap-5'>
					{index > 0 ? <Separator /> : null}
					<VersionEntry version={version} latest={index === 0} />
				</div>
			))}
		</div>
	);
}

export default VersionHistory;
