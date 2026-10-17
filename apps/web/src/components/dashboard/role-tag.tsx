import type { MaintainerRole } from '@unbound-app/contracts/addons';

import Tag from '~/components/tag';

type RoleTagProps = {
	role: MaintainerRole;
};

function RoleTag({ role }: RoleTagProps) {
	return role === 'owner' ? <Tag variant='primary'>Owner</Tag> : <Tag>Maintainer</Tag>;
}

export default RoleTag;
