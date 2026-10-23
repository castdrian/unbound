import type { ChangeType, Changelog } from '@unbound-app/contracts/changelog';
import { CHANGE_LABELS } from '@unbound-app/contracts/changelog';

import type { Tone } from '~/components/dashboard/status';
import { TONES } from '~/components/dashboard/status';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type ChangelogSectionsProps = {
	changelog: Changelog;
};

const CHANGE_TONES: Record<ChangeType, Tone> = {
	added: 'success',
	changed: 'info',
	fixed: 'warning',
	removed: 'danger',
};

/** A release's typed changelog: one marked, labelled list per change type. */
function ChangelogSections({ changelog }: ChangelogSectionsProps) {
	return (
		<div className='flex flex-col gap-3'>
			{changelog.sections.map((section) => (
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

export default ChangelogSections;
