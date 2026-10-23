import { sourceRelations } from '~/db/schema/sources';
import { addonRelations } from '~/db/schema/addons';
import { adminRelations } from '~/db/schema/admin';
import { authRelations } from '~/db/schema/auth';

const relations = { ...authRelations, ...addonRelations, ...sourceRelations, ...adminRelations };

export default relations;
