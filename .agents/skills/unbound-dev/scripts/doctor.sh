#!/usr/bin/env bash
# Read-only health check for the vphone verification loop. Exit 0 only when every check passes.
set -uo pipefail

repo=/home/dev/unbound
host=100.65.233.54
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

check 'tmux unbound-dev (bundle server :3100)' tmux has-session -t unbound-dev
check 'tmux unbound-debugger (bridge :9091)' tmux has-session -t unbound-debugger
check 'bundle server answers manifest.json' curl -sf -m 3 "http://$host:3100/manifest.json"
check 'debugger bridge listening on :9091' bash -c 'ss -ltn | grep -q ":9091 "'

if tmux has-session -t marketplace-api 2>/dev/null; then
	check 'catalog stub answers /api/v1/catalog' curl -sf -m 3 -o /dev/null "http://$host:3200/api/v1/catalog"
fi

result=$(cd "$repo" && timeout 15 bun packages/cli/src/index.ts eval --port 9091 'typeof unbound' 2>&1)

if grep -q '^object' <<<"$result"; then
	echo 'ok   device connected and Unbound is running (typeof unbound === "object")'
else
	echo 'FAIL device eval: '"$(tail -1 <<<"$result")"
	fail=1
fi

echo "last device bundle fetch: $(grep -o '([0-9:]*) GET /unbound\.[0-9]*\.bundle' /tmp/unbound-dev.log | tail -1)"
echo "dev server started with: $(ps -o args= -p "$(tmux list-panes -t unbound-dev -F '#{pane_pid}' 2>/dev/null)" 2>/dev/null)"

exit $fail
