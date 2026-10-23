import type { SourcePin } from '@unbound-app/contracts/source';

import { getTreeUrl, shortSha } from '~/lib/github-urls';

type SourcePinLinkProps = {
	pin: SourcePin;
};

function SourcePinLink({ pin }: SourcePinLinkProps) {
	return (
		<a
			href={getTreeUrl(pin)}
			target='_blank'
			rel='noopener noreferrer'
			className='font-mono underline-offset-4 hover:underline'
		>
			{pin.repository}@{shortSha(pin.commitSha)}
		</a>
	);
}

export default SourcePinLink;
