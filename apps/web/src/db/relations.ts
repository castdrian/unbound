import { addonRelations } from '~/db/schema/addons';
import { authRelations } from '~/db/schema/auth';

const relations = { ...authRelations, ...addonRelations };

export default relations;
