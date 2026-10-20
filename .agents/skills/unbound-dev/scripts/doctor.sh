#!/usr/bin/env bash
# Read-only health check for the device loop. Exits 0 only when every check passes.
set -uo pipefail
. "$(dirname "$0")/env.sh"

fail=0

check() {
	local label=$1
	shift

	if "$@" >/dev/null 2>&1; then
		echo "ok   $label"
	else
		echo "FAIL $label"
		fail=1
	fi
}

listening() {
	(exec 3<>"/dev/tcp/$DEV_HOST/$1") 2>/dev/null
}

echo "config: DEV_HOST=$DEV_HOST dev :$UNBOUND_DEV_PORT bridge :$UNBOUND_BRIDGE_PORT catalog :$UNBOUND_CATALOG_PORT"
check "bundle server serves manifest.json on :$UNBOUND_DEV_PORT" curl -sf -m 3 "http://$DEV_HOST:$UNBOUND_DEV_PORT/manifest.json"
check "debugger bridge listens on :$UNBOUND_BRIDGE_PORT" listening "$UNBOUND_BRIDGE_PORT"

if listening "$UNBOUND_CATALOG_PORT"; then
	check "catalog answers /api/v1/catalog on :$UNBOUND_CATALOG_PORT" curl -sf -m 3 "http://$DEV_HOST:$UNBOUND_CATALOG_PORT/api/v1/catalog"
fi

result=$("$here/ubd" eval 'typeof unbound' 2>&1)

if grep -q '^object' <<<"$result"; then
	echo 'ok   device connected and Unbound running'
else
	echo "FAIL device eval: $(tail -n 1 <<<"$result")"
	fail=1
fi

log=$UNBOUND_LOG_DIR/unbound-dev.log

if [[ -f $log ]]; then
	echo "last device bundle fetch: $(grep -o '([0-9:]*) GET /unbound\.[0-9]*\.bundle' "$log" | tail -n 1)"
fi

exit $fail
