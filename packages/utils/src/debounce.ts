/**
 * @description Throttles a function by the provided milliseconds.
 * @template A The function's argument types. Used to provide autocomplete for function arguments.
 * @param func The function to debounce.
 * @param ms The milliseconds to debounce the function by.
 * @return An instance of the function wrapped in a debounce timer.
 */
function debounce<A extends unknown[]>(
	func: (...args: A) => void,
	ms: number,
): (...args: A) => void {
	let timer;

	return function (...args: A) {
		clearTimeout(timer);
		timer = setTimeout(() => func.apply(this, args), ms);
	};
}

export default debounce;
