import { Outlet, createFileRoute, useLocation } from '@tanstack/react-router';

import Footer from '~/components/footer';
import Header from '~/components/header';
import cn from '~/lib/cn';

function SiteLayout() {
	const isHome = useLocation({ select: (location) => location.pathname === '/' });

	return (
		<>
			<div className={cn('flex flex-col flex-1 overflow-hidden', !isHome && 'dotted-bg')}>
				<Header />
				<div className='mb-4' />
				<Outlet />
			</div>
			<Footer />
		</>
	);
}

export const Route = createFileRoute('/_site')({
	component: SiteLayout,
});
