import { IconLoader2 } from '@tabler/icons-react';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Spinner({ className, ...props }: ComponentProps<typeof IconLoader2>) {
	return (
		<IconLoader2
			role='status'
			aria-label='Loading'
			className={cn('size-4 animate-spin', className)}
			{...props}
		/>
	);
}

export default Spinner;
