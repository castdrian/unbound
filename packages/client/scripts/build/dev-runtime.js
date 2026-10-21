// Rolldown's dev-mode module runtime (`experimental.devMode.implement`), prepended to the dev bundle.
// The hoisted bundle registers each module's live exports here; hot patches register factories that
// re-run a module against those exports. Kept dependency-free: it runs before any bundled module.
globalThis.__rolldown_runtime__ = (() => {
	const modules = new Map();
	const factories = new Map();
	const imports = new Map();
	const importers = new Map();
	const accepted = new Set();

	function exportAll(all) {
		const target = {};

		for (const name in all) {
			Object.defineProperty(target, name, { get: all[name], enumerable: true });
		}

		Object.defineProperty(target, Symbol.toStringTag, { value: 'Module' });

		return target;
	}

	// hermesc gives a loop's `const` one binding for every iteration, so a getter made in the loop
	// would read the last key. A call gives each key its own scope.
	function getter(from, key) {
		return () => from[key];
	}

	function copyProps(to, from, except) {
		if (!from || (typeof from !== 'object' && typeof from !== 'function')) return to;

		for (const key of Object.getOwnPropertyNames(from)) {
			if (key === except || Object.prototype.hasOwnProperty.call(to, key)) {
				continue;
			}

			Object.defineProperty(to, key, { get: getter(from, key), enumerable: true });
		}

		return to;
	}

	function toESM(mod, isNodeMode) {
		const target = mod == null ? {} : Object.create(Object.getPrototypeOf(mod));

		if (isNodeMode || !mod || !mod.__esModule || !Object.hasOwn(mod, 'default')) {
			Object.defineProperty(target, 'default', { value: mod, enumerable: true });
		}

		return copyProps(target, mod);
	}

	function toCommonJS(mod) {
		if (Object.hasOwn(mod, 'module.exports')) return mod['module.exports'];

		return copyProps(Object.defineProperty({}, '__esModule', { value: true }), mod);
	}

	// The modules to re-run for a change: every importer up to a module that accepts its own updates.
	// Reaching a module nothing imports without one means the change needs a full reload, so null.
	function affected(changed) {
		const visited = new Set();
		const pending = [...changed];

		while (pending.length) {
			const id = pending.pop();

			if (visited.has(id)) {
				continue;
			}

			visited.add(id);

			if (accepted.has(id)) {
				continue;
			}

			const parents = importers.get(id);

			if (!parents?.size) return null;

			pending.push(...parents);
		}

		return visited;
	}

	return {
		registerGraph({ ids, localCount, edges, dynamicEdges }) {
			for (let i = 0; i < localCount; i++) {
				const id = ids[i];
				const targets = [...edges[i], ...(dynamicEdges?.[i] ?? [])].map((j) => ids[j]);

				for (const target of imports.get(id) ?? []) importers.get(target)?.delete(id);

				imports.set(id, targets);

				for (const target of targets) {
					if (!importers.has(target)) importers.set(target, new Set());

					importers.get(target).add(id);
				}
			}
		},
		registerFactory(id, factory) {
			factories.set(id, factory);
		},
		registerModule(id, holder = { exports: {} }) {
			modules.set(id, holder);
		},
		removeModuleCache(id) {
			modules.delete(id);
			accepted.delete(id);
		},
		initModule(id) {
			if (!modules.has(id)) {
				const factory = factories.get(id);

				if (!factory) {
					throw new Error(`No factory registered for module ${id}`);
				}

				factory(id);
			}

			return this.loadExports(id);
		},
		loadExports(id) {
			return modules.get(id)?.exports ?? {};
		},
		createModuleHotContext(id) {
			return {
				id,
				data: {},
				accept() {
					accepted.add(id);
				},
				dispose() {},
				invalidate() {},
			};
		},
		// Evaluates a patch and re-runs the modules its changes reach. Returns false when the change
		// reaches a module that can't take it in place, and the app needs a full reload instead.
		applyPatch(code, changedIds) {
			(0, eval)(code);

			const ids = affected(changedIds);

			if (!ids) return false;

			for (const id of ids) this.removeModuleCache(id);
			for (const id of ids) this.initModule(id);

			return true;
		},
		__exportAll: exportAll,
		__toESM: toESM,
		__toCommonJS: toCommonJS,
		__toDynamicImportESM: (isNodeMode) => (mod) => toESM(mod.default, isNodeMode),
		__reExport: (target, mod, second) => {
			copyProps(target, mod, 'default');

			if (second) copyProps(second, mod, 'default');
		},
	};
})();
