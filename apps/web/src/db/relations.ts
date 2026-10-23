import { sourceRelations } from '~/db/schema/sources';
import { addonRelations } from '~/db/schema/addons';
import { authRelations } from '~/db/schema/auth';

const relations = { ...authRelations, ...addonRelations, ...sourceRelations };

export default relations;
