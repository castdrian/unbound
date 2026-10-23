// Usage: bun fake-github.ts <port> <token>, run by launch.sh in the instance's tmux session.
// Serves GitHub's REST API for one public repository, verify/addons, from a real git repository.
// The seeded users' linked GitHub accounts hold <token>, which can push to it.
import { serveGitHub } from '../../../../apps/web/tests/helpers/github';

const REPOSITORY = 'verify/addons';

const port = Number(process.argv[2]);
const token = process.argv[3];

if (!Number.isInteger(port) || port <= 0 || !token) {
	throw new Error('Pass the port to serve the fake GitHub on and the token it accepts.');
}

function plugin(id: string, name: string, version: string, files: Record<string, string> = {}) {
	const manifest = {
		id,
		name,
		description: `${name}, served by the verify-web fake GitHub.`,
		authors: [{ name: 'Verify', id: '1234567890' }],
		version,
		main: 'src/index.ts',
		type: 'plugin',
	};

	const all: Record<string, string> = {
		'manifest.json': JSON.stringify(manifest, null, '\t'),
		'package.json': JSON.stringify({ scripts: { build: 'bun build src/index.ts' } }),
		'dist/index.js': `console.log('${id} ${version}');\n`,
		'ADDON.md': `# ${name}\n\nWhat ${name} does, as the author wrote it.\n`,
		'CHANGELOG.md': `# Changelog\n\n## [${version}] - 2026-10-20\n\n### Added\n\n- First release of ${name}.\n\n### Fixed\n\n- A crash on start.\n`,
		...files,
	};

	return Object.fromEntries(
		Object.entries(all).map(([file, content]) => [`plugins/${id}/${file}`, content]),
	);
}

const github = serveGitHub({
	port,
	repositories: {
		[REPOSITORY]: {
			description: 'Addons for verifying apps/web.',
			homepage: 'https://verify.example',
			topics: ['verify', 'unbound'],
			license: 'MIT',
			stars: 7,
			latestRelease: { tag: 'v1', name: 'First', publishedAt: '2026-10-20T12:00:00Z' },
		},
	},
	tokens: { [token]: { push: [REPOSITORY] } },
});

const fixture = github.repository(REPOSITORY);

fixture.commit({
	'README.md': '# verify/addons\n',
	'unbound.config.json': JSON.stringify({ addons: ['plugins/*'] }),
	...plugin('verify.new', 'Verify New', '0.1.0'),
	...plugin('verify.hello', 'Verify Hello', '1.1.0'),
	...plugin('verify.broken', 'Verify Broken', '0.1.0'),
});
fixture.commit({ 'plugins/verify.broken/dist/index.js': null });
fixture.tag('v1');

async function stop() {
	await github.stop();
	process.exit(0);
}

process.on('SIGTERM', () => void stop());
process.on('SIGHUP', () => void stop());

console.log(`fake GitHub serving ${REPOSITORY} on ${github.url.href} from ${fixture.dir}`);
