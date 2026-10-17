/**
 * @description Creates a Proxy object with custom getter and fallback behavior.
 * @template T The object type that the proxy represents.
 * @param options Configuration object containing getter and fallback functions.
 * @param options.getter Function called when accessing a property, receives the property key.
 * @param options.fallback Function called when getter returns undefined, receives the property key.
 * @returns A Proxy object with the specified getter and fallback behavior.
 */
type ProxyOptions<T extends object> = {
	getter: (prop: PropertyKey) => T[keyof T] | undefined;
	fallback: (prop: PropertyKey) => T[keyof T];
};

function createProxy<T extends object>(options: ProxyOptions<T>): T {
	const { getter, fallback } = options;
	const target: T = Object.create(Object.prototype);

	const proxy = new Proxy(target, {
		get(_, prop) {
			const value = getter(prop);

			return value !== undefined ? value : fallback(prop);
		},
	});

	return proxy;
}

export default createProxy;
