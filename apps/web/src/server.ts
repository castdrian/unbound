import handler, { createServerEntry } from '@tanstack/react-start/server-entry';

import { startStagingSweeper } from '~/lib/staging';
import app from '~/lib/app';

startStagingSweeper(app);

export default createServerEntry({
	fetch: (request) => handler.fetch(request),
});
