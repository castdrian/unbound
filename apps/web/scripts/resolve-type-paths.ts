import { dirname, join, relative } from 'node:path';

// tsc keeps `~/` specifiers as written, but a consumer resolves `~/` against its own `paths`, so the
// emitted declarations are rewritten to relative specifiers.

const OUT_DIR = join(import.meta.dir, '..', 'dist', 'types');
const SRC_DIR = join(OUT_DIR, 'src');

const declarations = new Bun.Glob('**/*.d.ts').scanSync({ cwd: OUT_DIR, absolute: true });

for (const path of declarations) {
	const prefix = relative(dirname(path), SRC_DIR) || '.';
	const source = await Bun.file(path).text();

	await Bun.write(path, source.replaceAll(/(["'])~\//g, `$1${prefix}/`));
}
