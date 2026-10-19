#!/usr/bin/env bash
# Runs the two-process ENet smoke test (headless host + headless client on localhost).
# Exit 0 only if both processes exit 0.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$ROOT/spike/build"
mkdir -p "$LOG"
godot --headless --path "$ROOT/spike/godot" --script res://tests/net_smoke.gd -- --host >"$LOG/net_host.log" 2>&1 &
HOST=$!
sleep 1
godot --headless --path "$ROOT/spike/godot" --script res://tests/net_smoke.gd -- --client >"$LOG/net_client.log" 2>&1
C=$?
wait $HOST
H=$?
grep -hE '^\[(host|client)\]' "$LOG/net_host.log" "$LOG/net_client.log"
echo "[net_smoke] host exit=$H client exit=$C"
[ $H -eq 0 ] && [ $C -eq 0 ]
