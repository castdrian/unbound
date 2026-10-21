import { parseAst } from 'rolldown/parseAst';
import type { ESTree } from 'rolldown/utils';
import type { Plugin } from 'rolldown';
import { relative } from 'node:path';

type FunctionNode = ESTree.Function;
type Program = ESTree.Program;
type Node = ESTree.Node;

type Edit = { at: number; text: string };

type Registration = { name: string; start: number; end: number; signature: string };

const COMPONENT_NAME = /^[A-Z]/;
const HOOK_NAME = /^use[A-Z]/;

/**
 * @description Registers every top-level component of a `.tsx` module with the client's hot registry, so a
 * hot patch can swap its body in place. A module that exports only components accepts its own updates.
 * @param root The directory module ids are made relative to, matching rolldown's dev-mode ids.
 * @param registry The import specifier of the registry module.
 * @returns A rolldown plugin for dev builds.
 */
export default function refresh(root: string, registry: string): Plugin {
	return {
		name: 'refresh',
		transform: {
			filter: { id: { include: /\.tsx$/, exclude: /node_modules/ } },
			handler(code, id) {
				const program = parseAst(code, { lang: 'tsx' }, id);
				const registrations = findComponents(program);

				if (!registrations.length) return null;

				const module = relative(root, id);
				const edits: Edit[] = [
					{ at: 0, text: `import { register as __register } from '${registry}';\n` },
				];

				for (const { name, start, end, signature } of registrations) {
					const key = JSON.stringify(`${module}#${name}`);

					edits.push({ at: start, text: `var ${name} = __register(${key}, ` });
					edits.push({ at: end, text: `, ${JSON.stringify(signature)});` });
				}

				if (exportsOnly(program, new Set(registrations.map(({ name }) => name)))) {
					edits.push({ at: code.length, text: '\nimport.meta.hot.accept();\n' });
				}

				return { code: applyEdits(code, edits), map: null };
			},
		},
	};
}

function findComponents(program: Program) {
	const found: Registration[] = [];

	for (const statement of program.body) {
		const declaration =
			statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;

		if (declaration?.type !== 'FunctionDeclaration') {
			continue;
		}

		const name = declaration.id?.name;

		if (!name || !COMPONENT_NAME.test(name) || declaration.async || declaration.generator) {
			continue;
		}

		found.push({
			name,
			start: declaration.start,
			end: declaration.end,
			signature: hookCalls(declaration).join(','),
		});
	}

	return found;
}

// The hooks a component calls directly, in order. Calls inside nested functions belong to those functions.
function hookCalls(component: FunctionNode) {
	const hooks: string[] = [];
	const pending: Node[] = component.body ? [component.body] : [];

	while (pending.length) {
		const node = pending.pop()!;

		if (node.type === 'CallExpression') {
			const callee = node.callee;
			const name =
				callee.type === 'Identifier'
					? callee.name
					: callee.type === 'MemberExpression' && callee.property.type === 'Identifier'
						? callee.property.name
						: '';

			if (HOOK_NAME.test(name)) {
				hooks.push(name);
			}
		}

		const children = childNodes(node).filter((child) => !isFunction(child));

		pending.push(...children.reverse());
	}

	return hooks;
}

function childNodes(node: Node) {
	const children: Node[] = [];

	for (const value of Object.values(node)) {
		for (const item of Array.isArray(value) ? value : [value]) {
			if (isNode(item)) {
				children.push(item);
			}
		}
	}

	return children;
}

// UNKNOWN: walks arbitrary AST property values.
function isNode(value: unknown): value is Node {
	return typeof value === 'object' && value !== null && 'type' in value && 'start' in value;
}

function isFunction(node: Node) {
	return (
		node.type === 'FunctionDeclaration' ||
		node.type === 'FunctionExpression' ||
		node.type === 'ArrowFunctionExpression'
	);
}

// Whether every runtime export is a registered component, so re-running the module changes nothing else.
function exportsOnly(program: Program, components: Set<string>) {
	let exported = 0;

	for (const statement of program.body) {
		if (statement.type === 'ExportAllDeclaration') {
			if (statement.exportKind !== 'type') {
				return false;
			}

			continue;
		}

		if (statement.type === 'ExportDefaultDeclaration') {
			const value = statement.declaration;

			if (value.type !== 'Identifier' || !components.has(value.name)) {
				return false;
			}

			exported++;
			continue;
		}

		if (statement.type !== 'ExportNamedDeclaration' || statement.exportKind === 'type') {
			continue;
		}

		const declaration = statement.declaration;

		if (declaration) {
			if (declaration.type === 'TSTypeAliasDeclaration') {
				continue;
			}

			if (declaration.type !== 'FunctionDeclaration') {
				return false;
			}

			if (!components.has(declaration.id?.name ?? '')) {
				return false;
			}

			exported++;
			continue;
		}

		if (statement.source) {
			return false;
		}

		for (const specifier of statement.specifiers) {
			if (specifier.exportKind === 'type') {
				continue;
			}

			const local = specifier.local;

			if (local.type !== 'Identifier' || !components.has(local.name)) {
				return false;
			}

			exported++;
		}
	}

	return exported > 0;
}

function applyEdits(code: string, edits: Edit[]) {
	let result = code;

	for (const { at, text } of edits.toSorted((a, b) => b.at - a.at)) {
		result = result.slice(0, at) + text + result.slice(at);
	}

	return result;
}
