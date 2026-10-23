import type { Changelog } from '@unbound-app/contracts/changelog';
import { CHANGE_LABELS } from '@unbound-app/contracts/changelog';

import Text from '~/components/ui/text';

type ChangelogSectionsProps = {
	changelog: Changelog;
};

function ChangelogSections({ changelog }: ChangelogSectionsProps) {
	return (
		<div className='flex flex-col gap-2'>
			{changelog.sections.map((section) => (
				<div key={section.type} className='flex flex-col gap-1'>
					<Text variant='text-sm' className='font-medium'>
						{CHANGE_LABELS[section.type]}
					</Text>
					<Text
						as='ul'
						variant='text-sm'
						color='muted'
						className='flex flex-col gap-1 ml-4 list-disc'
					>
						{section.items.map((item) => (
							<li key={item}>{item}</li>
						))}
					</Text>
				</div>
			))}
		</div>
	);
}

export default ChangelogSections;
