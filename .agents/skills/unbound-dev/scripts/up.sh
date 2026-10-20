#!/usr/bin/env bash
# Starts the dev loop's servers in tmux sessions, leaving running ones alone.
# Usage: up.sh [--restart] [catalog]
#   --restart  stop the sessions first, so they pick up new settings
#   catalog    also serve catalog-stub.ts and point the dev build's API at it
set -euo pipefail
. "$(dirname "$0")/env.sh"

restart=0
api=${UNBOUND_API_URL:-}
stub=

for arg; do
	case $arg in
	--restart) restart=1 ;;
	catalog)
		api=http://$DEV_HOST:$UNBOUND_CATALOG_PORT
		stub="env PORT=$UNBOUND_CATALOG_PORT bun '$here/catalog-stub.ts'"
		;;
	*) sed -n '3,5s/^# //p' "$0" >&2 && exit 2 ;;
	esac
done

command -v tmux >/dev/null || { echo 'up.sh needs tmux' >&2; exit 1; }

start() {
	local name=$1 cmd=$2 log=$UNBOUND_LOG_DIR/$1.log

	if ((restart)); then
		tmux kill-session -t "=$name" 2>/dev/null || true
	fi

	if tmux has-session -t "=$name" 2>/dev/null; then
		echo "running $name"
		return
	fi

	tmux new-session -d -s "$name" -c "$root" "$cmd 2>&1 | tee '$log'"
	echo "started $name, log $log"
}

start unbound-debugger "bun packages/debugger/src/index.ts --port $UNBOUND_BRIDGE_PORT"
[[ -n $stub ]] && start unbound-catalog "$stub"
start unbound-dev "env PORT=$UNBOUND_DEV_PORT DEV_HOST=$DEV_HOST DEBUGGER_PORT=$UNBOUND_BRIDGE_PORT ${api:+UNBOUND_API_URL=$api} bun run --filter @unbound-app/client dev"
