// Accepts connections on the catalog port and never answers, to hold the client in its loading state.
Bun.listen({
	hostname: '100.65.233.54',
	port: 3200,
	socket: {
		data() {},
		open() {
			console.log('connection held');
		},
	},
});
console.log('hanging on 3200');
